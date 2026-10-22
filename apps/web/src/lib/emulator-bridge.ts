/**
 * Bridge to the EmulatorJS player frame.
 *
 * The frame (app/play/frame/route.ts) is same-origin, and its document handles
 * `cabinet:*` messages: getting/setting save states, capturing screenshots and
 * injecting synthetic key events (netplay input forwarding). Responses are
 * correlated by requestId.
 */

export interface BridgeRequest {
  type: "cabinet:getState" | "cabinet:loadState" | "cabinet:screenshot" | "cabinet:press";
  requestId?: string;
  bytes?: Uint8Array;
  action?: "keydown" | "keyup";
  key?: string;
  code?: string;
}

type Pending = {
  resolve: (value: Record<string, unknown>) => void;
  reject: (error: Error) => void;
  expected: string;
};

const pending = new Map<string, Pending>();
let installed = false;

function installListener(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener("message", (event) => {
    if (event.origin !== window.location.origin) return;
    const data = event.data as { type?: string; requestId?: string; message?: string } & Record<
      string,
      unknown
    >;
    if (!data?.type) return;
    const entry = data.requestId ? pending.get(data.requestId) : undefined;
    if (!entry) return;
    if (data.type === "cabinet:error") {
      pending.delete(data.requestId!);
      entry.reject(new Error(data.message ?? "emulator bridge error"));
      return;
    }
    if (data.type === entry.expected) {
      pending.delete(data.requestId!);
      entry.resolve(data);
    }
  });
}

function frameWindow(iframe: HTMLIFrameElement): Window {
  if (!iframe.contentWindow) throw new Error("player frame is not ready");
  return iframe.contentWindow;
}

function request(
  iframe: HTMLIFrameElement,
  message: BridgeRequest,
  expected: string,
  timeoutMs = 15_000,
): Promise<Record<string, unknown>> {
  installListener();
  const requestId = Math.random().toString(36).slice(2);
  return new Promise((resolve, reject) => {
    pending.set(requestId, { resolve, reject, expected });
    setTimeout(() => {
      if (pending.has(requestId)) {
        pending.delete(requestId);
        reject(new Error("emulator did not respond in time"));
      }
    }, timeoutMs);
    frameWindow(iframe).postMessage({ ...message, requestId }, window.location.origin);
  });
}

/** Capture the current save-state bytes from the running core. */
export async function captureState(iframe: HTMLIFrameElement): Promise<Uint8Array> {
  const data = await request(iframe, { type: "cabinet:getState" }, "cabinet:state");
  const bytes = data.bytes;
  if (bytes instanceof Uint8Array) return bytes;
  if (Array.isArray(bytes)) return new Uint8Array(bytes);
  throw new Error("no state returned");
}

/** Push state bytes into the running core. */
export async function loadState(iframe: HTMLIFrameElement, bytes: Uint8Array): Promise<void> {
  await request(iframe, { type: "cabinet:loadState", bytes }, "cabinet:stateLoaded", 30_000);
}

/** Capture the current frame as a PNG data URL. */
export async function captureScreenshot(iframe: HTMLIFrameElement): Promise<string | null> {
  const data = await request(iframe, { type: "cabinet:screenshot" }, "cabinet:screenshotResult");
  return typeof data.dataUrl === "string" ? data.dataUrl : null;
}

/** Forward one key event into the emulator (netplay input injection). */
export function pressKey(
  iframe: HTMLIFrameElement,
  action: "keydown" | "keyup",
  key: string,
  code: string,
): void {
  frameWindow(iframe).postMessage(
    { type: "cabinet:press", action, key, code },
    window.location.origin,
  );
}

// ─── base64 helpers (state bytes cross JSON API boundaries) ─────────────────

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Scale a PNG data URL down to a thumbnail (keeps API payloads small). */
export async function thumbnailFromDataUrl(dataUrl: string, maxSize = 160): Promise<string> {
  if (typeof document === "undefined") return dataUrl;
  try {
    const image = new Image();
    image.src = dataUrl;
    await image.decode();
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, maxSize / (image.width || maxSize));
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return dataUrl;
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  } catch {
    return dataUrl;
  }
}
