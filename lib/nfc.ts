import NfcManager, { NfcTech, Ndef } from 'react-native-nfc-manager';
import { Platform } from 'react-native';
import { encryptWristbandData, decryptWristbandData } from "./crypto";
import type { WristbandPayload } from "@/types";

export async function initNFC(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    await NfcManager.start();
    return true;
  } catch (e) {
    console.warn('NFC initialization failed', e);
    return false;
  }
}

export async function isNFCSupported(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  return await NfcManager.isSupported();
}

export async function isNFCEnabled(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  return await NfcManager.isEnabled();
}

export function isNFCSimulated(): boolean {
  return false; // Real NFC implementation
}

export async function readNFCTag(): Promise<WristbandPayload | null> {
  if (Platform.OS === 'web') return null;
  
  try {
    await NfcManager.requestTechnology([NfcTech.Ndef]);
    const tag = await NfcManager.getTag();
    if (tag && tag.ndefMessage && tag.ndefMessage.length > 0) {
      const record = tag.ndefMessage[0];
      const payload = Ndef.text.decodePayload(record.payload as any);
      return decryptWristbandData(payload) as WristbandPayload;
    }
    return null;
  } catch (e) {
    console.warn('NFC Read Error:', e);
    return null;
  } finally {
    NfcManager.cancelTechnologyRequest().catch(() => {});
  }
}

export async function writeNFCTag(payload: WristbandPayload, lock: boolean = true): Promise<void> {
  if (Platform.OS === 'web') throw new Error("NFC is not supported on web.");

  const encrypted = encryptWristbandData(payload);
  const bytes = Ndef.encodeMessage([Ndef.textRecord(encrypted)]);

  try {
    await NfcManager.requestTechnology([NfcTech.Ndef]);
    await NfcManager.ndefHandler.writeNdefMessage(bytes);
    
    if (lock) {
      // Standard NDEF locking (making it read-only)
      // Note: This is permanent on most tags!
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

  try {
    await NfcManager.requestTechnology([NfcTech.Ndef]);
    // Write empty NDEF message to "erase"
    await NfcManager.ndefHandler.writeNdefMessage([]);
  } catch (e) {
    throw e;
  } finally {
    NfcManager.cancelTechnologyRequest().catch(() => {});
  }
}

export function encryptPayloadForTag(payload: WristbandPayload): string {
  return encryptWristbandData(payload);
}

export function decryptPayloadFromTag(data: string): WristbandPayload | null {
  const result = decryptWristbandData(data);
  if (!result) return null;
  return result as WristbandPayload;
}
