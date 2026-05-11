// lib/afip-direct.ts
// Integración directa con webservices AFIP (WSAA + WSFEv1)
// Reemplaza la intermediación de Bit Ingeniería para emisión de comprobantes

import crypto from "crypto";
import https from "https";

// Agente HTTPS con ciphers relajados — AFIP usa DH keys débiles
// que Node.js 18+ rechaza por defecto. Solo afecta conexiones a AFIP.
const afipAgent = new https.Agent({
  ciphers: "DEFAULT:@SECLEVEL=0",
});

/** fetch wrapper que usa el agente con SSL relajado para AFIP */
async function afipFetch(url: string, options: { method: string; headers: Record<string, string>; body: string }): Promise<{ status: number; text: () => Promise<string>; ok: boolean }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = https.request(
      {
        hostname: parsed.hostname,
        port: 443,
        path: parsed.pathname,
        method: options.method,
        headers: {
          ...options.headers,
          "Content-Length": Buffer.byteLength(options.body, "utf-8").toString(),
        },
        agent: afipAgent,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf-8");
          resolve({
            status: res.statusCode || 500,
            ok: (res.statusCode || 500) >= 200 && (res.statusCode || 500) < 300,
            text: async () => body,
          });
        });
      }
    );
    req.on("error", reject);
    req.write(options.body);
    req.end();
  });
}

// ══════════════════════════════════════════════════════════════
// Configuración
// ══════════════════════════════════════════════════════════════

const WSAA_URL = "https://wsaa.afip.gov.ar/ws/services/LoginCms";
const WSFEV1_URL = "https://servicios1.afip.gov.ar/wsfev1/service.asmx";
const CUIT = "20145983836";
const PTO_VTA = 10;
const SERVICE = "wsfe";

function loadPem(envVar: string): string {
  const raw = process.env[envVar] || "";
  return raw.includes("\\n") ? raw.replace(/\\n/g, "\n") : raw;
}

// ══════════════════════════════════════════════════════════════
// ASN.1 DER encoding helpers
// ══════════════════════════════════════════════════════════════

function derLength(len: number): Buffer {
  if (len < 0x80) return Buffer.from([len]);
  const bytes: number[] = [];
  let temp = len;
  while (temp > 0) {
    bytes.unshift(temp & 0xff);
    temp >>= 8;
  }
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}

function derWrap(tag: number, content: Buffer): Buffer {
  return Buffer.concat([Buffer.from([tag]), derLength(content.length), content]);
}

function derSequence(...items: Buffer[]): Buffer {
  return derWrap(0x30, Buffer.concat(items));
}

function derSet(...items: Buffer[]): Buffer {
  return derWrap(0x31, Buffer.concat(items));
}

function derOid(oidStr: string): Buffer {
  const parts = oidStr.split(".").map(Number);
  const bytes: number[] = [40 * parts[0] + parts[1]];
  for (let i = 2; i < parts.length; i++) {
    let value = parts[i];
    if (value < 128) {
      bytes.push(value);
    } else {
      const encoded: number[] = [];
      encoded.unshift(value & 0x7f);
      value >>= 7;
      while (value > 0) {
        encoded.unshift(0x80 | (value & 0x7f));
        value >>= 7;
      }
      bytes.push(...encoded);
    }
  }
  return derWrap(0x06, Buffer.from(bytes));
}

function derOctetString(data: Buffer): Buffer {
  return derWrap(0x04, data);
}

function derInteger(value: Buffer): Buffer {
  if (value.length > 0 && value[0] & 0x80) {
    value = Buffer.concat([Buffer.from([0x00]), value]);
  }
  return derWrap(0x02, value);
}

function derIntegerSmall(n: number): Buffer {
  if (n === 0) return derWrap(0x02, Buffer.from([0]));
  const hex = n.toString(16);
  const padded = hex.length % 2 ? "0" + hex : hex;
  return derInteger(Buffer.from(padded, "hex"));
}

function derNull(): Buffer {
  return Buffer.from([0x05, 0x00]);
}

