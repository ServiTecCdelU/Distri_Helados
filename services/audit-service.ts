// services/audit-service.ts
import { collection, doc, setDoc, getDocs, query, orderBy, limit, where, Timestamp } from "firebase/firestore";
import { firestore } from "@/lib/firebase";
import type { AuditAction, AuditEntry } from "@/lib/types";
import { toDate, generateReadableId } from "@/services/firestore-helpers";

const AUDIT_COLLECTION = "auditoria";

export const logAudit = async (entry: {
  action: AuditAction;
  userId: string;
  userName: string;
  description: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, any>;
}) => {
  try {
    const docId = await generateReadableId(firestore, AUDIT_COLLECTION, 'auditoria', entry.userName)
    await setDoc(doc(firestore, AUDIT_COLLECTION, docId), {
      ...entry,
      createdAt: new Date(),
    });
  } catch (error) {
    // Audit should never break the main operation
    console.error("[Audit] Error logging:", error);
  }
};

export const getAuditLog = async (maxEntries = 100): Promise<AuditEntry[]> => {
  const snapshot = await getDocs(
    query(
      collection(firestore, AUDIT_COLLECTION),
      orderBy("createdAt", "desc"),
      limit(maxEntries),
    ),
  );

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      createdAt: toDate(data.createdAt),
    } as AuditEntry;
  });
};

export const getAuditByEntity = async (
  entityType: string,
  entityId: string,
): Promise<AuditEntry[]> => {
  const snapshot = await getDocs(
    query(
      collection(firestore, AUDIT_COLLECTION),
      where("entityType", "==", entityType),
      where("entityId", "==", entityId),
      orderBy("createdAt", "desc"),
    ),
  );

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      createdAt: toDate(data.createdAt),
    } as AuditEntry;
  });
};
