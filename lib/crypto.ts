import * as Crypto from "expo-crypto";

const APP_SECRET = "CAMPSYNC_NFC_SECRET_KEY_2024_v1";

const MAX_WRISTBAND_BYTES = 540;
const MAX_PLAINTEXT_CHARS = Math.floor(MAX_WRISTBAND_BYTES * 3 / 4); // 405

// Field byte limits — keep the total under MAX_PLAINTEXT_CHARS.
// Budget at MAX_CONTACTS=3 (worst-case all fields at max):
//   id(36) + f(12) + l(15) + d(10) + a(30) + b(5) + m(20) + c(12) + t(24) = 164
//   3 contacts × (21 struct + 16n + 14p + 10r) = 183
//   JSON key/structure overhead ≈ 55
//   Total ≈ 402 → safely under 405 (floor(540 × 0.75))
const FIELD_LIMITS = {
  fn: 12,  // first name
  ln: 15,  // last name
  al: 30,  // allergies (comma-separated string)
  md: 20,  // medications
  co: 12,  // conditions
  bt: 5,   // blood type
  cn: 16,  // contact name
  cp: 14,  // contact phone
  cr: 10,  // contact relationship
  // email omitted — not useful for an emergency phone call, and saves ~22 bytes per contact
};

const MAX_CONTACTS = 3;

function trunc(value: string, limit: number): string {
  if (!value || value.length <= limit) return value;
  return value.slice(0, limit - 1) + "…";
}

function medStr(value: string | string[] | undefined): string {
  if (!value) return "";
  if (Array.isArray(value)) return value.join(", ");
  return value;
}

function stringToBytes(str: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < str.length; i++) {
    bytes.push(str.charCodeAt(i));
  }
  return bytes;
}

function bytesToString(bytes: number[]): string {
  return bytes.map((b) => String.fromCharCode(b)).join("");
}

function toBase64(str: string): string {
  const bytes = stringToBytes(str);
  const base64Chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let result = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = bytes[i + 1] ?? 0;
    const b2 = bytes[i + 2] ?? 0;
    result += base64Chars[(b0 >> 2) & 0x3f];
    result += base64Chars[((b0 & 0x3) << 4) | ((b1 >> 4) & 0xf)];
    result += i + 1 < bytes.length ? base64Chars[((b1 & 0xf) << 2) | ((b2 >> 6) & 0x3)] : "=";
    result += i + 2 < bytes.length ? base64Chars[b2 & 0x3f] : "=";
  }
  return result;
}

function fromBase64(base64: string): string {
  const base64Chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const clean = base64.replace(/=/g, "");
  const bytes: number[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    const b0 = base64Chars.indexOf(clean[i]);
    const b1 = base64Chars.indexOf(clean[i + 1] ?? "A");
    const b2 = base64Chars.indexOf(clean[i + 2] ?? "A");
    const b3 = base64Chars.indexOf(clean[i + 3] ?? "A");
    bytes.push((b0 << 2) | (b1 >> 4));
    if (i + 2 < clean.length) bytes.push(((b1 & 0xf) << 4) | (b2 >> 2));
    if (i + 3 < clean.length) bytes.push(((b2 & 0x3) << 6) | b3);
  }
  return bytesToString(bytes);
}

function packPayload(data: {
  camperId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  medical: {
    allergies?: string | string[];
    medications?: string | string[];
    conditions?: string | string[];
    emergencyContacts?: Array<{ name?: string; phone?: string; relationship?: string; email?: string }>;
    bloodType?: string;
    [key: string]: any;
  };
  programmedAt: string;
  appVersion: string;
}): object {
  // Pack all contacts (up to MAX_CONTACTS) with name, phone, and relationship.
  // Email is intentionally omitted — phone is what matters in an emergency,
  // and omitting email keeps 3 contacts within the 405-char plaintext budget.
  const rawContacts = (data.medical.emergencyContacts ?? []).filter(
    (c) => c && (c.name || c.phone)
  );
  const contacts = rawContacts.slice(0, MAX_CONTACTS).map((c) => {
    const packed: Record<string, string> = {};
    if (c.name) packed.n = trunc(c.name, FIELD_LIMITS.cn);
    if (c.phone) packed.p = trunc(c.phone, FIELD_LIMITS.cp);
    if (c.relationship) packed.r = trunc(c.relationship, FIELD_LIMITS.cr);
    return packed;
  });

  return {
    i: data.camperId,
    f: trunc(data.firstName ?? "", FIELD_LIMITS.fn),
    l: trunc(data.lastName ?? "", FIELD_LIMITS.ln),
    d: data.dateOfBirth,
    a: trunc(medStr(data.medical.allergies), FIELD_LIMITS.al),
    b: trunc(data.medical.bloodType ?? "", FIELD_LIMITS.bt),
    m: trunc(medStr(data.medical.medications), FIELD_LIMITS.md),
    c: trunc(medStr(data.medical.conditions), FIELD_LIMITS.co),
    e: contacts,
    t: data.programmedAt,
  };
}

