// Web stub for lib/nfc.ts
//
// On iOS/Android, Metro resolves lib/nfc.native.ts instead (platform-specific
// extension takes priority). This file is the web fallback and should only
// contain safe no-op stubs — NFC hardware is never available in a browser.
//
// Do NOT import react-native-nfc-manager here. It is a native module and will
// fail to resolve in a web/Node environment.

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
  return false;
}

export async function readNFCTag(): Promise<WristbandPayload | null> {
  throw new Error("NFC is not supported on web.");
}

export async function writeNFCTag(_payload: WristbandPayload): Promise<void> {
  throw new Error("NFC is not supported on web.");
}

export async function eraseNFCTag(): Promise<void> {
  throw new Error("NFC is not supported on web.");
}

export async function lockNFCTag(): Promise<void> {
  throw new Error("NFC is not supported on web.");
}

export async function unlockNFCTag(): Promise<void> {
  throw new Error("NFC is not supported on web.");
}

export function encryptPayloadForTag(_payload: WristbandPayload): string {
  throw new Error("NFC is not supported on web.");
}

export function decryptPayloadFromTag(_data: string): WristbandPayload | null {
  return null;
}
