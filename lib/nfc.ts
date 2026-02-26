import { encryptWristbandData, decryptWristbandData } from "./crypto";
import type { WristbandPayload } from "@/types";

export async function initNFC(): Promise<boolean> {
  return false;
}

export async function isNFCSupported(): Promise<boolean> {
  return false;
}

export async function isNFCEnabled(): Promise<boolean> {
  return false;
}

export function isNFCSimulated(): boolean {
  return true;
}

export async function readNFCTag(): Promise<WristbandPayload | null> {
  return null;
}

export async function writeNFCTag(_payload: WristbandPayload): Promise<void> {
  throw new Error("NFC is not supported on web.");
}

export function encryptPayloadForTag(payload: WristbandPayload): string {
  return encryptWristbandData(payload);
}

export function decryptPayloadFromTag(data: string): WristbandPayload | null {
  const result = decryptWristbandData(data);
  if (!result) return null;
  return result as WristbandPayload;
}
