import { Op } from "sequelize";
import TicketTraking from "../../models/TicketTraking";

interface Params {
  ticketId: number;
  companyId: number;
  whatsappId?: number;
  userId?: number;
}

const FindOrCreateATicketTrakingService = async ({
  ticketId,
  companyId,
  whatsappId,
  userId
}: Params): Promise<TicketTraking> => {
  const ticketTraking = await TicketTraking.findOne({
    where: {
      ticketId: Number(ticketId),
      finishedAt: {
        [Op.is]: null
      }
    }
  });

  if (ticketTraking) {
    return ticketTraking;
  }

  const newRecord = await TicketTraking.create({
    ticketId: Number(ticketId),
    companyId: Number(companyId),
    whatsappId: whatsappId ? Number(whatsappId) : undefined,
    userId: userId ? Number(userId) : undefined
  });

  return newRecord;
};

export default FindOrCreateATicketTrakingService;
