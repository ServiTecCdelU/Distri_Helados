import { NextRequest, NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/supabase-auth-helper";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuthToken(request);
    if (!user) {
      return NextResponse.json({ message: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { saleId } = body;

    if (!saleId) {
      return NextResponse.json({ message: "Falta saleId" }, { status: 400 });
    }

    // Verificar que la venta existe
    const { data: venta, error: ventaError } = await supabaseAdmin
      .from('ventas')
      .select('id')
      .eq('id', saleId)
      .single();

    if (ventaError || !venta) {
      return NextResponse.json({ message: "Venta no encontrada" }, { status: 404 });
    }

    // Generar número de remito secuencial
    const { data: lastRemitoData } = await supabaseAdmin
      .from('ventas')
      .select('remito_number')
      .not('remito_number', 'is', null)
      .order('remito_number', { ascending: false })
      .limit(1);

    let lastNumber = 0;
    if (lastRemitoData && lastRemitoData.length > 0) {
      const lastRemito = lastRemitoData[0].remito_number;
      const match = lastRemito?.match(/R-\d+-(\d+)/);
      if (match) lastNumber = parseInt(match[1], 10);
    }

    const remitoNumber = `R-${new Date().getFullYear()}-${String(lastNumber + 1).padStart(5, "0")}`;

    await supabaseAdmin.from('ventas').update({
      remito_number: remitoNumber,
    }).eq('id', saleId);

    return NextResponse.json({
      success: true,
      remitoNumber,
      message: "Número de remito asignado. Genere el PDF desde el frontend.",
    });

  } catch (error: any) {
    console.error("Error:", error);
    return NextResponse.json(
      { message: "Error interno", error: error.message },
      { status: 500 }
    );
  }
}