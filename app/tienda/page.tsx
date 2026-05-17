// app/tienda/page.tsx
// Página de tienda/inicio deshabilitada - solo existe el panel admin
import { redirect } from "next/navigation";

export default function TiendaPage() {
  redirect("/caja");
}