function derUtcTime(date: Date): Buffer {
  const y = date.getUTCFullYear().toString().slice(-2);
  const mo = (date.getUTCMonth() + 1).toString().padStart(2, "0");
  const d = date.getUTCDate().toString().padStart(2, "0");
  const h = date.getUTCHours().toString().padStart(2, "0");
  const mi = date.getUTCMinutes().toString().padStart(2, "0");
  const s = date.getUTCSeconds().toString().padStart(2, "0");
  return derWrap(0x17, Buffer.from(`${y}${mo}${d}${h}${mi}${s}Z`));
}

// ══════════════════════════════════════════════════════════════
// OIDs
// ══════════════════════════════════════════════════════════════

const OID_SIGNED_DATA = "1.2.840.113549.1.7.2";
const OID_DATA = "1.2.840.113549.1.7.1";
const OID_SHA256 = "2.16.840.1.101.3.4.2.1";
const OID_RSA_ENCRYPTION = "1.2.840.113549.1.1.1";
const OID_CONTENT_TYPE = "1.2.840.113549.1.9.3";
const OID_SIGNING_TIME = "1.2.840.113549.1.9.5";
const OID_MESSAGE_DIGEST = "1.2.840.113549.1.9.4";

const SHA256_ALG_ID = derSequence(derOid(OID_SHA256), derNull());
const RSA_ALG_ID = derSequence(derOid(OID_RSA_ENCRYPTION), derNull());

// ══════════════════════════════════════════════════════════════
// Certificate DER parsing — extract issuer + serial
// ══════════════════════════════════════════════════════════════

interface DerElement {
  tag: number;
  length: number;
  valueOffset: number;
  totalLength: number;
}

function parseDerElement(buf: Buffer, offset: number): DerElement {
  const tag = buf[offset];
  const lenByte = buf[offset + 1];
  let length: number;
  let valueOffset: number;

  if (lenByte < 0x80) {
    length = lenByte;
    valueOffset = offset + 2;
  } else {
    const numLenBytes = lenByte & 0x7f;
    length = 0;
    for (let i = 0; i < numLenBytes; i++) {
      length = (length << 8) | buf[offset + 2 + i];
    }
    valueOffset = offset + 2 + numLenBytes;
  }

  return { tag, length, valueOffset, totalLength: valueOffset - offset + length };
}

function extractIssuerAndSerial(certDer: Buffer): {
  issuerDer: Buffer;
  serialDer: Buffer;
} {
  // Certificate → SEQUENCE → TBSCertificate → SEQUENCE
  const cert = parseDerElement(certDer, 0);
  const tbs = parseDerElement(certDer, cert.valueOffset);

  let pos = tbs.valueOffset;

  // version [0] EXPLICIT — skip if present
  let elem = parseDerElement(certDer, pos);
  if (elem.tag === 0xa0) {
    pos += elem.totalLength;
    elem = parseDerElement(certDer, pos);
  }

  // serialNumber INTEGER
  const serialStart = pos;
  const serial = parseDerElement(certDer, pos);
  const serialDer = certDer.subarray(serialStart, serialStart + serial.totalLength);
  pos += serial.totalLength;

  // signatureAlgorithm — skip
  elem = parseDerElement(certDer, pos);
  pos += elem.totalLength;

  // issuer Name (SEQUENCE)
  const issuerStart = pos;
  const issuer = parseDerElement(certDer, pos);
  const issuerDer = certDer.subarray(issuerStart, issuerStart + issuer.totalLength);

  return { issuerDer, serialDer };
}

function pemToDer(pem: string): Buffer {
  const b64 = pem
    .split("\n")
    .filter((l) => !l.startsWith("-----") && l.trim())
    .join("");
  return Buffer.from(b64, "base64");
}

// ══════════════════════════════════════════════════════════════
// CMS/PKCS#7 SignedData builder
// ══════════════════════════════════════════════════════════════

