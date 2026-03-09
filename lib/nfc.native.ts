import { Platform } from "react-native";
import { encryptWristbandData, decryptWristbandData } from "./crypto";
import type { WristbandPayload } from "@/types";

// react-native-nfc-manager is a custom native module. It is NOT available in
// Expo Go or development builds that were not built with the NFC module.
// Using a lazy require() inside functions means the import never executes at
// module load time, so builds without NFC can still load this file safely.

type NfcManagerType = typeof import("react-native-nfc-manager").default;
type NfcTechType = typeof import("react-native-nfc-manager").NfcTech;

let _nfcManager: NfcManagerType | null = null;
let _NfcTech: NfcTechType | null = null;

function loadNfc(): { manager: NfcManagerType; NfcTech: NfcTechType } | null {
  if (_nfcManager && _NfcTech) return { manager: _nfcManager, NfcTech: _NfcTech };
  try {
    const mod = require("react-native-nfc-manager");
    _nfcManager = mod.default ?? mod.NfcManager;
    _NfcTech = mod.NfcTech;
    if (!_nfcManager || !_NfcTech) return null;
    return { manager: _nfcManager, NfcTech: _NfcTech };
  } catch {
    return null;
  }
}

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
//
// NOTE: Password protection is intentionally NOT used. Sending PWD_AUTH to an
// unprotected tag causes iOS to respond with a NAK, which automatically
// invalidates the entire NFC session — making all subsequent commands fail.
// Security is instead provided by AES-256-GCM encryption of the payload.

const NTAG_READ = 0x30;
const NTAG_WRITE = 0xa2;
const MAGIC_1 = 0xca;
const MAGIC_2 = 0x0f;
const HEADER_PAGE = 4;
const DATA_START_PAGE = 5;
const MAX_PAYLOAD_BYTES = 480;

let nfcInitialized = false;

export async function initNFC(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const nfc = loadNfc();
  if (!nfc) return false;
  try {
    await nfc.manager.start();
    nfcInitialized = true;
    return true;
  } catch {
    nfcInitialized = false;
    return false;
  }
}

export async function isNFCSupported(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const nfc = loadNfc();
  if (!nfc) return false;
  try {
    return await nfc.manager.isSupported();
  } catch {
    return false;
  }
}

export async function isNFCEnabled(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const nfc = loadNfc();
  if (!nfc) return false;
  try {
    return await nfc.manager.isEnabled();
  } catch {
    return false;
  }
}

export function isNFCSimulated(): boolean {
  return Platform.OS === "web";
}

async function readPages(
  manager: NfcManagerType,
  startPage: number
): Promise<number[]> {
  const resp = await (manager as any).nfcAHandler.transceive([
    NTAG_READ,
    startPage,
  ]);
  return Array.from(resp as Uint8Array);
}

async function writePage(
  manager: NfcManagerType,
  page: number,
  data: number[]
): Promise<void> {
  const payload = data.slice(0, 4);
  while (payload.length < 4) payload.push(0x00);
  await (manager as any).nfcAHandler.transceive([NTAG_WRITE, page, ...payload]);
}

export async function readNFCTag(): Promise<WristbandPayload | null> {
  if (Platform.OS === "web") return null;
  const nfc = loadNfc();
  if (!nfc) return null;

  try {
    await nfc.manager.requestTechnology(nfc.NfcTech.NfcA, {
      alertMessage: "Hold your iPhone near a CampSync wristband",
    } as any);

    const headerBytes = await readPages(nfc.manager, HEADER_PAGE);
    if (headerBytes[0] !== MAGIC_1 || headerBytes[1] !== MAGIC_2) {
      return null;
    }

    const payloadLength = (headerBytes[2] << 8) | headerBytes[3];
    if (payloadLength === 0 || payloadLength > MAX_PAYLOAD_BYTES) {
      return null;
    }

    const pagesNeeded = Math.ceil(payloadLength / 4);
    const rawBytes: number[] = [];

    for (let i = 0; i < pagesNeeded; i += 4) {
      const chunk = await readPages(nfc.manager, DATA_START_PAGE + i);
      rawBytes.push(...chunk);
    }

    const payloadBytes = rawBytes.slice(0, payloadLength);
    const text = decodeBytes(payloadBytes);

    return decryptPayloadFromTag(text);
  } finally {
    try {
      await nfc.manager.cancelTechnologyRequest();
    } catch {}
  }
}

export async function writeNFCTag(payload: WristbandPayload): Promise<void> {
  if (Platform.OS === "web") throw new Error("NFC not supported on web");
  const nfc = loadNfc();
  if (!nfc) throw new Error("NFC module not available on this build");

  try {
    await nfc.manager.requestTechnology(nfc.NfcTech.NfcA, {
      alertMessage: "Hold iPhone near the blank wristband to program it",
    } as any);

    const encrypted = encryptPayloadForTag(payload);
    const payloadBytes = encodeBytes(encrypted);

    if (payloadBytes.length > MAX_PAYLOAD_BYTES) {
      throw new Error("Payload too large for wristband");
    }

    const lenHigh = (payloadBytes.length >> 8) & 0xff;
    const lenLow = payloadBytes.length & 0xff;
    await writePage(nfc.manager, HEADER_PAGE, [MAGIC_1, MAGIC_2, lenHigh, lenLow]);

    for (let i = 0; i < payloadBytes.length; i += 4) {
      const chunk = payloadBytes.slice(i, i + 4);
      await writePage(nfc.manager, DATA_START_PAGE + Math.floor(i / 4), chunk);
    }
  } finally {
    try {
      await nfc.manager.cancelTechnologyRequest();
    } catch {}
  }
}

export async function eraseNFCTag(): Promise<void> {
  if (Platform.OS === "web") throw new Error("NFC not supported on web");
  const nfc = loadNfc();
  if (!nfc) throw new Error("NFC module not available on this build");

  try {
    await nfc.manager.requestTechnology(nfc.NfcTech.NfcA, {
      alertMessage: "Hold iPhone near the wristband to erase it",
    } as any);

    // Erase header page (invalidates magic bytes — app treats tag as blank)
    await writePage(nfc.manager, HEADER_PAGE, [0x00, 0x00, 0x00, 0x00]);

    // Clear first several data pages as well
    for (let p = DATA_START_PAGE; p < DATA_START_PAGE + 10; p++) {
      try {
        await writePage(nfc.manager, p, [0x00, 0x00, 0x00, 0x00]);
      } catch {
        break; // Stop if we hit a page boundary
      }
    }
  } finally {
    try {
      await nfc.manager.cancelTechnologyRequest();
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
