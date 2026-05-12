import type { Timestamp, Firestore } from 'firebase/firestore'
import { doc, getDoc } from 'firebase/firestore'

export const toDate = (value: unknown): Date => {
  if (!value) return new Date(0)
  if (value instanceof Date) return value
  if (typeof value === 'object' && 'toDate' in (value as Timestamp)) {
    return (value as Timestamp).toDate()
  }
  return new Date(value as string)
}

export const slugify = (text: string): string => {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

export const generateReadableId = async (
  db: Firestore,
  collectionName: string,
  prefix: string,
  identifier: string,
): Promise<string> => {
  const slug = slugify(identifier)
  const base = `${prefix}_${slug}`
  let num = 1
  while (num < 1000) {
    const candidateId = `${base}_${num}`
    const docSnap = await getDoc(doc(db, collectionName, candidateId))
    if (!docSnap.exists()) return candidateId
    num++
  }
  return `${base}_${Date.now()}`
}
