import * as Crypto from "expo-crypto";

const APP_SECRET = "CAMPSYNC_NFC_SECRET_KEY_2024_v1";

const MAX_WRISTBAND_BYTES = 540;
const MAX_PLAINTEXT_CHARS = Math.floor(MAX_WRISTBAND_BYTES * 3 / 4);

const FIELD_LIMITS = {
  fn: 15,
  ln: 20,
  al: 50,
  md: 50,
  co: 20,
  ec: 25,
  ep: 15,
  bt: 5,
};

function trunc(value: string, limit: number): string {
  if (!value || value.length <= limit) return value;
  return value.slice(0, limit - 3) + "...";
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
    allergies?: string;
    medications?: string;
    conditions?: string;
    emergencyContacts?: Array<{ name?: string; phone?: string; relationship?: string; email?: string }>;
    bloodType?: string;
    [key: string]: any;
  };
  programmedAt: string;
  appVersion: string;
}): object {
  const primaryContact = data.medical.emergencyContacts?.[0];
  return {
    id: data.camperId,
    fn: trunc(data.firstName ?? "", FIELD_LIMITS.fn),
    ln: trunc(data.lastName ?? "", FIELD_LIMITS.ln),
    dob: data.dateOfBirth,
    m: {
      al: trunc(data.medical.allergies ?? "", FIELD_LIMITS.al),
      md: trunc(data.medical.medications ?? "", FIELD_LIMITS.md),
      co: trunc(data.medical.conditions ?? "", FIELD_LIMITS.co),
      ec: trunc(primaryContact?.name ?? "", FIELD_LIMITS.ec),
      ep: trunc(primaryContact?.phone ?? "", FIELD_LIMITS.ep),
      bt: trunc(data.medical.bloodType ?? "", FIELD_LIMITS.bt),
    },
    ts: data.programmedAt,
    v: data.appVersion,
  };
}

function unpackPayload(compact: any): object {
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
    appVersion: compact.v ?? "",
  };
}

export function encryptWristbandData(data: object): string {
  const compact = packPayload(data as any);
  const json = JSON.stringify(compact);

  if (json.length > MAX_PLAINTEXT_CHARS) {
    throw new Error(
      `Wristband payload too large (${json.length} chars, max ${MAX_PLAINTEXT_CHARS}). Shorten allergy, medication, or emergency contact fields.`
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