function buildCmsSignedData(
  content: Buffer,
  certPem: string,
  keyPem: string
): Buffer {
  const certDer = pemToDer(certPem);
  const { issuerDer, serialDer } = extractIssuerAndSerial(certDer);

  // Hash del contenido
  const contentDigest = crypto.createHash("sha256").update(content).digest();

  // Authenticated attributes
  const attrs = [
    derSequence(derOid(OID_CONTENT_TYPE), derSet(derOid(OID_DATA))),
    derSequence(derOid(OID_SIGNING_TIME), derSet(derUtcTime(new Date()))),
    derSequence(
      derOid(OID_MESSAGE_DIGEST),
      derSet(derOctetString(contentDigest))
    ),
  ];

  // Para firmar: attrs como SET (tag 0x31)
  const attrsAsSet = derSet(...attrs);

  // Firma RSA-SHA256 sobre el SET de attrs
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(attrsAsSet);
  const signature = signer.sign(keyPem);

  // Para incluir en SignerInfo: cambiar tag de SET (0x31) a [0] IMPLICIT (0xa0)
  const attrsImplicit = Buffer.from(attrsAsSet);
  attrsImplicit[0] = 0xa0;

  // SignerInfo
  const signerInfo = derSequence(
    derIntegerSmall(1), // version
    derSequence(issuerDer, serialDer), // issuerAndSerialNumber
    SHA256_ALG_ID, // digestAlgorithm
    attrsImplicit, // [0] IMPLICIT authenticatedAttributes
    RSA_ALG_ID, // signatureAlgorithm
    derOctetString(signature) // signature value
  );

  // SignedData
  const signedData = derSequence(
    derIntegerSmall(1), // version
    derSet(SHA256_ALG_ID), // digestAlgorithms
    derSequence(
      // encapContentInfo
      derOid(OID_DATA),
      derWrap(0xa0, derOctetString(content)) // [0] EXPLICIT content
    ),
    derWrap(0xa0, certDer), // [0] IMPLICIT certificates
    derSet(signerInfo) // signerInfos
  );

  // ContentInfo wrapper
  return derSequence(
    derOid(OID_SIGNED_DATA),
    derWrap(0xa0, signedData) // [0] EXPLICIT signedData
  );
}

// ══════════════════════════════════════════════════════════════
// WSAA — Autenticación
// ══════════════════════════════════════════════════════════════

// Cache por servicio (wsfe, ws_sr_padron_a5, etc.)
const tokenCaches = new Map<string, { token: string; sign: string; expiration: Date }>();

function buildLoginTicketRequest(service: string): string {
  const now = new Date();
  const gen = new Date(now.getTime() - 10 * 60 * 1000); // 10 min atrás
  const exp = new Date(now.getTime() + 10 * 60 * 60 * 1000); // 10 horas

  const fmt = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, "Z");

  return `<?xml version="1.0" encoding="UTF-8"?>
<loginTicketRequest version="1.0">
  <header>
    <uniqueId>${Math.floor(Date.now() / 1000)}</uniqueId>
    <generationTime>${fmt(gen)}</generationTime>
    <expirationTime>${fmt(exp)}</expirationTime>
  </header>
  <service>${service}</service>
</loginTicketRequest>`;
}

