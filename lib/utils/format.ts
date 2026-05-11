// lib/utils/format.ts
// Utilidades de formato centralizadas — evitar duplicación entre componentes

import { toDate } from "@/services/firestore-helpers";

const currencyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 0,
});

const currencyFormatterDecimals = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const timeFormatter = new Intl.DateTimeFormat("es-AR", {
  hour: "2-digit",
  minute: "2-digit",
});

export const formatCurrency = (amount: number): string => {
  const safe = typeof amount === "number" && !isNaN(amount) ? amount : 0;
  return currencyFormatter.format(safe);
};

export const formatCurrencyDecimals = (amount: number): string => {
  const safe = typeof amount === "number" && !isNaN(amount) ? amount : 0;
  return currencyFormatterDecimals.format(safe);
};

export const formatDate = (date: unknown): string => {
  if (!date) return "-";
  try {
    const d = toDate(date);
    if (isNaN(d.getTime()) || d.getTime() === 0) return "-";
    return dateFormatter.format(d);
  } catch {
    return "-";
  }
};

export const formatDateTime = (date: unknown): string => {
  if (!date) return "-";
  try {
    const d = toDate(date);
    if (isNaN(d.getTime()) || d.getTime() === 0) return "-";
    return dateTimeFormatter.format(d);
  } catch {
    return "-";
  }
};

export const formatTime = (date: unknown): string => {
  if (!date) return "--:--";
  try {
    const d = toDate(date);
    if (isNaN(d.getTime()) || d.getTime() === 0) return "--:--";
    return timeFormatter.format(d);
  } catch {
    return "--:--";
  }
};

export const formatPrice = (price: number): string => formatCurrency(price);

// Deja solo digitos de un CUIT/CUIL (acepta "20-12345678-9", "20.12.345.678.9", "20123456789", etc.)
export const normalizeCuit = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\D/g, "");
};

// Formatea un CUIT/CUIL como "XX-XXXXXXXX-X" si tiene 11 digitos, si no devuelve lo que llego sin simbolos
export const formatCuit = (value: unknown): string => {
  const digits = normalizeCuit(value);
  if (digits.length === 11) {
    return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;
  }
  return digits;
};
