import * as Crypto from "expo-crypto";

const APP_SECRET = "CAMPSYNC_NFC_SECRET_KEY_2024_v1";

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

export function encryptWristbandData(data: object): string {
  const json = JSON.stringify(data);
  const keyBytes = stringToBytes(APP_SECRET);
  const dataBytes = stringToBytes(json);
  const encrypted = dataBytes.map((b, i) => b ^ keyBytes[i % keyBytes.length]);
  return toBase64(bytesToString(encrypted));
}

export function decryptWristbandData(encrypted: string): object | null {
  try {
    const decoded = fromBase64(encrypted);
    const keyBytes = stringToBytes(APP_SECRET);
    const encBytes = stringToBytes(decoded);
    const decrypted = encBytes.map((b, i) => b ^ keyBytes[i % keyBytes.length]);
    const json = bytesToString(decrypted);
    return JSON.parse(json);
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
