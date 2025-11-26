import { sign, SignOptions } from "jsonwebtoken";
import authConfig from "../config/auth";
import User from "../models/User";

export const createAccessToken = (user: User): string => {
  const { secret, expiresIn } = authConfig;

  return sign(
    {
      usarname: user.name,
      profile: user.profile,
      id: user.id,
      companyId: user.companyId
    },
    secret as string, // Explicitly cast to string
    {
      expiresIn: expiresIn as SignOptions['expiresIn']
    }
  );
};

export const createRefreshToken = (user: User): string => {
  const { refreshSecret, refreshExpiresIn } = authConfig;

  return sign(
    { id: user.id, tokenVersion: user.tokenVersion, companyId: user.companyId },
    refreshSecret as string, // Explicitly cast to string
    {
      expiresIn: refreshExpiresIn as SignOptions['expiresIn']
    }
  );
};
