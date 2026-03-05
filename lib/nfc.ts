import NfcManager, { NfcTech, Ndef } from 'react-native-nfc-manager';
import { Platform } from 'react-native';
import { encryptWristbandData, decryptWristbandData } from "./crypto";
import type { WristbandPayload } from "@/types";

let nfcStarted = false;

async function ensureStarted(): Promise<void> {
  if (nfcStarted) return;
  try {
    await NfcManager.start();
    nfcStarted = true;
  } catch (e: any) {
    console.warn('[NFC] start() failed:', e?.message || e);
    throw new Error(`NFC initialization failed: ${e?.message || 'Unknown error'}. Make sure NFC is enabled in Settings.`);
  }
}

export async function initNFC(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    await ensureStarted();
    return true;
  } catch (e) {
    console.warn('[NFC] initNFC failed:', e);
    return false;
  }
}

export async function isNFCSupported(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    await ensureStarted();
    const supported = await NfcManager.isSupported();
    console.log('[NFC] isSupported:', supported);
    return supported;
  } catch (e: any) {
    console.warn('[NFC] isSupported check failed:', e?.message || e);
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
    console.log('[NFC] Requesting NDEF technology...');
    await NfcManager.requestTechnology(NfcTech.Ndef);
    console.log('[NFC] Technology acquired, getting tag...');

    const tag = await NfcManager.getTag();
    console.log('[NFC] Tag received:', tag ? `${tag.ndefMessage?.length || 0} NDEF records` : 'null');

    if (tag && tag.ndefMessage && tag.ndefMessage.length > 0) {
      const record = tag.ndefMessage[0];
      console.log('[NFC] Record type:', record.tnf, 'payload length:', record.payload?.length);

      const textPayload = Ndef.text.decodePayload(new Uint8Array(record.payload as any));
      console.log('[NFC] Decoded text length:', textPayload?.length);

      const result = decryptWristbandData(textPayload);
      if (!result) {
        console.warn('[NFC] Decryption returned null — tag may not contain CampSync data');
        return null;
      }
      return result as WristbandPayload;
    }

    console.warn('[NFC] Tag has no NDEF message');
    return null;
  } catch (e: any) {
    const msg = e?.message || String(e);
    console.warn('[NFC] Read error:', msg);

    if (msg.includes('cancelled') || msg.includes('cancel') || msg.includes('UserCancel') || msg.includes('invalidated')) {
      throw new Error('UserCancel');
    }

    throw new Error(`Failed to read NFC tag: ${msg}`);
  } finally {
    try {
      await NfcManager.cancelTechnologyRequest();
    } catch {}
  }
}

export async function writeNFCTag(payload: WristbandPayload, lock: boolean = false): Promise<void> {
  if (Platform.OS === 'web') throw new Error("NFC is not supported on web.");

  await ensureStarted();

  const encrypted = encryptWristbandData(payload);
  console.log('[NFC] Encrypted payload length:', encrypted.length, 'bytes');

  const bytes = Ndef.encodeMessage([Ndef.textRecord(encrypted)]);
  console.log('[NFC] NDEF message encoded, total bytes:', bytes?.length);

  try {
    console.log('[NFC] Requesting NDEF technology for write...');
    await NfcManager.requestTechnology(NfcTech.Ndef);
    console.log('[NFC] Technology acquired, writing...');

    await NfcManager.ndefHandler.writeNdefMessage(bytes);
    console.log('[NFC] Write successful');

    if (lock) {
      try {
        await NfcManager.ndefHandler.makeReadOnly();
        console.log('[NFC] Tag locked successfully');
      } catch (e: any) {
        console.warn('[NFC] Tag locking failed:', e?.message);
      }
    }
  } catch (e: any) {
    const msg = e?.message || String(e);
    console.warn('[NFC] Write error:', msg);

    if (msg.includes('cancelled') || msg.includes('cancel') || msg.includes('UserCancel') || msg.includes('invalidated')) {
      throw new Error('UserCancel');
    }

    if (msg.includes('not NDEF') || msg.includes('not ndef')) {
      throw new Error('This tag is not NDEF formatted. Please use an NDEF-compatible NFC tag.');
    }

    if (msg.includes('read only') || msg.includes('readonly') || msg.includes('locked')) {
      throw new Error('This tag is read-only and cannot be written to. Please use a new NFC tag.');
    }

    if (msg.includes('too large') || msg.includes('capacity')) {
      throw new Error('The camper data is too large for this NFC tag. Try shortening medical field entries.');
    }

    throw new Error(`Failed to write NFC tag: ${msg}`);
  } finally {
    try {
      await NfcManager.cancelTechnologyRequest();
    } catch {}
  }
}

export async function eraseNFCTag(): Promise<void> {
  if (Platform.OS === 'web') throw new Error("NFC is not supported on web.");

  await ensureStarted();

  try {
    console.log('[NFC] Requesting NDEF technology for erase...');
    await NfcManager.requestTechnology(NfcTech.Ndef);
    console.log('[NFC] Technology acquired, erasing...');

    const emptyMessage = Ndef.encodeMessage([Ndef.textRecord('')]);
    await NfcManager.ndefHandler.writeNdefMessage(emptyMessage);
    console.log('[NFC] Erase successful');
  } catch (e: any) {
    const msg = e?.message || String(e);
    console.warn('[NFC] Erase error:', msg);

    if (msg.includes('cancelled') || msg.includes('cancel') || msg.includes('UserCancel') || msg.includes('invalidated')) {
      throw new Error('UserCancel');
    }

    throw new Error(`Failed to erase NFC tag: ${msg}`);
  } finally {
    try {
      await NfcManager.cancelTechnologyRequest();
    } catch {}
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
