import * as Yup from "yup";

import AppError from "../../errors/AppError";
import Schedule from "../../models/Schedule";
import Contact from "../../models/Contact";

interface Request {
  body: string;
  sendAt: Date;
  contactId: number;
  companyId: number;
  userId?: number;
  geral?: boolean;
  queueId?: number;
  whatsappId?: number;
  mediaPath: string | null | undefined;
  mediaName: string | null | undefined;
  repeatEvery?:string;
  selectDaysRecorrenci?: string;
  repeatCount?:string;
}

const CreateService = async ({
  body,
  sendAt,
  contactId,
  companyId,
  userId,
  geral,
  queueId,
  whatsappId,
  mediaPath,
  mediaName,
  repeatEvery,
  selectDaysRecorrenci,
  repeatCount,
}: Request): Promise<Schedule> => {
  const schema = Yup.object().shape({
    body: Yup.string().required().min(5),
    sendAt: Yup.date().required()
  });

  try {
    await schema.validate({ body, sendAt });
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const contact = await Contact.findByPk(Number(contactId));

  const schedule = await Schedule.create(
    {
      body,
      sendAt: new Date(sendAt),
      contactId: Number(contactId),
      companyId: Number(companyId),
      userId: userId ? Number(userId) : undefined,
      status: 'PENDENTE',
      geral,
  	  queueId,
      whatsappId,
      mediaPath,
      mediaName,
      repeatEvery,
      selectDaysRecorrenci,
      repeatCount,
    }
  );

  await schedule.reload({ include: [Contact] });

  return schedule;
};

export default CreateService;