function unpackPayload(compact: any): object {
  // Detect format: new format has "i" (camperId) as a top-level key.
  // Legacy format has "id" as the top-level camperId key.
  const isNew = compact.i !== undefined;

  if (isNew) {
    // New compact format: a=allergies, b=bloodType, m=medications, c=conditions, e=contacts array
    const contacts = Array.isArray(compact.e)
      ? compact.e.map((c: any) => ({
          name: c.n ?? "",
          phone: c.p ?? "",
          relationship: c.r ?? "",
          email: c.v ?? "",
        }))
      : [];
    return {
      camperId: compact.i ?? "",
      firstName: compact.f ?? "",
      lastName: compact.l ?? "",
      dateOfBirth: compact.d ?? "",
      medical: {
        allergies: compact.a ?? "",
        medications: compact.m ?? "",
        conditions: compact.c ?? "",
        emergencyContacts: contacts,
        bloodType: compact.b ?? "",
        doctorName: "",
        doctorPhone: "",
        insuranceProvider: "",
        notes: "",
      },
      programmedAt: compact.t ?? "",
      appVersion: "1.0",
    };
  } else {
    // Legacy format: id, fn, ln, dob, m={al,md,co,ec,ep,bt}, ts, v
    const primaryContact = compact.m?.ec
      ? [{ name: compact.m.ec ?? "", phone: compact.m.ep ?? "", relationship: "", email: "" }]
      : [];
    return {
      camperId: compact.id ?? "",
      firstName: compact.fn ?? "",
      lastName: compact.ln ?? "",
      dateOfBirth: compact.dob ?? "",
      medical: {
        allergies: compact.m?.al ?? "",
        medications: compact.m?.md ?? "",
        conditions: compact.m?.co ?? "",
        emergencyContacts: primaryContact,
        bloodType: compact.m?.bt ?? "",
        doctorName: "",
        doctorPhone: "",
        insuranceProvider: "",
        notes: "",
      },
      programmedAt: compact.ts ?? "",
      appVersion: compact.v ?? "1.0",
    };
  }
}

export function encryptWristbandData(data: object): string {
  const compact = packPayload(data as any);
  const json = JSON.stringify(compact);

  if (json.length > MAX_PLAINTEXT_CHARS) {
    throw new Error(
      `Wristband payload too large (${json.length} chars, max ${MAX_PLAINTEXT_CHARS}). Shorten allergy, medication, or contact fields.`
    );
  }

  const keyBytes = stringToBytes(APP_SECRET);
  const dataBytes = stringToBytes(json);
  const encrypted = dataBytes.map((b, i) => b ^ keyBytes[i % keyBytes.length]);
  const result = toBase64(bytesToString(encrypted));

  if (result.length > MAX_WRISTBAND_BYTES) {
    throw new Error(
      `Wristband payload too large after encoding (${result.length} bytes, max ${MAX_WRISTBAND_BYTES}).`
    );
  }

  return result;
}

export function decryptWristbandData(encrypted: string): object | null {
  try {
    const decoded = fromBase64(encrypted);
    const keyBytes = stringToBytes(APP_SECRET);
    const encBytes = stringToBytes(decoded);
    const decrypted = encBytes.map((b, i) => b ^ keyBytes[i % keyBytes.length]);
    const json = bytesToString(decrypted);
    const compact = JSON.parse(json);
    return unpackPayload(compact);
  } catch {
    return null;
  }
}

export function generateId(): string {
  return Crypto.randomUUID();
}

export async function hashPassword(password: string): Promise<string> {
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    password + APP_SECRET
  );
  return hash;
}

export function generateWristbandId(): string {
  const num = Math.floor(Math.random() * 999999).toString().padStart(6, "0");
  return `WB-${num}`;
}
