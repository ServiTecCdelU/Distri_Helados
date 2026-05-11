"use client";

import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

interface PageHeaderProps {
  /** Descripción / subtítulo (puede ser string o JSX dinámico) */
  description?: ReactNode;
  /** Mostrar botón de volver */
  backButton?: boolean;
  /** URL específica para el botón de volver; sin esta prop usa router.back() */
  backHref?: string;
  /** Elementos del lado derecho (botones de acción, toggles, etc.) */
  actions?: ReactNode;
  /** En mobile el header apila verticalmente (desc arriba, actions abajo) */
  stackOnMobile?: boolean;
}

export function PageHeader({
  description,
  backButton,
  backHref,
  actions,
  stackOnMobile = false,
}: PageHeaderProps) {
  const router = useRouter();

  const handleBack = () => {
    if (backHref) {
      router.push(backHref);
    } else {
      router.back();
    }
  };

  return (
    <div
      className={`flex mb-4 gap-3 ${
        stackOnMobile
          ? "flex-col sm:flex-row sm:items-center sm:justify-between"
          : "items-center justify-between"
      }`}
    >
      <div className="flex items-center gap-3">
        {backButton && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBack}
            aria-label="Volver"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        {description && (
          <div className="text-sm text-muted-foreground">{description}</div>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-1 sm:gap-2">{actions}</div>
      )}
    </div>
  );
}
