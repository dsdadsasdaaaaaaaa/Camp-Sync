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
// PWD_AUTH (0x1B): authenticate with 4-byte password, returns 2-byte PACK
//
// Two-scan security model:
//   Check-in  → Scan 1: writeNFCTag (write data, tag unprotected, no auth)
//             → Scan 2: lockNFCTag  (set password + AUTH0, tag is now locked)
//   Check-out → Scan 1: unlockNFCTag (auth with password, remove AUTH0)
//             → Scan 2: eraseNFCTag  (erase pages, tag is unprotected)
//
// This avoids calling PWD_AUTH on an unprotected tag (which makes iOS
// invalidate the entire NFC session with "operation failed") by keeping
// each scan to a single logical step where the auth state is known.

const NTAG_READ = 0x30;
const NTAG_WRITE = 0xa2;
const PWD_AUTH = 0x1b;
const MAGIC_1 = 0xca;
const MAGIC_2 = 0x0f;
const HEADER_PAGE = 4;
const DATA_START_PAGE = 5;
const MAX_PAYLOAD_BYTES = 540;

const WRISTBAND_PWD = [0xca, 0x0f, 0x1a, 0x2b];
const WRISTBAND_PACK = [0xca, 0x0f, 0x00, 0x00];

let nfcInitialized = false;

async function ensureStarted(manager: NfcManagerType): Promise<void> {
  if (nfcInitialized) return;
  try {
    await manager.start();
    nfcInitialized = true;
  } catch {
    // start() may throw if already running; treat as OK
    nfcInitialized = true;
  }
}

export async function initNFC(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const nfc = loadNfc();
  if (!nfc) return false;
  try {
    await ensureStarted(nfc.manager);
    return true;
  } catch {
    return false;
  }
}

