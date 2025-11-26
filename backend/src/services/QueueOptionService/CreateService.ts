import AppError from "../../errors/AppError";
import QueueOption from "../../models/QueueOption";
import * as Yup from "yup";

interface QueueOptionData {
  queueId: number;
  title: string;
  option: string; // Alterado de number para string
  parentId?: number;
}

const CreateService = async (data: QueueOptionData): Promise<QueueOption> => {
  const { queueId, title, option, parentId } = data;

  const queueOptionSchema = Yup.object().shape({
    queueId: Yup.number().required(),
    title: Yup.string().required(),
    option: Yup.string().required(),
    parentId: Yup.number().nullable()
  });

  try {
    await queueOptionSchema.validate({ queueId, title, option, parentId });
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const record = await QueueOption.create({
    ...data,
    queueId: Number(data.queueId), // Garantir que é number
    option: String(data.option) // Garantir que é string
  });

  return record;
};

export default CreateService;
