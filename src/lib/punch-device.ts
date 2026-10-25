"use client";
// Browser punch identity for device binding: a non-extractable ECDSA P-256 key kept in IndexedDB. The private key can
// sign punches but can't be read or copied out of this browser profile, so another person's laptop or browser can't
// pretend to be this device. The server stores only the public key.

const DB = "northstar-punch";
const STORE = "keys";
const ID = "device";
type Stored = { privateKey: CryptoKey; publicKey: string };
export type PunchDevice = { publicKey: string; keyHash: string; label: string; sign: (message: string) => Promise<string> };

const b64 = (buffer: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buffer)));
const hex = (buffer: ArrayBuffer) => [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function tx<T>(db: IDBDatabase, mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const request = run(db.transaction(STORE, mode).objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function browserLabel() {
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Mac OS X/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "device";
  return `${browser} on ${os}`;
}

let cached: Promise<PunchDevice> | null = null;

/** This browser's punch device, created on first use. */
export function punchDevice(): Promise<PunchDevice> {
  cached ||= (async () => {
    if (!window.indexedDB || !crypto?.subtle) throw new Error("This browser can't hold a secure device key. Use the mobile app to punch.");
    const db = await open();
    let stored = await tx<Stored | undefined>(db, "readonly", (store) => store.get(ID));
    if (!stored) {
      const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, false, ["sign", "verify"]);
      stored = { privateKey: pair.privateKey, publicKey: b64(await crypto.subtle.exportKey("spki", pair.publicKey)) };
      await tx(db, "readwrite", (store) => store.put(stored, ID));
    }
    const { privateKey, publicKey } = stored;
    const keyHash = hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`webkey:${publicKey}`)));
    return {
      publicKey, keyHash, label: browserLabel(),
      sign: async (message: string) => b64(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, privateKey, new TextEncoder().encode(message))),
    };
  })().catch((error) => { cached = null; throw error; });
  return cached;
}

/** Must match punchMessage() in backend/src/platform/attendance/punch-guard.ts. */
export const punchMessage = (type: string, idempotencyKey: string, capturedAt: string) => `northstar-punch|${type}|${idempotencyKey}|${capturedAt}`;
