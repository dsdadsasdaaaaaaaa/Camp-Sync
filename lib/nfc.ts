import NfcManager, { NfcTech, Ndef } from 'react-native-nfc-manager';
import { Platform } from 'react-native';
import { encryptWristbandData, decryptWristbandData } from "./crypto";
import type { WristbandPayload } from "@/types";

let _nfcStarted = false;

async function ensureStarted(): Promise<void> {
  if (_nfcStarted) return;
  try {
    await NfcManager.start();
    _nfcStarted = true;
  } catch (e: any) {
    const msg = typeof e === 'string' ? e : e?.message ?? '';
    console.warn('NfcManager.start() error:', msg);
    throw new Error(`NFC initialization failed: ${msg || 'unknown error'}`);
  }
}

export async function initNFC(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    await ensureStarted();
    return true;
  } catch (e) {
    console.warn('NFC initNFC failed:', e);
    return false;
  }
}

export async function isNFCSupported(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    await ensureStarted();
    const supported = await NfcManager.isSupported();
    return supported;
  } catch (e) {
    console.warn('NFC isSupported check failed:', e);
    return false;
  }
}

export async function isNFCEnabled(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    await ensureStarted();
    return await NfcManager.isEnabled();
  } catch {
    return false;
  }
}

export function isNFCSimulated(): boolean {
  return false;
}

export async function readNFCTag(): Promise<WristbandPayload | null> {
  if (Platform.OS === 'web') return null;

  await ensureStarted();

  try {
    await NfcManager.requestTechnology([NfcTech.Ndef]);
  } catch (e: any) {
    const msg = typeof e === 'string' ? e : e?.message ?? 'unknown';
    console.warn('NFC requestTechnology failed:', msg);
    throw new Error(`Could not start NFC session: ${msg}`);
  }

  try {
    const tag = await NfcManager.getTag();
    if (tag && tag.ndefMessage && tag.ndefMessage.length > 0) {
      const record = tag.ndefMessage[0];
      const payload = Ndef.text.decodePayload(record.payload as any);
      return decryptWristbandData(payload) as WristbandPayload;
    }
    return null;
  } catch (e) {
    console.warn('NFC Read Error:', e);
    throw e;
  } finally {
    NfcManager.cancelTechnologyRequest().catch(() => {});
  }
}

export async function writeNFCTag(payload: WristbandPayload, lock: boolean = false): Promise<void> {
  if (Platform.OS === 'web') throw new Error("NFC is not supported on web.");

  await ensureStarted();

  const encrypted = encryptWristbandData(payload);
  const bytes = Ndef.encodeMessage([Ndef.textRecord(encrypted)]);

  try {
    await NfcManager.requestTechnology([NfcTech.Ndef]);
  } catch (e: any) {
    const msg = typeof e === 'string' ? e : e?.message ?? 'unknown';
    console.warn('NFC requestTechnology failed:', msg);
    throw new Error(`Could not start NFC session: ${msg}`);
  }

  try {
    await NfcManager.ndefHandler.writeNdefMessage(bytes);

    if (lock) {
      try {
        await NfcManager.ndefHandler.makeReadOnly();
      } catch (e) {
        console.warn('Tag locking failed (might already be locked or unsupported):', e);
      }
    }
  } catch (e) {
    throw e;
  } finally {
    NfcManager.cancelTechnologyRequest().catch(() => {});
  }
}

export async function eraseNFCTag(): Promise<void> {
  if (Platform.OS === 'web') throw new Error("NFC is not supported on web.");

  await ensureStarted();

  try {
    await NfcManager.requestTechnology([NfcTech.Ndef]);
  } catch (e: any) {
    const msg = typeof e === 'string' ? e : e?.message ?? 'unknown';
    console.warn('NFC requestTechnology failed:', msg);
    throw new Error(`Could not start NFC session: ${msg}`);
  }

  try {
    await NfcManager.ndefHandler.writeNdefMessage([]);
  } catch (e) {
    throw e;
  } finally {
    NfcManager.cancelTechnologyRequest().catch(() => {});
  }
}

export async function lockNFCTag(): Promise<void> {
  if (Platform.OS === 'web') throw new Error("NFC is not supported on web.");

  await ensureStarted();

  try {
    await NfcManager.requestTechnology([NfcTech.Ndef]);
  } catch (e: any) {
    const msg = typeof e === 'string' ? e : e?.message ?? 'unknown';
    console.warn('NFC requestTechnology failed:', msg);
    throw new Error(`Could not start NFC session: ${msg}`);
  }

  try {
    await NfcManager.ndefHandler.makeReadOnly();
  } catch (e) {
    throw e;
  } finally {
    NfcManager.cancelTechnologyRequest().catch(() => {});
  }
}

export async function unlockNFCTag(): Promise<void> {
  if (Platform.OS === 'web') throw new Error("NFC is not supported on web.");
  throw new Error("NFC tags cannot be unlocked once made read-only.");
}

export function encryptPayloadForTag(payload: WristbandPayload): string {
  return encryptWristbandData(payload);
}

export function decryptPayloadFromTag(data: string): WristbandPayload | null {
  const result = decryptWristbandData(data);
  if (!result) return null;
  return result as WristbandPayload;
}
