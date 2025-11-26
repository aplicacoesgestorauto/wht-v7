import * as Yup from "yup";

import AppError from "../../errors/AppError";
import Schedule from "../../models/Schedule";
import ShowService from "./ShowService";

interface ScheduleData {
  id?: number;
  body?: string;
  sendAt?: Date;
  sentAt?: Date;
  contactId?: number;
  companyId?: number;
  ticketId?: number;
  userId?: number;
  geral?: boolean
  queueId?: number;
  whatsappId?: number;
  repeatEvery?:string;
  repeatDailyInput?:string;
  repeatCount?:string;
  selectDaysRecorrenci?: string;
}

interface Request {
  scheduleData: ScheduleData;
  id: number;
  companyId: number;
  mediaPath: string | null | undefined;
  mediaName: string | null | undefined;
}

const UpdateUserService = async ({
  scheduleData,
  id,
  companyId,
  mediaPath,
  mediaName,
}: Request): Promise<Schedule | undefined> => {
  const schedule = await ShowService(Number(id), companyId);

  if (schedule?.companyId !== companyId) {
    throw new AppError("Não é possível alterar registros de outra empresa");
  }

  const schema = Yup.object().shape({
    body: Yup.string().min(5),
    sendAt: Yup.date().nullable(), // Allow null for optional Date field
    sentAt: Yup.date().nullable() // Allow null for optional Date field
  });

  const {
    body,
    sendAt,
    sentAt,
    contactId,
    ticketId,
    userId,
    geral,
    queueId,
    whatsappId,
    repeatEvery,
    selectDaysRecorrenci,
    repeatCount,
  } = scheduleData;

  try {
    await schema.validate({ body, sendAt, sentAt });
  } catch (err: any) {
    throw new AppError(err.message);
  }

  await schedule.update({
    body,
    sendAt: sendAt ? new Date(sendAt) : undefined,
    sentAt: sentAt ? new Date(sentAt) : undefined,
    contactId: contactId ? Number(contactId) : undefined,
    ticketId: ticketId ? Number(ticketId) : undefined,
    userId: userId ? Number(userId) : undefined,
    geral,
    queueId: queueId ? Number(queueId) : undefined,
    whatsappId: whatsappId ? Number(whatsappId) : undefined,
    mediaPath,
    mediaName,
    repeatEvery,
    selectDaysRecorrenci,
    repeatCount,
  });

  await schedule.reload();
  return schedule;
};

export default UpdateUserService;
