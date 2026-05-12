// services/price-list-service.ts
import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
} from "firebase/firestore";
import { firestore } from "@/lib/firebase";
import type { PriceList } from "@/lib/types";
import { toDate, generateReadableId } from "@/services/firestore-helpers";

const COLLECTION = "listas_precios";

export const getPriceLists = async (): Promise<PriceList[]> => {
  const snapshot = await getDocs(
    query(collection(firestore, COLLECTION), orderBy("createdAt", "desc")),
  );
  return snapshot.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      ...data,
      createdAt: toDate(data.createdAt),
    } as PriceList;
  });
};

export const createPriceList = async (
  data: Omit<PriceList, "id" | "createdAt">,
): Promise<PriceList> => {
  const docId = await generateReadableId(firestore, COLLECTION, 'lista', data.name)
  await setDoc(doc(firestore, COLLECTION, docId), {
    ...data,
    createdAt: new Date(),
  });
  return { id: docId, ...data, createdAt: new Date() };
};

export const updatePriceList = async (
  id: string,
  updates: Partial<PriceList>,
): Promise<void> => {
  await updateDoc(doc(firestore, COLLECTION, id), updates);
};

export const deletePriceList = async (id: string): Promise<void> => {
  await deleteDoc(doc(firestore, COLLECTION, id));
};

// Calculate price for a product given a price list
export const calculatePrice = (
  basePrice: number,
  priceList: PriceList | null,
): number => {
  if (!priceList || !priceList.isActive) return basePrice;
  return Math.round(basePrice * priceList.multiplier);
};
