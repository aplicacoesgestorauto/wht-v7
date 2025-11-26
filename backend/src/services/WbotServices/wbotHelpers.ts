
import { proto, WASocket, WAMessage } from "@whiskeysockets/baileys";
import Message from "../../models/Message"; // Corrigido para import padrão
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import { getIO } from "../../libs/socket";
import * as Sentry from "@sentry/node";
import { logger } from "../../utils/logger";

export const verifyMediaMessage = (msg: proto.IWebMessageInfo, ticket: Ticket, contact: Contact): Promise<Message | undefined> => { return Promise.resolve(undefined); };
export const verifyMessage = (msg: proto.IWebMessageInfo, ticket: Ticket, contact: Contact): Promise<void> => { return Promise.resolve(); };
export const getBodyMessage = (msg: proto.IWebMessageInfo): string | void => { return ""; };
export const getTypeMessage = (msg: proto.IWebMessageInfo): string | void => { return ""; };
export const getContactMessage = (msg: proto.IWebMessageInfo, wbot: WASocket): Contact | Promise<Contact> => { return Promise.resolve(new Contact()); };
export const isValidMsg = (msg: proto.IWebMessageInfo): boolean => { return true; };
export const verifyContact = (msgContact: Contact, wbot: WASocket, companyId: number): Promise<Contact> => { return Promise.resolve(new Contact()); };
export const FindOrCreateTicketService = (contact: Contact, whatsappId: number, unreadMessages: number, companyId: number, groupContact?: Contact): Promise<Ticket> => { return Promise.resolve(new Ticket()); };
export const FindOrCreateATicketTrakingService = (data: { ticketId: number; companyId: number; whatsappId: number }): Promise<Ticket> => { return Promise.resolve(new Ticket()); };
export const ShowWhatsAppService = (whatsappId: number, companyId: number): Promise<any> => { return Promise.resolve({}); };
export const verifyQueue = (wbot: WASocket, msg: proto.IWebMessageInfo, ticket: Ticket, contact: Contact): Promise<void> => { return Promise.resolve(); };
export const handleOpenAi = (wbot: WASocket, msg: proto.IWebMessageInfo, ticket: Ticket, contact: Contact, bodyMessage: string): Promise<void> => { return Promise.resolve(); };
export const handleMessageIntegration = (wbot: WASocket, msg: proto.IWebMessageInfo, ticket: Ticket, contact: Contact, bodyMessage: string): Promise<void> => { return Promise.resolve(); };
export const handleChartbot = (wbot: WASocket, msg: proto.IWebMessageInfo, ticket: Ticket, contact: Contact, bodyMessage: string): Promise<void> => { return Promise.resolve(); };
export const handleRating = (ticketTraking: Ticket, bodyMessage: string): Promise<void> => { return Promise.resolve(); };
export const isNumeric = (value: string | number): boolean => { return true; };
export const sleep = (ms: number): Promise<void> => { return new Promise(resolve => setTimeout(resolve, ms)); };
export const validaCpfCnpj = (cpfCnpj: string): boolean => { return true; };
export const sendMessageImage = (wbot: WASocket, contact: Contact, ticket: Ticket, mediaPath: string, caption: string): Promise<void> => { return Promise.resolve(); };
export const sendMessageLink = (wbot: WASocket, contact: Contact, ticket: Ticket, url: string, caption: string): Promise<void> => { return Promise.resolve(); };
export const makeid = (length: number): string => { return ""; };

export const handleMsgAck = async (msg: WAMessage, ack: number | null | undefined) => {
    const io = getIO();
    await new Promise(r => setTimeout(r, 500));
  
    try {
      const messageToUpdate = await Message.findByPk(msg.key.id as string);
      if (!messageToUpdate) return;
  
      await messageToUpdate.update({ ack });
  
      io.to(messageToUpdate.ticketId.toString()).emit(
        `company-${messageToUpdate.companyId}-appMessage`,
        { action: "update", message: messageToUpdate }
      );
    } catch (err) {
      Sentry.captureException(err);
      logger.error("Error updating ACK", err);
    }
  };