function decodeXmlEntities(str: string): string {
  return str
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function extractXmlTag(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`);
  const match = xml.match(re);
  return match ? match[1].trim() : "";
}

/** Extrae errores reales de AFIP (dentro de <Err>), ignorando <Evt> (eventos informativos) */
function extractAfipErrors(xml: string): { code: string; msg: string } | null {
  const errBlock = extractXmlTag(xml, "Errors");
  if (!errBlock) return null;
  const code = extractXmlTag(errBlock, "Code");
  const msg = extractXmlTag(errBlock, "Msg");
  if (code) return { code, msg };
  return null;
}

async function authenticateWSAA(service: string = SERVICE): Promise<{ token: string; sign: string }> {
  // Verificar cache por servicio
  const cached = tokenCaches.get(service);
  if (cached && cached.expiration > new Date()) {
    return { token: cached.token, sign: cached.sign };
  }

  const certPem = loadPem("AFIP_CERT");
  const keyPem = loadPem("AFIP_KEY");

  if (!certPem || !keyPem) {
    throw new Error(
      "Faltan variables de entorno AFIP_CERT y/o AFIP_KEY"
    );
  }

  // Construir TRA y firmarlo como CMS
  const tra = buildLoginTicketRequest(service);
  let cms: Buffer;
  try {
    cms = buildCmsSignedData(Buffer.from(tra, "utf-8"), certPem, keyPem);
  } catch (e: any) {
    throw new Error(`Error construyendo CMS: ${e.message}`);
  }
  const cmsBase64 = cms.toString("base64");

  // SOAP request al WSAA
  const soapRequest = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsaa="http://wsaa.view.sua.dvadac.desein.afip.gov">
  <soapenv:Body>
    <wsaa:loginCms>
      <wsaa:in0>${cmsBase64}</wsaa:in0>
    </wsaa:loginCms>
  </soapenv:Body>
</soapenv:Envelope>`;

  let response;
  try {
    response = await afipFetch(WSAA_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: "",
      },
      body: soapRequest,
    });
  } catch (e: any) {
    console.error("[AFIP-WSAA] Fetch failed:", e.message, e.cause);
    throw new Error(`No se pudo conectar con WSAA (${WSAA_URL}): ${e.message}`);
  }

  const responseText = await response.text();

  if (!response.ok) {
    console.error("[AFIP-WSAA] Error HTTP:", response.status, responseText.substring(0, 500));
    // Intentar extraer mensaje de error del SOAP Fault
    const faultString = extractXmlTag(responseText, "faultstring");
    throw new Error(
      `WSAA error ${response.status}: ${faultString || responseText.substring(0, 200)}`
    );
  }

  // Extraer loginCmsReturn (puede venir con XML entities escapadas)
  let loginReturn = extractXmlTag(responseText, "loginCmsReturn");
  if (!loginReturn) {
    throw new Error(
      "WSAA: no se encontró loginCmsReturn en la respuesta"
    );
  }

  // Decodificar entities si es necesario
  if (loginReturn.includes("&lt;")) {
    loginReturn = decodeXmlEntities(loginReturn);
  }

  const token = extractXmlTag(loginReturn, "token");
  const sign = extractXmlTag(loginReturn, "sign");

  if (!token || !sign) {
    throw new Error(
      "WSAA: no se obtuvieron token/sign de la respuesta"
    );
  }

  // Cachear token por servicio (10 horas de validez, con margen)
  tokenCaches.set(service, {
    token,
    sign,
    expiration: new Date(Date.now() + 9 * 60 * 60 * 1000),
  });

  return { token, sign };
}

// ══════════════════════════════════════════════════════════════
// Padrón — Consulta de CUIT via API REST pública de ARCA
// ══════════════════════════════════════════════════════════════

export interface DatosCUIT {
  nombre: string;
  domicilio: string;
  categoriaFiscal: "responsable_inscripto" | "monotributo" | "exento" | "consumidor_final";
  estadoClave: string;
  tipoPersona: string;
}

export async function consultarCUIT(cuit: string): Promise<DatosCUIT> {
  const cuitLimpio = cuit.replace(/\D/g, "");
  if (cuitLimpio.length !== 11) throw new Error("CUIT inválido");

  // API REST pública de ARCA — no requiere WSAA ni servicios autorizados
  const url = `https://soa.afip.gob.ar/sr-padron/v2/persona/${cuitLimpio}`;

  let res: Response;
  try {
    res = await fetch(url, { headers: { Accept: "application/json" } });
  } catch (e: any) {
    throw new Error(`No se pudo conectar con ARCA: ${e.message}`);
  }

  if (res.status === 404) throw new Error("CUIT no encontrado en ARCA");
  if (!res.ok) throw new Error(`Error ARCA: ${res.status}`);

  const json = await res.json();
  const data = json?.data;
  if (!data) throw new Error("CUIT no encontrado en ARCA");

  // Nombre
  let nombre = "";
  if (data.tipoPersona === "JURIDICA") {
    nombre = data.razonSocial || "";
  } else {
    nombre = [data.apellido, data.nombre].filter(Boolean).join(", ");
  }

  // Domicilio fiscal
  const dom = data.domicilioFiscal || {};
  const domicilio = [
    dom.calle && dom.numero ? `${dom.calle} ${dom.numero}` : dom.calle,
    dom.localidad || dom.descripcionLocalidad,
    dom.descripcionProvincia,
  ].filter(Boolean).join(", ");

  // Categoría fiscal
  const impuestos: any[] = data.impuesto || [];
  let categoriaFiscal: DatosCUIT["categoriaFiscal"] = "consumidor_final";
  for (const imp of impuestos) {
    if (imp.estado !== "ACTIVO") continue;
    if (imp.idImpuesto === 30) { categoriaFiscal = "responsable_inscripto"; break; }
    if (imp.idImpuesto === 20) { categoriaFiscal = "monotributo"; break; }
    if (imp.idImpuesto === 32) { categoriaFiscal = "exento"; break; }
  }

  return {
    nombre,
    domicilio,
    categoriaFiscal,
    estadoClave: data.estadoClave || "",
    tipoPersona: data.tipoPersona || "",
  };
}

