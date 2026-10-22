/**
 * EmulatorJS player frame.
 *
 * EmulatorJS manipulates the DOM aggressively and its own docs recommend an
 * iframe over embedding inside a React tree, so the core + config live in a
 * standalone HTML document served here. The parent play page (same origin)
 * passes the ROM as a blob: URL or a same-origin account stream and talks to
 * `window.EJS_emulator` directly.
 */

import { isKnownEjsCore } from "@/lib/emulator-cores";

export const runtime = "nodejs";

// The official CDN "stable" alias (4.2.x at time of writing). Override with
// EMULATORJS_DATA_URL to pin a version or self-host the data directory.
const EJS_DATA = (
  process.env.EMULATORJS_DATA_URL ?? "https://cdn.emulatorjs.org/stable/data/"
).replace(/\/?$/, "/");

/** Stable FNV-1a hash → positive 32-bit id for EJS_gameID. */
function stableNumericId(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) || 1;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const core = url.searchParams.get("core") ?? "";
  const gameUrl = url.searchParams.get("gameUrl") ?? "";
  const gameName = (url.searchParams.get("name") ?? "Cabinet game").slice(0, 120);
  const gameId = (url.searchParams.get("gameId") ?? "").slice(0, 64);
  // EmulatorJS requires a numeric EJS_gameID (it keys saves/state caches and
  // its netplay on it) — derive a stable 32-bit id from the rom id or name.
  const numericId = stableNumericId(gameId || gameName);

  if (!isKnownEjsCore(core)) {
    return new Response("unknown core", { status: 400 });
  }
  // Only blob: URLs handed out by our own play page, same-origin ROM streams
  // (/api/roms/[id]/rom), or remote https ROMs.
  const gameUrlOk =
    gameUrl.startsWith("blob:") ||
    (gameUrl.startsWith("/") && !gameUrl.startsWith("//")) ||
    (gameUrl.startsWith("https://") && gameUrl.length < 2000);
  if (!gameUrlOk) {
    return new Response("invalid gameUrl", { status: 400 });
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(gameName)} — Cabinet</title>
<style>
  html, body { margin: 0; height: 100%; background: #07070b; color: #f5f5f7; }
  #game { width: 100%; height: 100%; }
</style>
<script>
  // EmulatorJS configuration — must run before loader.js.
  EJS_player = "#game";
  EJS_core = ${JSON.stringify(core)};
  EJS_gameUrl = ${JSON.stringify(gameUrl)};
  EJS_pathtodata = ${JSON.stringify(EJS_DATA)};
  EJS_gameName = ${JSON.stringify(gameName)};
  EJS_gameID = ${numericId};
  EJS_startOnLoaded = true;
  EJS_color = "#8b5cf6";

  // Latest known state, cached from the documented save-state callback so the
  // bridge still works if the internal gameManager API is unavailable in the
  // EmulatorJS build in use (it is version-sensitive, per their docs).
  var lastState = null;
  function stateFrom(value) {
    if (value instanceof Uint8Array) return value;
    if (value && value.buffer instanceof ArrayBuffer) return new Uint8Array(value.buffer);
    return null;
  }
  // Documented hook: fires when the player presses EmulatorJS's save-state
  // button. The docs describe [screenshot, saveState]; scan for the bytes so
  // the order stays irrelevant. The parent auto-syncs states saved this way.
  EJS_onSaveState = function (event) {
    var items = Array.isArray(event) ? event : [event];
    for (var i = 0; i < items.length; i += 1) {
      var bytes = stateFrom(items[i]);
      if (bytes && bytes.length > 64) {
        lastState = bytes;
        window.parent.postMessage({ type: "cabinet:uiStateSaved", bytes: bytes }, window.location.origin);
        return;
      }
    }
    // Unknown shape — tell the parent to capture through the bridge instead.
    window.parent.postMessage({ type: "cabinet:uiStateSaved" }, window.location.origin);
  };
  // Cloud save/load hooks fire for the built-in state buttons too.
  window.addEventListener("message", function (event) {
    if (event.origin !== window.location.origin) return;
    var data = event.data || {};
    if (data.type === "cabinet:loadState" && window.EJS_emulator?.gameManager) {
      try {
        var incoming = data.bytes instanceof Uint8Array ? data.bytes : new Uint8Array(data.bytes);
        window.EJS_emulator.gameManager.loadState(incoming);
        lastState = incoming;
        event.source.postMessage({ type: "cabinet:stateLoaded" }, event.origin);
      } catch (error) {
        event.source.postMessage({ type: "cabinet:error", message: String(error) }, event.origin);
      }
    }
    if (data.type === "cabinet:getState") {
      try {
        var state = window.EJS_emulator?.gameManager ? window.EJS_emulator.gameManager.getState() : null;
        if (!state) state = lastState;
        if (!state) throw new Error("no state available yet");
        // Uint8Array is structured-cloned across postMessage — no JSON bloat.
        event.source.postMessage(
          { type: "cabinet:state", requestId: data.requestId, bytes: state },
          event.origin,
        );
      } catch (error) {
        event.source.postMessage({ type: "cabinet:error", requestId: data.requestId, message: String(error) }, event.origin);
      }
    }
    if (data.type === "cabinet:screenshot") {
      try {
        var canvas = document.querySelector("#game canvas");
        var dataUrl = canvas ? canvas.toDataURL("image/png") : null;
        event.source.postMessage({ type: "cabinet:screenshotResult", requestId: data.requestId, dataUrl }, event.origin);
      } catch (error) {
        event.source.postMessage({ type: "cabinet:error", requestId: data.requestId, message: String(error) }, event.origin);
      }
    }
    if (data.type === "cabinet:press" && window.EJS_emulator) {
      // Synthetic key events drive the host emulator during netplay.
      var target = window;
      target.dispatchEvent(new KeyboardEvent(data.action, { key: data.key, code: data.code, bubbles: true }));
    }
  });
</script>
</head>
<body>
<div id="game"></div>
<script src="${escapeHtml(EJS_DATA)}loader.js"></script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
