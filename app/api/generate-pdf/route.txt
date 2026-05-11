import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  let browser;

  try {
    console.log("📄 [PDF API] Iniciando generación...");

    const body = await request.json();
    const { html, filename } = body;

    if (!html) {
      return NextResponse.json(
        { error: "HTML no proporcionado" },
        { status: 400 },
      );
    }

    console.log("📄 [PDF API] Lanzando Puppeteer...");

    const isProduction = process.env.NODE_ENV === "production";
    const isVercel = !!process.env.VERCEL;

    if (isProduction && isVercel) {
      console.log("📄 [PDF API] Modo VERCEL - Configuración especial de Chromium");
      
      const chromium = (await import("@sparticuz/chromium")).default;
      const puppeteerCore = (await import("puppeteer-core")).default;

      const executablePath = await chromium.executablePath(
        `https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar`
      );

      console.log("📄 [PDF API] Executable path:", executablePath);

      browser = await puppeteerCore.launch({
        args: [
          ...chromium.args,
          "--disable-gpu",
          "--disable-dev-shm-usage",
          "--disable-setuid-sandbox",
          "--no-sandbox",
          "--no-zygote",
          "--single-process",
        ],
        defaultViewport: chromium.defaultViewport,
        executablePath: executablePath,
        headless: true,
      });
    } else {
      console.log("📄 [PDF API] Modo DESARROLLO - Usando Puppeteer local");
      const puppeteerFull = (await import("puppeteer")).default;
      browser = await puppeteerFull.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
    }

    console.log("📄 [PDF API] Creando página...");
    const page = await browser.newPage();

    await page.setViewport({
      width: 794,
      height: 1123,
    });

    console.log("📄 [PDF API] Cargando HTML...");

    await page.setContent(html, {
      waitUntil: ["load", "networkidle0"],
      timeout: 30000,
    });

    console.log("📄 [PDF API] Generando PDF...");

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
      },
      preferCSSPageSize: true,
    });

    console.log(`✅ [PDF API] PDF generado, tamaño: ${pdfBuffer.length} bytes`);

    const pdfBase64 = Buffer.from(pdfBuffer).toString("base64");

    await browser.close();

    return NextResponse.json({
      success: true,
      pdf: pdfBase64,
      filename: filename || "document.pdf",
      size: pdfBuffer.length,
    });
  } catch (error: any) {
    console.error("❌ [PDF API] Error:", error);

    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error("Error cerrando navegador:", closeError);
      }
    }

    return NextResponse.json(
      {
        error: error.message || "Error generando PDF",
        details: error.toString(),
      },
      { status: 500 },
    );
  }
}