// ══════════════════════════════════════════════════════════════
// WSFEv1 — Factura Electrónica
// ══════════════════════════════════════════════════════════════

function buildWSFEAuth(token: string, sign: string): string {
  return `<ar:Auth>
        <ar:Token>${token}</ar:Token>
        <ar:Sign>${sign}</ar:Sign>
        <ar:Cuit>${CUIT}</ar:Cuit>
      </ar:Auth>`;
}

async function callWSFEv1(soapAction: string, body: string): Promise<string> {
  const envelope = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="http://ar.gov.afip.dif.FEV1/">
  <soapenv:Body>
    ${body}
  </soapenv:Body>
</soapenv:Envelope>`;

  let response;
  try {
    response = await afipFetch(WSFEV1_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: `http://ar.gov.afip.dif.FEV1/${soapAction}`,
      },
      body: envelope,
    });
  } catch (e: any) {
    console.error(`[AFIP-WSFEv1] ${soapAction} fetch failed:`, e.message, e.cause);
    throw new Error(`No se pudo conectar con WSFEv1 (${soapAction}): ${e.message}`);
  }

  const text = await response.text();

  if (!response.ok) {
    const fault = extractXmlTag(text, "faultstring");
    throw new Error(
      `WSFEv1 ${soapAction} HTTP ${response.status}: ${fault || text.substring(0, 300)}`
    );
  }

  return text;
}

async function getUltimoComprobante(
  token: string,
  sign: string,
  cbteTipo: number
): Promise<number> {
  const body = `<ar:FECompUltimoAutorizado>
      ${buildWSFEAuth(token, sign)}
      <ar:PtoVta>${PTO_VTA}</ar:PtoVta>
      <ar:CbteTipo>${cbteTipo}</ar:CbteTipo>
    </ar:FECompUltimoAutorizado>`;

  const xml = await callWSFEv1("FECompUltimoAutorizado", body);

  // Solo verificar errores reales (<Err>), ignorar eventos informativos (<Evt>)
  const err = extractAfipErrors(xml);
  if (err) {
    throw new Error(`AFIP FECompUltimoAutorizado error ${err.code}: ${err.msg}`);
  }

  const nro = extractXmlTag(xml, "CbteNro");
  return parseInt(nro) || 0;
}

// ══════════════════════════════════════════════════════════════
// Interfaces públicas
// ══════════════════════════════════════════════════════════════

export interface AfipCAEParams {
  tipoComprobante: number; // 1=Factura A, 6=Factura B
  docTipo: number; // 80=CUIT, 86=CUIL, 96=DNI, 99=CF
  docNro: number; // número de documento, 0 para CF
  condicionIVAReceptor: number; // 1=RI, 4=Exento, 5=CF, 6=Monotributo, etc.
  importeTotal: number;
  importeNeto: number; // neto gravado (sin IVA)
  importeIVA: number; // importe IVA
  fecha?: Date;
}

export interface AfipCAEResult {
  cae: string;
  caeVencimiento: string; // YYYY-MM-DD
  numeroComprobante: number;
  puntoVenta: number;
  tipoComprobante: number;
}

// ══════════════════════════════════════════════════════════════
// Función principal: solicitar CAE
// ══════════════════════════════════════════════════════════════

