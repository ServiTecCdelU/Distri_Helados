import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
  query,
  orderBy,
  limit,
  startAfter,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { firestore } from "@/lib/firebase";
import type { Product } from "@/lib/types";
import { toDate, generateReadableId } from "@/services/firestore-helpers";

const PRODUCTS_COLLECTION = "productos";

export const getProducts = async (): Promise<Product[]> => {
  const snapshot = await getDocs(collection(firestore, PRODUCTS_COLLECTION))

  return snapshot.docs
    .map((docSnap) => {
      const data = docSnap.data()

      return {
        id: docSnap.id,
        name: data.name,
        description: data.description,
        price: data.price,
        stock: data.stock,
        imageUrl: data.imageUrl,
        category: data.category,

        // 👇 ESTO ES LO NUEVO
        base: data.base ?? 'crema',
        marca: data.marca ?? 'Sin identificar',
        sinTacc: data.sinTacc ?? false,
        disabled: data.disabled ?? false,

        createdAt: toDate(data.createdAt),
      }
    })
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
}


export const getProductById = async (id: string): Promise<Product | undefined> => {
  const snapshot = await getDoc(doc(firestore, PRODUCTS_COLLECTION, id))
  if (!snapshot.exists()) return undefined

  const data = snapshot.data()

  return {
    id: snapshot.id,
    name: data.name,
    description: data.description,
    price: data.price,
    stock: data.stock,
    imageUrl: data.imageUrl,
    category: data.category,

    // 👇 TAMBIÉN ACÁ
    base: data.base ?? 'crema',
    marca: data.marca ?? 'Sin identificar',
    sinTacc: data.sinTacc ?? false,
    disabled: data.disabled ?? false,

    createdAt: toDate(data.createdAt),
  }
}


export const createProduct = async (
  product: Omit<Product, "id" | "createdAt">
): Promise<Product> => {
  const docId = await generateReadableId(firestore, PRODUCTS_COLLECTION, 'producto', product.name)
  await setDoc(doc(firestore, PRODUCTS_COLLECTION, docId), {
    ...product,
    disabled: product.disabled ?? false,
    createdAt: serverTimestamp(),
  });

  return {
    ...product,
    id: docId,
    disabled: product.disabled ?? false,
    createdAt: new Date(),
  };
};

export const updateProduct = async (
  id: string,
  updates: Partial<Product>
): Promise<Product> => {
  await updateDoc(doc(firestore, PRODUCTS_COLLECTION, id), {
    ...updates,
  });

  const updated = await getProductById(id);
  if (!updated) throw new Error("Product not found");

  return updated;
};

export const deleteProduct = async (id: string): Promise<void> => {
  await deleteDoc(doc(firestore, PRODUCTS_COLLECTION, id));
};

export const getProductsPaginated = async (
  pageSize: number = 50,
  lastDoc?: QueryDocumentSnapshot,
): Promise<{ data: Product[]; lastDoc: QueryDocumentSnapshot | null; hasMore: boolean }> => {
  let q = query(
    collection(firestore, PRODUCTS_COLLECTION),
    orderBy("createdAt", "desc"),
    limit(pageSize),
  );

  if (lastDoc) {
    q = query(
      collection(firestore, PRODUCTS_COLLECTION),
      orderBy("createdAt", "desc"),
      startAfter(lastDoc),
      limit(pageSize),
    );
  }

  const snapshot = await getDocs(q);
  const data = snapshot.docs.map((docSnap) => {
    const d = docSnap.data();
    return {
      id: docSnap.id,
      name: d.name,
      description: d.description,
      price: d.price,
      stock: d.stock,
      imageUrl: d.imageUrl,
      category: d.category,
      base: d.base ?? 'crema',
      marca: d.marca ?? 'Sin identificar',
      sinTacc: d.sinTacc ?? false,
      disabled: d.disabled ?? false,
      createdAt: toDate(d.createdAt),
    } as Product;
  });
  const lastVisible = snapshot.docs[snapshot.docs.length - 1] || null;

  return {
    data,
    lastDoc: lastVisible,
    hasMore: snapshot.docs.length === pageSize,
  };
};
