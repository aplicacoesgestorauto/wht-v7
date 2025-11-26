import {
  proto,
  BufferJSON,
  initAuthCreds,
  type AuthenticationState,
  type AuthenticationCreds,
  type SignalDataTypeMap
} from "@whiskeysockets/baileys";

import Whatsapp from "../models/Whatsapp";

export const authState = async (
  whatsapp: Whatsapp
): Promise<{ state: AuthenticationState; saveState: () => Promise<void> }> => {
  let creds: AuthenticationCreds;
  let keys: any = {};

  // -------------------------------
  // 1. RESTAURAR CREDENCIAIS DO BANCO
  // -------------------------------
  if (whatsapp.session) {
    try {
      const parsed = JSON.parse(whatsapp.session, BufferJSON.reviver);
      creds = parsed.creds;
      keys = parsed.keys ?? {};
    } catch (error) {
      console.error("Erro ao carregar sessão:", error);
      creds = initAuthCreds();
      keys = {};
    }
  } else {
    creds = initAuthCreds();
    keys = {};
  }

  // -------------------------------
  // 2. SALVAR NOVO ESTADO NO BANCO
  // -------------------------------
  const saveState = async () => {
    try {
      await whatsapp.update({
        session: JSON.stringify({ creds, keys }, BufferJSON.replacer)
      });
    } catch (err) {
      console.error("Erro ao salvar sessão:", err);
    }
  };

  // -------------------------------
  // 3. ESTRUTURA DE STATE COMPATÍVEL COM BAILEYS 7.x
  // -------------------------------
  return {
    state: {
      creds,
      keys: {
        get: (type: keyof SignalDataTypeMap, ids: string[]) => {
          const data = keys[type] || {};
          return ids.reduce((result: any, id: string) => {
            let val = data[id];
            if (val) {
              // converter para Protobuf correto
              if (type === "app-state-sync-key") {
                val = proto.Message.AppStateSyncKeyData.fromObject(val);
              }
              result[id] = val;
            }
            return result;
          }, {});
        },

        set: (newData: any) => {
          for (const type in newData) {
            keys[type] = keys[type] || {};
            Object.assign(keys[type], newData[type]);
          }
          saveState();
        }
      }
    },
    saveState
  };
};

export default authState;