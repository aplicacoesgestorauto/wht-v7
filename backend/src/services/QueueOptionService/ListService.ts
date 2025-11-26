import { WhereOptions } from "sequelize/types";
import QueueOption from "../../models/QueueOption";

type QueueOptionFilter = {
  queueId?: string | number;
  queueOptionId?: string | number;
  parentId?: number | null;
};

const ListService = async ({ queueId, queueOptionId, parentId }: QueueOptionFilter): Promise<QueueOption[]> => {
  const whereOptions: WhereOptions = {};

  if (queueId) {
    whereOptions.queueId = Number(queueId);
  }

  if (queueOptionId) {
    whereOptions.id = Number(queueOptionId);
  }

  if (parentId === -1) {
    whereOptions.parentId = null;
  }

  if (parentId && parentId > 0) {
    whereOptions.parentId = parentId;
  }

  const queueOptions = await QueueOption.findAll({
    where: whereOptions,
    order: [["id", "ASC"]]
  });

  return queueOptions;
};

export default ListService;
