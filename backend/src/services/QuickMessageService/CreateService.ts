import * as Yup from "yup";
import AppError from "../../errors/AppError";
import QuickMessage from "../../models/QuickMessage";

interface Data {
  shortcode: string;
  message: string;
  companyId: number;
  userId: number;
  geral: boolean;  
}

const CreateService = async (data: Data): Promise<QuickMessage> => {
  const { shortcode, message, geral, companyId, userId } = data;

  const ticketnoteSchema = Yup.object().shape({
    shortcode: Yup.string()
      .min(3, "ERR_QUICKMESSAGE_INVALID_NAME")
      .required("ERR_QUICKMESSAGE_REQUIRED"),
    message: Yup.string()
      .min(3, "ERR_QUICKMESSAGE_INVALID_NAME")
      .required("ERR_QUICKMESSAGE_REQUIRED")
  });

  try {
    await ticketnoteSchema.validate({ shortcode, message });
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const record = await QuickMessage.create({ ...data, companyId: Number(companyId), userId: Number(userId) });

  return record;
};

export default CreateService;
