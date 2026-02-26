import { Platform } from "react-native";
import NfcManager, { NfcTech, Ndef } from "react-native-nfc-manager";
import { encryptWristbandData, decryptWristbandData } from "./crypto";
import type { WristbandPayload } from "@/types";

const CAMPSYNC_TAG_PREFIX = "CAMPSYNC:";

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

export async function readNFCTag(): Promise<WristbandPayload | null> {
  if (Platform.OS === "web") return null;

  try {
    await NfcManager.requestTechnology(NfcTech.Ndef, {
      alertMessage: "Hold your iPhone near a CampSync wristband",
    });

    const tag = await NfcManager.getTag();
    if (!tag?.ndefMessage || tag.ndefMessage.length === 0) {
      return null;
    }

    const record = tag.ndefMessage[0];
    const text = Ndef.text.decodePayload(record.payload as unknown as Uint8Array);

    if (!text.startsWith(CAMPSYNC_TAG_PREFIX)) {
      return null;
    }

    const encrypted = text.slice(CAMPSYNC_TAG_PREFIX.length);
    return decryptPayloadFromTag(encrypted);
  } finally {
    try {
      await NfcManager.cancelTechnologyRequest();
    } catch {}
  }
}

export async function writeNFCTag(payload: WristbandPayload): Promise<void> {
  if (Platform.OS === "web") throw new Error("NFC not supported on web");

  try {
    await NfcManager.requestTechnology(NfcTech.Ndef, {
      alertMessage: "Hold iPhone near the blank wristband to program it",
    });

    const encrypted = encryptPayloadForTag(payload);
    const tagContent = CAMPSYNC_TAG_PREFIX + encrypted;
    const bytes = Ndef.encodeMessage([Ndef.textRecord(tagContent)]);

    if (bytes) {
      await NfcManager.ndefHandler.writeNdefMessage(bytes);
    }
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
