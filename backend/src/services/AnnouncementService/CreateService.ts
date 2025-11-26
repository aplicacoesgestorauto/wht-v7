import * as Yup from "yup";
import AppError from "../../errors/AppError";
import Announcement from "../../models/Announcement";

interface Data {
  priority: number; // Alterado para number
  title: string;
  text: string;
  status: boolean;
  companyId: number;
}

const CreateService = async (data: Data): Promise<Announcement> => {
  const { title, text, status, priority, companyId } = data; // Adicionado priority e companyId

  const ticketnoteSchema = Yup.object().shape({
    title: Yup.string().required("ERR_ANNOUNCEMENT_REQUIRED"),
    text: Yup.string().required("ERR_ANNOUNCEMENT_REQUIRED"),
    priority: Yup.number().required("ERR_ANNOUNCEMENT_REQUIRED"), // Validando priority como number
    status: Yup.boolean().required("ERR_ANNOUNCEMENT_REQUIRED") // Validando status como boolean
  });

  try {
    await ticketnoteSchema.validate({ title, text, priority, status });
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const record = await Announcement.create({ ...data, priority: Number(priority), status: Boolean(status) });

  return record;
};

export default CreateService;
