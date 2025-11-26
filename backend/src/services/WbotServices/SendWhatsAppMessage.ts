import * as Sentry from "@sentry/node";
import AppError from "../../errors/AppError";
import GetTicketWbot from "../../helpers/GetTicketWbot";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import { logger } from "../../utils/logger";
import formatBody from "../../helpers/Mustache";
import { map_msg } from "../../utils/global";

import { proto, WAMessage } from "@whiskeysockets/baileys";

interface Request {
  body: string;
  ticket: Ticket;
  quotedMsg?: Message;
  isForwarded?: boolean;
}

const SendWhatsAppMessage = async ({
  body,
  ticket,
  quotedMsg,
  isForwarded = false
}: Request): Promise<WAMessage> => {
  try {
    const wbot = await GetTicketWbot(ticket);

    const jid = `${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`;

    let options: any = {};

    // Se houver mensagem citada
    if (quotedMsg) {
      const dbMsg = await Message.findOne({
        where: { id: quotedMsg.id }
      });

      if (dbMsg) {
        const msgFound = JSON.parse(dbMsg.dataJson);

        // Baileys 7.x aceita o objeto completo como "quoted"
        options.quoted = msgFound;
      }
    }

    const text = formatBody(body, ticket.contact);

    // log — rastrear últimas mensagens enviadas pelo sistema
    map_msg.set(ticket.contact.number, { lastSystemMsg: body });

    const sentMessage = await wbot.sendMessage(jid, {
      text,
      contextInfo: {
        forwardingScore: isForwarded ? 2 : 0,
        isForwarded: isForwarded ? true : false
      },
      ...options
    });

    await ticket.update({ lastMessage: text });

    logger.info("Mensagem enviada com sucesso.");
    return sentMessage;

  } catch (err) {
    Sentry.captureException(err);
    console.error(err);
    throw new AppError("ERR_SENDING_WAPP_MSG");
  }
};

export default SendWhatsAppMessage;