export async function solicitarCAE(
  params: AfipCAEParams
): Promise<AfipCAEResult> {
  const { token, sign } = await authenticateWSAA();

  // Obtener último número de comprobante
  const ultimoNro = await getUltimoComprobante(
    token,
    sign,
    params.tipoComprobante
  );
  const nuevoNro = ultimoNro + 1;

  const fecha = params.fecha || new Date();
  const cbteFch =
    fecha.getFullYear().toString() +
    (fecha.getMonth() + 1).toString().padStart(2, "0") +
    fecha.getDate().toString().padStart(2, "0");

  // Redondear importes a 2 decimales
  const impTotal = Math.round(params.importeTotal * 100) / 100;
  const impNeto = Math.round(params.importeNeto * 100) / 100;
  const impIVA = Math.round(params.importeIVA * 100) / 100;

  // IVA array — solo si hay IVA > 0
  const ivaBlock =
    impIVA > 0
      ? `<ar:Iva>
              <ar:AlicIva>
                <ar:Id>5</ar:Id>
                <ar:BaseImp>${impNeto}</ar:BaseImp>
                <ar:Importe>${impIVA}</ar:Importe>
              </ar:AlicIva>
            </ar:Iva>`
      : "";

  const body = `<ar:FECAESolicitar>
      ${buildWSFEAuth(token, sign)}
      <ar:FeCAEReq>
        <ar:FeCabReq>
          <ar:CantReg>1</ar:CantReg>
          <ar:PtoVta>${PTO_VTA}</ar:PtoVta>
          <ar:CbteTipo>${params.tipoComprobante}</ar:CbteTipo>
        </ar:FeCabReq>
        <ar:FeDetReq>
          <ar:FECAEDetRequest>
            <ar:Concepto>1</ar:Concepto>
            <ar:DocTipo>${params.docTipo}</ar:DocTipo>
            <ar:DocNro>${params.docNro}</ar:DocNro>
            <ar:CbteDesde>${nuevoNro}</ar:CbteDesde>
            <ar:CbteHasta>${nuevoNro}</ar:CbteHasta>
            <ar:CbteFch>${cbteFch}</ar:CbteFch>
            <ar:ImpTotal>${impTotal}</ar:ImpTotal>
            <ar:ImpTotConc>0</ar:ImpTotConc>
            <ar:ImpNeto>${impNeto}</ar:ImpNeto>
            <ar:ImpOpEx>0</ar:ImpOpEx>
            <ar:ImpIVA>${impIVA}</ar:ImpIVA>
            <ar:ImpTrib>0</ar:ImpTrib>
            <ar:CondicionIVAReceptor>${params.condicionIVAReceptor}</ar:CondicionIVAReceptor>
            <ar:MonId>PES</ar:MonId>
            <ar:MonCotiz>1</ar:MonCotiz>
            ${ivaBlock}
          </ar:FECAEDetRequest>
        </ar:FeDetReq>
      </ar:FeCAEReq>
    </ar:FECAESolicitar>`;

  const xml = await callWSFEv1("FECAESolicitar", body);

  // Verificar resultado
  const resultado = extractXmlTag(xml, "Resultado");
  const cae = extractXmlTag(xml, "CAE");
  const caeFchVto = extractXmlTag(xml, "CAEFchVto");

  // Solo verificar errores reales (<Err>), ignorar eventos informativos (<Evt>)
  const err = extractAfipErrors(xml);

  if (resultado === "R" || !cae) {
    // Buscar observaciones en <Obs> también
    const obsBlock = extractXmlTag(xml, "Observaciones");
    const obsMsg = obsBlock ? extractXmlTag(obsBlock, "Msg") : "";
    throw new Error(
      `AFIP rechazó el comprobante: ${err?.msg || obsMsg || "Sin detalle"} (código: ${err?.code || "N/A"})`
    );
  }

  // Formatear vencimiento CAE: YYYYMMDD → YYYY-MM-DD
  const caeVencimiento = caeFchVto
    ? `${caeFchVto.substring(0, 4)}-${caeFchVto.substring(4, 6)}-${caeFchVto.substring(6, 8)}`
    : "";

  return {
    cae,
    caeVencimiento,
    numeroComprobante: nuevoNro,
    puntoVenta: PTO_VTA,
    tipoComprobante: params.tipoComprobante,
  };
}

// ══════════════════════════════════════════════════════════════
// Función auxiliar: consultar último comprobante (pública)
// ══════════════════════════════════════════════════════════════

export async function obtenerUltimoNumeroDirecto(
  tipoComprobante: number
): Promise<number> {
  const { token, sign } = await authenticateWSAA();
  return getUltimoComprobante(token, sign, tipoComprobante);
}

export { PTO_VTA, CUIT };