export async function isNFCSupported(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const nfc = loadNfc();
  if (!nfc) return false;
  try {
    await ensureStarted(nfc.manager);
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

async function readPages(manager: NfcManagerType, startPage: number): Promise<number[]> {
  const resp = await (manager as any).nfcAHandler.transceive([NTAG_READ, startPage]);
  return Array.from(resp as Uint8Array);
}

async function writePage(manager: NfcManagerType, page: number, data: number[]): Promise<void> {
  const payload = data.slice(0, 4);
  while (payload.length < 4) payload.push(0x00);
  await (manager as any).nfcAHandler.transceive([NTAG_WRITE, page, ...payload]);
}

// Detect NTAG21x variant from Capability Container (CC) at page 3.
// CC byte 2 encodes tag size in 8-byte units:
//   0x12 = NTAG213 (144 bytes, 45 pages)
//   0x3E = NTAG215 (496 bytes, 135 pages)
//   0x6D = NTAG216 (888 bytes, 231 pages)
async function getConfigAddresses(manager: NfcManagerType): Promise<{
  cfgPage: number;
  pwdPage: number;
  packPage: number;
}> {
  const cc = await readPages(manager, 3);
  const sizeCode = cc[2];
  if (sizeCode <= 0x12) {
    return { cfgPage: 0x29, pwdPage: 0x2b, packPage: 0x2c };
  } else if (sizeCode <= 0x3e) {
    return { cfgPage: 0x83, pwdPage: 0x85, packPage: 0x86 };
  } else {
    return { cfgPage: 0xe3, pwdPage: 0xe5, packPage: 0xe6 };
  }
}

export async function readNFCTag(): Promise<WristbandPayload | null> {
  if (Platform.OS === "web") return null;
  const nfc = loadNfc();
  if (!nfc) return null;
  await ensureStarted(nfc.manager);

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
    try { await nfc.manager.cancelTechnologyRequest(); } catch {}
  }
}

// Scan 1 of check-in: write encrypted data to tag (no auth, tag is blank).
export async function writeNFCTag(payload: WristbandPayload): Promise<void> {
  if (Platform.OS === "web") throw new Error("NFC not supported on web");
  const nfc = loadNfc();
  if (!nfc) throw new Error("NFC module not available on this build");
  await ensureStarted(nfc.manager);

  try {
    await nfc.manager.requestTechnology(nfc.NfcTech.NfcA, {
      alertMessage: "Hold iPhone near the blank wristband — Step 1 of 2",
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
    try { await nfc.manager.cancelTechnologyRequest(); } catch {}
  }
}

// Scan 2 of check-in: lock the tag with a password (tag is unprotected, no auth needed).
//
// NTAG21x config page byte layout: [MIRROR_BYTE, RFUI, AUTH0, ACCESS]
//   AUTH0 (byte 2): first page number that requires password authentication (0x04 = page 4+)
//   ACCESS (byte 3): PROT (bit 7), CFGLCK (bit 6, ONE-TIME WRITE — never set!), AUTHLIM (bits 0-2)
//
// We set AUTH0 = 0x04 with PROT = 0, meaning writes to pages 4+ need PWD_AUTH but reads are free.
// This lets "Scan Only" read locked wristbands without needing a password.
export async function lockNFCTag(): Promise<void> {
  if (Platform.OS === "web") throw new Error("NFC not supported on web");
  const nfc = loadNfc();
  if (!nfc) throw new Error("NFC module not available on this build");
  await ensureStarted(nfc.manager);

  try {
    await nfc.manager.requestTechnology(nfc.NfcTech.NfcA, {
      alertMessage: "Scan the wristband again to lock it — Step 2 of 2",
    } as any);

    const addrs = await getConfigAddresses(nfc.manager);
    await writePage(nfc.manager, addrs.pwdPage, WRISTBAND_PWD);
    await writePage(nfc.manager, addrs.packPage, WRISTBAND_PACK);
    const cfg = await readPages(nfc.manager, addrs.cfgPage);
    // Byte 2 = AUTH0 (set to 0x04 to protect pages 4+)
    // Byte 3 = ACCESS (keep unchanged — NEVER set CFGLCK bit 6, it permanently bricks the chip)
    await writePage(nfc.manager, addrs.cfgPage, [cfg[0], cfg[1], 0x04, cfg[3]]);
  } finally {
    try { await nfc.manager.cancelTechnologyRequest(); } catch {}
  }
}

// Scan 1 of check-out: authenticate and remove password protection.
// After this, AUTH0 = 0xFF so pages are freely accessible for the erase step.
export async function unlockNFCTag(): Promise<void> {
  if (Platform.OS === "web") throw new Error("NFC not supported on web");
  const nfc = loadNfc();
  if (!nfc) throw new Error("NFC module not available on this build");
  await ensureStarted(nfc.manager);

  try {
    await nfc.manager.requestTechnology(nfc.NfcTech.NfcA, {
      alertMessage: "Hold the wristband to unlock — Step 1 of 2",
    } as any);

    // Tag is locked — authenticate first so we can write to config pages.
    // (PWD_AUTH succeeds even if AUTH0 is misconfigured, as long as pwd matches.)
    await (nfc.manager as any).nfcAHandler.transceive([PWD_AUTH, ...WRISTBAND_PWD]);

    // Set AUTH0 = 0xFF (byte 2) to disable password protection on all pages.
    // Leave ACCESS (byte 3) unchanged — NEVER touch CFGLCK (bit 6), it permanently bricks the chip.
    //
    // Early-exit if AUTH0 is already 0xFF (tag was never actually locked, e.g. written by old
    // firmware with the byte-position bug). Skipping the write avoids errors on chips that were
    // previously bricked by the old unlock code which set CFGLCK=1 in the ACCESS byte.
    const addrs = await getConfigAddresses(nfc.manager);
    const cfg = await readPages(nfc.manager, addrs.cfgPage);
    if (cfg[2] !== 0xff) {
      await writePage(nfc.manager, addrs.cfgPage, [cfg[0], cfg[1], 0xff, cfg[3]]);
    }
  } finally {
    try { await nfc.manager.cancelTechnologyRequest(); } catch {}
  }
}

// Scan 2 of check-out: erase the (now-unlocked) tag.
// Reads the header first to know how many data pages to clear, then zeroes them all.
export async function eraseNFCTag(): Promise<void> {
  if (Platform.OS === "web") throw new Error("NFC not supported on web");
  const nfc = loadNfc();
  if (!nfc) throw new Error("NFC module not available on this build");
  await ensureStarted(nfc.manager);

  try {
    await nfc.manager.requestTechnology(nfc.NfcTech.NfcA, {
      alertMessage: "Scan the wristband to erase — Step 2 of 2",
    } as any);

    // Read header to figure out how many pages to erase.
    let pagesToErase = 10; // fallback: always clear at least 10 pages
    try {
      const headerBytes = await readPages(nfc.manager, HEADER_PAGE);
      if (headerBytes[0] === MAGIC_1 && headerBytes[1] === MAGIC_2) {
        const payloadLength = (headerBytes[2] << 8) | headerBytes[3];
        if (payloadLength > 0 && payloadLength <= MAX_PAYLOAD_BYTES) {
          pagesToErase = Math.ceil(payloadLength / 4) + 2; // +2 for safety margin
        }
      }
    } catch { /* ignore header read failure — still proceed with erase */ }

    // Clear the header page first (invalidates the wristband immediately).
    await writePage(nfc.manager, HEADER_PAGE, [0x00, 0x00, 0x00, 0x00]);

    // Clear all data pages that had content.
    for (let p = DATA_START_PAGE; p < DATA_START_PAGE + pagesToErase; p++) {
      try {
        await writePage(nfc.manager, p, [0x00, 0x00, 0x00, 0x00]);
      } catch {
        break; // reached end of chip's writable range
      }
    }
  } finally {
    try { await nfc.manager.cancelTechnologyRequest(); } catch {}
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
