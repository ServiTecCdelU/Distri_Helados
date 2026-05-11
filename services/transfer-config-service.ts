// services/transfer-config-service.ts
import { doc, getDoc, setDoc } from "firebase/firestore";
import { firestore } from "@/lib/firebase";

export interface TransferConfig {
  alias: string;
  titular: string;
  banco: string;
}

const DOC_REF = doc(firestore, "configuracion", "transferencia");

export async function getTransferConfig(): Promise<TransferConfig> {
  const snap = await getDoc(DOC_REF);
  if (snap.exists()) {
    const data = snap.data();
    return {
      alias: data.alias || "",
      titular: data.titular || "",
      banco: data.banco || "",
    };
  }
  return { alias: "", titular: "", banco: "" };
}

export async function saveTransferConfig(config: TransferConfig): Promise<void> {
  await setDoc(DOC_REF, config, { merge: true });
}
