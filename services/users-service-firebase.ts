import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore'
import { firestore } from '@/lib/firebase'
import type { User, UserRole, EmployeeType } from '@/lib/types'
import { toDate, generateReadableId } from '@/services/firestore-helpers'

const USERS_COLLECTION = 'usuarios'

export const getUserProfile = async (userId: string): Promise<User | null> => {
  // Primero buscar por doc ID directo (usuarios legacy con Auth UID)
  const snapshot = await getDoc(doc(firestore, USERS_COLLECTION, userId))
  if (snapshot.exists()) {
    const data = snapshot.data()
    return {
      id: snapshot.id,
      email: data.email,
      name: data.name,
      role: data.role as UserRole,
      sellerId: data.sellerId,
      employeeType: data.employeeType as EmployeeType | undefined,
      isActive: data.isActive ?? true,
      createdAt: toDate(data.createdAt),
    }
  }

  // Buscar por authUid (usuarios nuevos con ID legible)
  const q = query(collection(firestore, USERS_COLLECTION), where('authUid', '==', userId))
  const querySnapshot = await getDocs(q)
  if (querySnapshot.empty) return null

  const docSnap = querySnapshot.docs[0]
  const data = docSnap.data()
  return {
    id: docSnap.id,
    email: data.email,
    name: data.name,
    role: data.role as UserRole,
    employeeType: data.employeeType as EmployeeType | undefined,
    sellerId: data.sellerId,
    isActive: data.isActive ?? true,
    createdAt: toDate(data.createdAt),
  }
}

export const ensureUserProfile = async (data: {
  id: string
  email: string
  name: string
  role?: UserRole
}): Promise<User> => {
  // Siempre chequear si el email coincide con un vendedor registrado
  const sellersSnapshot = await getDocs(
    query(collection(firestore, 'vendedores'), where('email', '==', data.email))
  )
  const matchingSellerDoc = sellersSnapshot.docs[0]
  const matchingSeller = matchingSellerDoc?.id
  const matchingEmployeeType = matchingSellerDoc?.data()?.employeeType as EmployeeType | undefined

  const existing = await getUserProfile(data.id)
  if (existing) {
    // Si existe un perfil pero el rol no es seller/admin y ahora hay un vendedor vinculado,
    // actualizar el perfil para darle acceso como vendedor
    if (matchingSeller && existing.role !== 'seller' && existing.role !== 'admin') {
      await updateDoc(doc(firestore, USERS_COLLECTION, existing.id), {
        role: 'seller',
        sellerId: matchingSeller,
        employeeType: matchingEmployeeType ?? null,
      })
      return {
        ...existing,
        role: 'seller',
        sellerId: matchingSeller,
        employeeType: matchingEmployeeType,
      }
    }
    // Si ya es seller pero le falta el sellerId o cambió, sincronizar
    if (matchingSeller && existing.role === 'seller' && existing.sellerId !== matchingSeller) {
      await updateDoc(doc(firestore, USERS_COLLECTION, existing.id), {
        sellerId: matchingSeller,
        employeeType: matchingEmployeeType ?? existing.employeeType ?? null,
      })
      return {
        ...existing,
        sellerId: matchingSeller,
        employeeType: matchingEmployeeType ?? existing.employeeType,
      }
    }
    return existing
  }

  const docId = await generateReadableId(firestore, USERS_COLLECTION, 'usuario', data.name)

  // Si el email coincide con un vendedor/empleado, asignar rol 'seller' automáticamente
  const autoRole: UserRole = matchingSeller ? 'seller' : (data.role ?? 'customer')

  const profile: User = {
    id: docId,
    email: data.email,
    name: data.name,
    role: autoRole,
    sellerId: matchingSeller,
    employeeType: matchingEmployeeType,
    isActive: true,
    createdAt: new Date(),
  }

  await setDoc(doc(firestore, USERS_COLLECTION, docId), {
    authUid: data.id,
    email: profile.email,
    name: profile.name,
    role: autoRole,
    sellerId: profile.sellerId ?? null,
    employeeType: profile.employeeType ?? null,
    isActive: profile.isActive,
    createdAt: serverTimestamp(),
  })

  return profile
}
