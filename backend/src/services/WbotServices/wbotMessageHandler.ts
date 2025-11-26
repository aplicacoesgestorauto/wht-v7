// wbotMessageHandler.ts
import * as Sentry from "@sentry/node";
import { proto, WASocket } from "@whiskeysockets/baileys";
import { head, isNil } from "lodash";
import Contact from "../../models/Contact";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import Queue from "../../models/Queue";
import Setting from "../../models/Setting";
import TicketTraking from "../../models/TicketTraking";
import { cacheLayer } from "../../libs/cache";
import { provider } from "./providers";
import { verifyMediaMessage, verifyMessage, getBodyMessage, getTypeMessage, getContactMessage, isValidMsg, verifyContact, FindOrCreateTicketService, FindOrCreateATicketTrakingService, ShowWhatsAppService, verifyQueue, handleOpenAi, handleMessageIntegration, handleChartbot, handleRating } from "./wbotHelpers";
import { debounce } from "../../helpers/Debounce";
import { logger } from "../../utils/logger";
import moment from "moment";
import ContactModel from "../../models/Contact";

type Session = WASocket & { id?: number };

export const handleMessage = async (msg: proto.IWebMessageInfo, wbot: Session, companyId: number): Promise<void> => {
  let mediaSent: Message | undefined;
  if (!msg || !msg.key || !msg.key.remoteJid) return;
  if (!isValidMsg(msg)) return;

  try {
    let msgContact;
    let groupContact: Contact | undefined;
    const isGroup = msg.key.remoteJid?.endsWith("@g.us");

    const msgIsGroupBlock = await Setting.findOne({ where: { companyId, key: "CheckMsgIsGroup" } });
    const bodyMessage = getBodyMessage(msg);
    const msgType = getTypeMessage(msg);

    const hasMedia = !!msg.message?.audioMessage || !!msg.message?.imageMessage || !!msg.message?.videoMessage || !!msg.message?.documentMessage || !!msg.message?.documentWithCaptionMessage || !!msg.message?.stickerMessage;

    if (msg.key.fromMe) {
      if (/\u200e/.test(bodyMessage || "")) return; // Tratando bodyMessage como string aqui
      if (!hasMedia && msgType !== "conversation" && msgType !== "extendedTextMessage" && msgType !== "vcard") return;
    }

    msgContact = await getContactMessage(msg, wbot);

    if (msgIsGroupBlock?.value === "enabled" && isGroup) return;

    if (isGroup) {
      // se quiser, mantenha seu mutex / cache aqui
      const groupMeta = await wbot.groupMetadata(msg.key.remoteJid);
      const msgGroupContact = new Contact({
        id: Number(groupMeta.id),
        name: groupMeta.subject
      });
      groupContact = await verifyContact(msgGroupContact, wbot, companyId);
    }

    const whatsapp = await ShowWhatsAppService(wbot.id!, companyId);
    const contact = await verifyContact(msgContact, wbot, companyId);

    let unreadMessages = 0;
    if (msg.key.fromMe) {
      await cacheLayer.set(`contacts:${contact.id}:unreads`, "0");
    } else {
      const unreads = await cacheLayer.get(`contacts:${contact.id}:unreads`);
      unreadMessages = +unreads + 1;
      await cacheLayer.set(`contacts:${contact.id}:unreads`, `${unreadMessages}`);
    }

    const lastMessage = await Message.findOne({ where: { contactId: contact.id, companyId }, order: [["createdAt", "DESC"]] });

    if (unreadMessages === 0 && whatsapp.complationMessage && lastMessage && String(whatsapp.complationMessage).trim().toLowerCase() === String(lastMessage.body).trim().toLowerCase()) return;

    const ticket = await FindOrCreateTicketService(contact, wbot.id!, unreadMessages, companyId, groupContact);

    await provider(ticket, msg, companyId, contact, wbot as WASocket);

    if (bodyMessage && bodyMessage === "#" && !isGroup) { // Adicionando verificação para bodyMessage
      await ticket.update({ queueOptionId: null, chatbot: false, queueId: null });
      await verifyQueue(wbot, msg, ticket, ticket.contact);
      return;
    }

    const ticketTraking = await FindOrCreateATicketTrakingService({ ticketId: ticket.id, companyId, whatsappId: whatsapp?.id });

    try {
      if (!msg.key.fromMe && !contact.isGroup) {
        if (ticketTraking && bodyMessage && /^\d+$/.test(bodyMessage) && handleRating /* or verifyRating */) {
          // se sua função verifyRating estiver em helpers, chame ela
        }
      }
    } catch (e) {
      Sentry.captureException(e);
      logger.error(e);
    }

    try {
      await ticket.update({ fromMe: msg.key.fromMe });
    } catch (e) {
      Sentry.captureException(e);
    }

    if (hasMedia) {
      mediaSent = await verifyMediaMessage(msg, ticket, contact);
    } else {
      await verifyMessage(msg, ticket, contact);
    }

    if (isGroup || contact.disableBot) {
      return;
    }

    // outras checagens como scheduleType, openai, integrations etc. (cole aqui o seu código conforme necessário)
    // ...
  } catch (err) {
    Sentry.captureException(err);
    logger.error(`Error handling whatsapp message: Err: ${err}`);
  }
};

export default { handleMessage };
