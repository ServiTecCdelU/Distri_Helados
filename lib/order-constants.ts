// lib/order-constants.ts
import type { OrderStatus } from "@/types";
import { Clock, Box, Truck, CheckCircle } from "lucide-react";

export const statusConfig: Record<
  OrderStatus,
  {
    label: string;
    color: string;
    dotColor: string;
    bgColor: string;
    borderColor: string;
    icon?: any;
  }
> = {
  pending: {
    label: "Pendiente",
    color: "text-amber-700",
    dotColor: "bg-amber-500",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
    icon: Clock,
  },
  preparation: {
    label: "Preparación",
    color: "text-blue-700",
    dotColor: "bg-blue-500",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    icon: Box,
  },
  delivery: {
    label: "En Reparto",
    color: "text-orange-700",
    dotColor: "bg-orange-500",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-200",
    icon: Truck,
  },
  completed: {
    label: "Completado",
    color: "text-green-700",
    dotColor: "bg-green-500",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
    icon: CheckCircle,
  },
};

export const statusFlow: OrderStatus[] = [
  "pending",
  "preparation",
  "delivery",
  "completed",
];