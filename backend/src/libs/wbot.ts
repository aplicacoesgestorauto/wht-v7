import * as Sentry from "@sentry/node";
import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  isJidBroadcast,
  jidNormalizedUser
} from "@whiskeysockets/baileys";
import { makeInMemoryStore } from '@rodrigogs/baileys-store';
import { Op } from "sequelize";
import Whatsapp from "../models/Whatsapp";
import { logger } from "../utils/logger";
import MAIN_LOGGER from "@whiskeysockets/baileys/lib/Utils/logger";
import authState from "../helpers/authState";
import { Boom } from "@hapi/boom";
import AppError from "../errors/AppError";
import { getIO } from "./socket";
import { Store } from "./store";
import { StartWhatsAppSession } from "../services/WbotServices/StartWhatsAppSession";
import DeleteBaileysService from "../services/BaileysServices/DeleteBaileysService";
import NodeCache from 'node-cache';
import Contact from "../models/Contact";
import Ticket from "../models/Ticket";

const loggerBaileys = MAIN_LOGGER.child({});
loggerBaileys.level = "error";

const msgRetryCounterCache = new NodeCache({
  stdTTL: 600,
  maxKeys: 1000,
  checkperiod: 300,
  useClones: false
});

const msgCache = new NodeCache({
  stdTTL: 60,
  maxKeys: 1000,
  checkperiod: 300,
  useClones: false
});

type Session = any & {
  id?: number;
  store?: Store;
};

export default function msg() {
  return {
    get: (key: any) => {
      const id = key?.id;
      if (!id) return;
      const data = msgCache.get(id);
      if (data) {
        try {
          const msg = JSON.parse(data as string);
          return msg?.message;
        } catch (error) {
          logger.error(error);
        }
      }
    },
    save: (msg: any) => {
      const id = msg?.key?.id;
      if (!id) return;
      const msgtxt = JSON.stringify(msg);
      try {
        msgCache.set(id as string, msgtxt);
      } catch (error) {
        logger.error(error);
      }
    }
  };
}

const sessions: Session[] = [];
const retriesQrCodeMap = new Map<number, number>();

export const getWbot = (whatsappId: number): Session => {
  const sessionIndex = sessions.findIndex(s => s.id === whatsappId);
  if (sessionIndex === -1) throw new AppError("ERR_WAPP_NOT_INITIALIZED");
  return sessions[sessionIndex];
};

export const removeWbot = async (
  whatsappId: number,
  isLogout = true
): Promise<void> => {
  try {
    const sessionIndex = sessions.findIndex(s => s.id === whatsappId);
    if (sessionIndex !== -1) {
      try {
        if (isLogout) {
          sessions[sessionIndex]?.logout?.();
          sessions[sessionIndex]?.ws?.close?.();
        }
      } catch (errInner) {
        logger.error(errInner);
      }
      sessions.splice(sessionIndex, 1);
    }
  } catch (err) {
    logger.error(err);
  }
};

export const restartWbot = async (
  companyId: number,
  session?: any
): Promise<void> => {
  try {
    const whatsapp = await Whatsapp.findAll({
      where: { companyId },
      attributes: ["id"]
    });

    whatsapp.map(async c => {
      const sessionIndex = sessions.findIndex(s => s.id === c.id);
      if (sessionIndex !== -1) {
        try {
          sessions[sessionIndex]?.ws?.close?.();
        } catch (err) {
          logger.error(err);
        }
      }
    });
  } catch (err) {
    logger.error(err);
  }
};

export const msgDB = msg();

