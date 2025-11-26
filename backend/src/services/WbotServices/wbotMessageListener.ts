import * as Sentry from "@sentry/node";
import { writeFile } from "fs";
import path from "path";
import { promisify } from "util";

import {
  proto,
  WASocket,
  downloadMediaMessage,
  extractMessageContent,
  getContentType,
  WAMessage,
  WAMessageKey,
  WAMessageStubType,
  proto as _proto
} from "@whiskeysockets/baileys";

import { logger } from "../../utils/logger";
import { getIO } from "../../libs/socket";

import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import Campaign from "../../models/Campaign";
import CampaignShipping from "../../models/CampaignShipping";

import { handleMessage } from "./wbotMessageHandler";
import { handleMsgAck } from "./wbotHelpers"; // Importar handleMsgAck de wbotHelpers

const MESSAGE_CACHE_TTL = 1000 * 60 * 5;


// =====================================================
// FILTER
// =====================================================
const filterMessages = (msg: proto.IWebMessageInfo): boolean => {
  if (!msg || !msg.message) return false;

  if (msg.message.protocolMessage?.editedMessage) return true;

  if (msg.message.protocolMessage?.type === _proto.Message.ProtocolMessage.Type.REVOKE)
    return true;

  if (msg.message.protocolMessage) return false;

  if (msg.key?.remoteJid === "status@broadcast") return false;

  return true;
};


// =====================================================
// CAMPAIGNS
// =====================================================
const verifyRecentCampaign = async (message: proto.IWebMessageInfo, companyId: number) => {
  if (!message.key.fromMe) {
    const number = message.key.remoteJid!.replace(/\D/g, "");
    const campaigns = await Campaign.findAll({
      where: { companyId, status: "EM_ANDAMENTO", confirmation: true }
    });

    if (!campaigns.length) return;

    const ids = campaigns.map(c => c.id);

    const ship = await CampaignShipping.findOne({
      where: { campaignId: { $in: ids }, number, confirmation: null } as any
    });

    if (ship) {
      await ship.update({ confirmation: true, confirmedAt: new Date() });
    }
  }
};


const verifyCampaignMessageAndCloseTicket = async (message: proto.IWebMessageInfo, companyId: number) => {
  const io = getIO();
  const body = (message.message?.conversation || "").toString();

  if (message.key.fromMe && /\u200c/.test(body)) {
    const msgRecord = await Message.findOne({
      where: { id: message.key.id!, companyId }
    });

    if (!msgRecord) return;

    const ticket = await Ticket.findByPk(msgRecord.ticketId);
    if (!ticket) return;

    await ticket.update({ status: "closed" });

    io.emit(`company-${ticket.companyId}-ticket`, {
      action: "delete",
      ticket,
      ticketId: ticket.id
    });
  }
};


// =====================================================
// LISTENER PRINCIPAL
// =====================================================
export const wbotMessageListener = async (wbot: WASocket, companyId: number) => {
  try {
    const messageCache = new Set<string>();
    setInterval(() => messageCache.clear(), MESSAGE_CACHE_TTL);

    const messageQueue: proto.IWebMessageInfo[] = [];
    let processing = false;

    const processQueue = async () => {
      if (processing || !messageQueue.length) return;

      processing = true;

      const batch = messageQueue.splice(0, messageQueue.length);

      for (const message of batch) {
        try {
          const id = message.key.id!;
          if (messageCache.has(id)) continue;

          messageCache.add(id);

          const exists = await Message.findByPk(id);
          if (exists) continue;

          await Promise.all([
            handleMessage(message, wbot, companyId),
            verifyRecentCampaign(message, companyId),
            verifyCampaignMessageAndCloseTicket(message, companyId)
          ]);

        } catch (err) {
          logger.error("Error processing message", err);
          Sentry.captureException(err);
        }
      }

      processing = false;
    };

    // processa fila
    setInterval(processQueue, 100);

    // RECEBIMENTO DE MENSAGENS
    wbot.ev.on("messages.upsert", async ({ messages }) => {
      try {
        const valid = messages.filter(filterMessages);
        if (valid.length) messageQueue.push(...valid);

      } catch (err) {
        logger.error("messages.upsert", err);
        Sentry.captureException(err);
      }
    });

    // ATUALIZAÇÕES (ACK / DELETE)
    wbot.ev.on("messages.update", async updates => {
      for (const u of updates) {
        try {
          if (u.update?.status) {
            await (wbot as WASocket).readMessages([u.key]);
          }

          if (u.update?.messageStubType === WAMessageStubType.REVOKE) {
            // delete message handler
          }

          await handleMsgAck(u as any, u.update?.status);

        } catch (err) {
          logger.error("messages.update", err);
          Sentry.captureException(err);
        }
      }
    });

  } catch (error) {
    logger.error("Error in wbotMessageListener", error);
    Sentry.captureException(error);
  }
};