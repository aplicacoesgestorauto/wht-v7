import { proto } from "@whiskeysockets/baileys";
import { getIO } from "../libs/socket";
import Message from "../models/Message";
import Ticket from "../models/Ticket";
import { logger } from "../utils/logger";
import GetTicketWbot from "./GetTicketWbot";

const SetTicketMessagesAsRead = async (ticket: Ticket): Promise<void> => {
  await ticket.update({ unreadMessages: 0 });

  try {
    const wbot: any = await GetTicketWbot(ticket);

    const messages = await Message.findAll({
      where: {
        ticketId: ticket.id,
        fromMe: false,
        read: false
      },
      order: [["createdAt", "DESC"]]
    });

    if (messages.length > 0) {
      // Converte JSON salvo no banco para o formato do Baileys
      const raw = JSON.parse(JSON.stringify(messages[0].dataJson));
      const lastMessage: proto.IWebMessageInfo = proto.WebMessageInfo.fromObject(raw);

      const remoteJid = `${ticket.contact.number}@${
        ticket.isGroup ? "g.us" : "s.whatsapp.net"
      }`;

      if (lastMessage?.key && lastMessage.key.fromMe === false) {
        try {
          // Método oficial Baileys 7.x — marca como lido
          await wbot.readMessages([lastMessage.key]);
        } catch (e1) {
          logger.warn("readMessages failed, trying sendReceipt:", e1);
          try {
            // Fallback compatível — também marca como lido
            await wbot.sendReceipt(remoteJid, [lastMessage.key.id], "read");
          } catch (e2) {
            logger.warn("sendReceipt failed:", e2);
          }
        }
      }
    }

    // Atualiza na base todos os registros
    await Message.update(
      { read: true },
      {
        where: {
          ticketId: ticket.id,
          read: false
        }
      }
    );
  } catch (err) {
    logger.warn(
      `Could not mark messages as read. Maybe whatsapp session disconnected? Err: ${err}`
    );
  }

  // Evento para o frontend
  const io = getIO();
  io.to(`company-${ticket.companyId}-mainchannel`).emit(
    `company-${ticket.companyId}-ticket`,
    {
      action: "updateUnread",
      ticketId: ticket.id
    }
  );
};

export default SetTicketMessagesAsRead;