import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";
import { google } from "googleapis";
import { Readable } from "stream";

export async function POST(req: NextRequest) {
  try {
    // Verificar auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    try {
      await adminAuth.verifyIdToken(authHeader.substring(7));
    } catch {
      return NextResponse.json({ error: "Token invalido" }, { status: 401 });
    }

    const { base64, filename } = await req.json();

    const auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
    );

    auth.setCredentials({
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    });

    const drive = google.drive({ version: "v3", auth });

    const buffer = Buffer.from(base64, "base64");
    const stream = Readable.from(buffer);

    const response = await drive.files.create({
      requestBody: {
        name: filename,
        mimeType: "application/pdf",
        parents: [process.env.GOOGLE_DRIVE_FOLDER_ID!],
      },
      media: {
        mimeType: "application/pdf",
        body: stream,
      },
      fields: "id",
    });

    const fileId = response.data.id!;

    await drive.permissions.create({
      fileId,
      requestBody: {
        role: "reader",
        type: "anyone",
      },
    });

    const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
    return NextResponse.json({ downloadUrl, fileId });
  } catch (error: any) {
    console.error("[Drive] Error:", error.message);
    return NextResponse.json({ error: "Error al subir archivo" }, { status: 500 });
  }
}