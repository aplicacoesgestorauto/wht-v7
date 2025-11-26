import AppError from "../../errors/AppError";
import QueueOption from "../../models/QueueOption";
import ShowService from "./ShowService";
import * as Yup from "yup";

interface QueueData {
  queueId?: number | null;
  title?: string;
  option?: string | null;
  message?: string;
  parentId?: number | null;
  mediaPath?: string;
  mediaName?: string;
}

const UpdateService = async (
  queueOptionId: number | string,
  queueOptionData: QueueData
): Promise<QueueOption> => {
  const queueOption = await ShowService(Number(queueOptionId));

  const { queueId, title, option, message, parentId, mediaPath, mediaName } = queueOptionData;

  const queueOptionSchema = Yup.object().shape({
    queueId: Yup.number().nullable(),
    title: Yup.string(),
    option: Yup.string().nullable(),
    message: Yup.string().nullable(),
    parentId: Yup.number().nullable(),
  });

  try {
    await queueOptionSchema.validate({ queueId, title, option, message, parentId });
  } catch (err: any) {
    throw new AppError(err.message);
  }

  await queueOption.update({
    queueId: queueId !== undefined ? (queueId === null ? null : Number(queueId)) : undefined,
    title,
    option: option !== undefined ? (option === null ? null : String(option)) : undefined,
    message,
    parentId: parentId !== undefined ? (parentId === null ? null : Number(parentId)) : undefined,
    mediaPath,
    mediaName
  });

  return queueOption;
};

export default UpdateService;
