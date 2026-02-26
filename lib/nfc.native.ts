import { Platform } from "react-native";
import NfcManager, { NfcTech } from "react-native-nfc-manager";
import { encryptWristbandData, decryptWristbandData } from "./crypto";
import type { WristbandPayload } from "@/types";

// iOS 26 only allows the TAG entitlement (NFCTagReaderSession).
// NFCNDEFReaderSession (NfcTech.Ndef) is no longer permitted.
// We use NfcTech.NfcA with NTAG21x transceive commands instead.
//
// Memory layout (user memory starts at page 4 on NTAG21x):
//   Page 4: [0xCA, 0x0F, length_high, length_low]  — magic + payload length
//   Pages 5+: payload bytes (encrypted JSON string as UTF-8)
//
// NTAG READ (0x30): returns 16 bytes (4 pages) starting at given page
// NTAG WRITE (0xA2): writes exactly 4 bytes to one page

const NTAG_READ = 0x30;
const NTAG_WRITE = 0xA2;
const MAGIC_1 = 0xca;
const MAGIC_2 = 0x0f;
const HEADER_PAGE = 4;
const DATA_START_PAGE = 5;
const MAX_PAYLOAD_BYTES = 480; // safe for NTAG215 (504 bytes user mem)

let nfcInitialized = false;

export async function initNFC(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    await NfcManager.start();
    nfcInitialized = true;
    return true;
  } catch {
    nfcInitialized = false;
    return false;
  }
}

export async function isNFCSupported(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    return await NfcManager.isSupported();
  } catch {
    return false;
  }
}

export async function isNFCEnabled(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    return await NfcManager.isEnabled();
  } catch {
    return false;
  }
}

export function isNFCSimulated(): boolean {
  return Platform.OS === "web";
}

// Read 16 bytes (4 pages) from NTAG21x starting at `startPage`
async function readPages(startPage: number): Promise<number[]> {
  const resp = await NfcManager.nfcAHandler.transceive([NTAG_READ, startPage]);
  return Array.from(resp as Uint8Array);
}

// Write exactly 4 bytes to one page on NTAG21x
async function writePage(page: number, data: number[]): Promise<void> {
  const payload = data.slice(0, 4);
  while (payload.length < 4) payload.push(0x00);
  await NfcManager.nfcAHandler.transceive([NTAG_WRITE, page, ...payload]);
}

export async function readNFCTag(): Promise<WristbandPayload | null> {
  if (Platform.OS === "web") return null;

  try {
    await NfcManager.requestTechnology(NfcTech.NfcA, {
      alertMessage: "Hold your iPhone near a CampSync wristband",
    } as any);

    // Read header page
    const headerBytes = await readPages(HEADER_PAGE);
    if (headerBytes[0] !== MAGIC_1 || headerBytes[1] !== MAGIC_2) {
      return null; // Not a CampSync wristband
    }

    const payloadLength = (headerBytes[2] << 8) | headerBytes[3];
    if (payloadLength === 0 || payloadLength > MAX_PAYLOAD_BYTES) {
      return null;
    }

    // Read data pages
    const pagesNeeded = Math.ceil(payloadLength / 4);
    const rawBytes: number[] = [];

    for (let i = 0; i < pagesNeeded; i += 4) {
      const chunk = await readPages(DATA_START_PAGE + i);
      rawBytes.push(...chunk);
    }

    const payloadBytes = rawBytes.slice(0, payloadLength);
    const text = decodeBytes(payloadBytes);

    return decryptPayloadFromTag(text);
  } finally {
    try {
      await NfcManager.cancelTechnologyRequest();
    } catch {}
  }
}

export async function writeNFCTag(payload: WristbandPayload): Promise<void> {
  if (Platform.OS === "web") throw new Error("NFC not supported on web");

  try {
    await NfcManager.requestTechnology(NfcTech.NfcA, {
      alertMessage: "Hold iPhone near the blank wristband to program it",
    } as any);

    const encrypted = encryptPayloadForTag(payload);
    const payloadBytes = encodeBytes(encrypted);

    if (payloadBytes.length > MAX_PAYLOAD_BYTES) {
      throw new Error("Payload too large for wristband");
    }

    // Write header: magic + 2-byte big-endian length
    const lenHigh = (payloadBytes.length >> 8) & 0xff;
    const lenLow = payloadBytes.length & 0xff;
    await writePage(HEADER_PAGE, [MAGIC_1, MAGIC_2, lenHigh, lenLow]);

    // Write data pages (4 bytes per page)
    for (let i = 0; i < payloadBytes.length; i += 4) {
      const chunk = payloadBytes.slice(i, i + 4);
      await writePage(DATA_START_PAGE + Math.floor(i / 4), chunk);
    }
  } finally {
    try {
      await NfcManager.cancelTechnologyRequest();
    } catch {}
  }
}

function encodeBytes(text: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < text.length; i++) {
    bytes.push(text.charCodeAt(i) & 0xff);
  }
  return bytes;
}

function decodeBytes(bytes: number[]): string {
  return bytes.map((b) => String.fromCharCode(b)).join("");
}

export function encryptPayloadForTag(payload: WristbandPayload): string {
  return encryptWristbandData(payload);
}

export function decryptPayloadFromTag(data: string): WristbandPayload | null {
  const result = decryptWristbandData(data);
  if (!result) return null;
  return result as WristbandPayload;
}
