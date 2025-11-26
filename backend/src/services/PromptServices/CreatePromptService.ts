import AppError from "../../errors/AppError";
import Prompt from "../../models/Prompt";
import * as Yup from "yup";

interface PromptData {
  name: string;
  apiKey: string;
  prompt: string;
  maxTokens: number;
  temperature: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  queueId: number;
  maxMessages: number;
  companyId: number;
  voice: string;
  voiceKey: string;
  voiceRegion: string;
}

const CreatePromptService = async (data: PromptData): Promise<Prompt> => {
  const { name, apiKey, prompt, maxTokens, temperature, promptTokens, completionTokens, totalTokens, queueId, maxMessages, companyId, voice, voiceKey, voiceRegion } = data;

  const promptSchema = Yup.object().shape({
    name: Yup.string().required(),
    apiKey: Yup.string().required(),
    prompt: Yup.string().required(),
    maxTokens: Yup.number().required(),
    temperature: Yup.number().required(),
    promptTokens: Yup.number().required(),
    completionTokens: Yup.number().required(),
    totalTokens: Yup.number().required(),
    queueId: Yup.number().required(),
    maxMessages: Yup.number().required(),
    companyId: Yup.number().required(),
    voice: Yup.string().required(),
    voiceKey: Yup.string().required(),
    voiceRegion: Yup.string().required(),
  });

  try {
    await promptSchema.validate({ name, apiKey, prompt, maxTokens, temperature, promptTokens, completionTokens, totalTokens, queueId, maxMessages, companyId, voice, voiceKey, voiceRegion });
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const promptTable = await Prompt.create({
    ...data,
    companyId: Number(data.companyId)
  });

  return promptTable;
};

export default CreatePromptService;