export const initWASocket = async (whatsapp: Whatsapp): Promise<Session> => {
  return new Promise(async (resolve, reject) => {
    try {
      (async () => {
        const io = getIO();

        const whatsappUpdate = await Whatsapp.findOne({
          where: { id: whatsapp.id }
        });
        if (!whatsappUpdate) return reject(new Error("Whatsapp not found"));

        const { id, name, provider } = whatsappUpdate;

        const { version, isLatest } = await fetchLatestBaileysVersion();
        const isLegacy = provider === "stable";

        logger.info(`using WA v${version.join(".")}, isLatest: ${isLatest}`);
        logger.info(`isLegacy: ${isLegacy}`);
        logger.info(`Starting session ${name}`);
        let retriesQrCode = 0;

        let wsocket: Session = null;
        const store = makeInMemoryStore({ logger: loggerBaileys });

        const { state, saveState } = await authState(whatsapp);

        const userDevicesCache: any = new NodeCache();

        wsocket = makeWASocket({
          logger: loggerBaileys,
          printQRInTerminal: false,
          auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, loggerBaileys),
          },
          version,
          browser: Browsers.appropriate("Desktop"),
          defaultQueryTimeoutMs: undefined,
          msgRetryCounterCache,
          markOnlineOnConnect: false,
          connectTimeoutMs: 25_000,
          retryRequestDelayMs: 500,
          getMessage: msgDB.get,
          emitOwnEvents: true,
          fireInitQueries: true,
          transactionOpts: { maxCommitRetries: 10, delayBetweenTriesMs: 3000 },
          shouldIgnoreJid: jid => isJidBroadcast(jid),
        } as any);

        // connection update handler (defensive)
        wsocket.ev.on("connection.update", async (update: any) => {
          try {
            const connection = update?.connection;
            const lastDisconnect = update?.lastDisconnect;
            const qr = update?.qr;
            logger.info(`Socket ${name} Connection Update ${connection || ""} ${lastDisconnect || ""}`);

            const disconnectCode = (lastDisconnect?.error as Boom)?.output?.statusCode;

            if (connection === "close") {
              if (disconnectCode === 403) {
                await whatsapp.update({ status: "PENDING", session: "", number: "" });
                await removeWbot(id, false);
                await DeleteBaileysService(whatsapp.id);

                io.emit(`company-${whatsapp.companyId}-whatsappSession`, {
                  action: "update",
                  session: whatsapp
                });
              }

              if (disconnectCode !== DisconnectReason.loggedOut) {
                await removeWbot(id, false);
                setTimeout(() => StartWhatsAppSession(whatsapp, whatsapp.companyId), 2000);
              } else {
                await whatsapp.update({ status: "PENDING", session: "", number: "" });
                await DeleteBaileysService(whatsapp.id);

                io.emit(`company-${whatsapp.companyId}-whatsappSession`, {
                  action: "update",
                  session: whatsapp
                });
                await removeWbot(id, false);
                setTimeout(() => StartWhatsAppSession(whatsapp, whatsapp.companyId), 2000);
              }
            }

            if (connection === "open") {
              await whatsapp.update({
                status: "CONNECTED",
                qrcode: "",
                retries: 0,
                number:
                  (wsocket?.type === "md")
                    ? (jidNormalizedUser((wsocket as any)?.user?.id || "")?.split("@")[0] ?? "-")
                    : "-"
              });

              io.emit(`company-${whatsapp.companyId}-whatsappSession`, {
                action: "update",
                session: whatsappUpdate
              });

              const sessionIndex = sessions.findIndex(s => s.id === whatsapp.id);
              if (sessionIndex === -1) {
                wsocket.id = whatsapp.id;
                sessions.push(wsocket);
              }
              resolve(wsocket);
            }

            if (typeof qr !== "undefined") {
              if (retriesQrCodeMap.get(id) && retriesQrCodeMap.get(id) >= 3) {
                await whatsapp.update({
                  status: "DISCONNECTED",
                  qrcode: ""
                });
                await DeleteBaileysService(whatsapp.id);

                io.emit(`company-${whatsapp.companyId}-whatsappSession`, {
                  action: "update",
                  session: whatsapp
                });
                try {
                  wsocket.ev.removeAllListeners("connection.update");
                  wsocket.ws.close();
                } catch (e) {
                  logger.error(e);
                }
                wsocket = null;
                retriesQrCodeMap.delete(id);
              } else {
                logger.info(`Session QRCode Generate ${name}`);
                retriesQrCodeMap.set(id, (retriesQrCode += 1));

                await whatsapp.update({
                  qrcode: qr,
                  status: "qrcode",
                  retries: 0,
                  number: ""
                });
                const sessionIndex = sessions.findIndex(s => s.id === whatsapp.id);

                if (sessionIndex === -1) {
                  wsocket.id = whatsapp.id;
                  sessions.push(wsocket);
                }

                io.emit(`company-${whatsapp.companyId}-whatsappSession`, {
                  action: "update",
                  session: whatsapp
                });
              }
            }
          } catch (err) {
            logger.error(err);
          }
        });

        wsocket.ev.on("creds.update", saveState);

        // presence update (defensive)
        wsocket.ev.on("presence.update", async (pres: any) => {
          try {
            const remoteJid = pres?.id;
            const presences = pres?.presences ?? {};
            if (!remoteJid || !presences[remoteJid]?.lastKnownPresence) return;

            const contact = await Contact.findOne({
              where: {
                number: remoteJid.replace(/\D/g, ""),
                companyId: whatsapp.companyId
              }
            });
            if (!contact) return;

            const ticket = await Ticket.findOne({
              where: {
                contactId: contact.id,
                whatsappId: whatsapp.id,
                status: {
                  [Op.or]: ["open", "pending"]
                }
              }
            });

            if (ticket) {
              io.to(ticket.id.toString())
                .to(`company-${whatsapp.companyId}-${ticket.status}`)
                .to(`queue-${ticket.queueId}-${ticket.status}`)
                .emit(`company-${whatsapp.companyId}-presence`, {
                  ticketId: ticket.id,
                  presence: presences[remoteJid].lastKnownPresence
                });
            }
          } catch (error) {
            logger.error({ pres }, "presence.update: error processing");
            logger.error(error instanceof Error ? `${error.name} ${error.message}` : `Error type: ${typeof error}`);
          }
        });

        // bind store safely
        try {
          store.bind?.((wsocket as any).ev);
        } catch (e) {
          logger.error("Error binding store:", e);
        }
      })();
    } catch (error) {
      Sentry.captureException(error);
      logger.error(error);
      reject(error);
    }
  });
};
