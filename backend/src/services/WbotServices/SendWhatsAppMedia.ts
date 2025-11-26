import { WAMessage, AnyMessageContent } from "@whiskeysockets/baileys";
import * as Sentry from "@sentry/node";
import fs from "fs";
import { exec } from "child_process";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import AppError from "../../errors/AppError";
import GetTicketWbot from "../../helpers/GetTicketWbot";
import Ticket from "../../models/Ticket";
import mime from "mime-types";

import ffmpegPath from "ffmpeg-static";
import formatBody from "../../helpers/Mustache";

interface Request {
  media: Express.Multer.File;
  ticket: Ticket;
  companyId?: number;
  body?: string;
  isForwarded?: boolean;
}

ffmpeg.setFfmpegPath(ffmpegPath);

const publicFolder = path.resolve(
  __dirname,
  "..",
  "..",
  "..",
  "public"
);

const processAudio = async (
  audio: string,
  companyId: string
): Promise<string> => {
  const outputAudio = `${publicFolder}/company${companyId}/${Date.now()}.ogg`;
  return new Promise((resolve, reject) => {
    exec(
      `${ffmpegPath} -i "${audio}" -vn -c:a libopus -b:a 128k "${outputAudio}" -y`,
      (error) => {
        if (error) reject(error);
        fs.unlinkSync(audio);
        resolve(outputAudio);
      }
    );
  });
};

export const getMessageOptions = async (
  fileName: string,
  pathMedia: string,
  companyId?: string,
  body: string = ""
): Promise<AnyMessageContent | null> => {
  try {
    const mimeType = mime.lookup(pathMedia);
    if (!mimeType) throw new Error("Invalid mimetype");

    const typeMessage = mimeType.split("/")[0];
    const buffer = fs.readFileSync(pathMedia);

    if (typeMessage === "video") {
      return {
        video: buffer,
        caption: body,
        fileName,
        mimetype: mimeType
      };
    }

    if (typeMessage === "audio") {
      const converted = await processAudio(pathMedia, companyId);
      return {
        audio: fs.readFileSync(converted),
        mimetype: "audio/ogg; codecs=opus",
        ptt: true
      };
    }

    if (typeMessage === "image") {
      return {
        image: buffer,
        caption: body
      };
    }

    return {
      document: buffer,
      fileName,
      caption: body,
      mimetype: mimeType
    };
  } catch (e) {
    Sentry.captureException(e);
    return null;
  }
};

const SendWhatsAppMedia = async ({
  media,
  ticket,
  body,
  isForwarded = false
}: Request): Promise<WAMessage> => {
  try {
    const wbot = await GetTicketWbot(ticket);
    const jid = `${ticket.contact.number}@${
      ticket.isGroup ? "g.us" : "s.whatsapp.net"
    }`;

    const pathMedia = media.path;
    const mimeType = media.mimetype;
    const fileName = media.originalname.replace("/", "-");
    const bodyMessage = formatBody(body, ticket.contact);

    const buffer = fs.readFileSync(pathMedia);
    const type = mimeType.split("/")[0];

    let options: AnyMessageContent;

    if (type === "image") {
      options = {
        image: buffer,
        caption: bodyMessage,
        contextInfo: {
          forwardingScore: isForwarded ? 2 : 0,
          isForwarded
        }
      };
    } else if (type === "video") {
      options = {
        video: buffer,
        caption: bodyMessage,
        fileName,
        mimetype: mimeType,
        contextInfo: {
          forwardingScore: isForwarded ? 2 : 0,
          isForwarded
        }
      };
    } else if (type === "audio") {
      const audioConverted = await processAudio(pathMedia, ticket.companyId.toString());
      options = {
        audio: fs.readFileSync(audioConverted),
        ptt: true,
        mimetype: "audio/ogg; codecs=opus",
        contextInfo: {
          forwardingScore: isForwarded ? 2 : 0,
          isForwarded
        }
      };
    } else {
      // documento
      options = {
        document: buffer,
        caption: bodyMessage,
        fileName,
        mimetype: mimeType,
        contextInfo: {
          forwardingScore: isForwarded ? 2 : 0,
          isForwarded
        }
      };
    }

    const sentMessage = await wbot.sendMessage(jid, options);
    await ticket.update({ lastMessage: bodyMessage });

    return sentMessage;
  } catch (err) {
    Sentry.captureException(err);
    console.error(err);
    throw new AppError("ERR_SENDING_WAPP_MSG");
  }
};

export default SendWhatsAppMedia;