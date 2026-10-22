"use client";

/**
 * Samsung remote keys arrive through the packaged Tizen shell (apps/tizen)
 * as postMessages, because the hosted TV app runs inside its frame. This
 * forwarder turns them into ordinary window key events so TV Mode's
 * navigation hooks see exactly what they'd see in a desktop browser.
 */

import { useEffect } from "react";

export function TizenKeyForwarder() {
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data as
        | { type?: string; eventType?: string; key?: string; code?: string; keyCode?: number }
        | undefined;
      if (data?.type !== "cabinet-tv-key" || !data.key) return;
      const init: KeyboardEventInit = {
        key: data.key,
        code: data.code ?? "",
        bubbles: true,
        cancelable: true,
      };
      window.dispatchEvent(
        new KeyboardEvent(data.eventType === "keyup" ? "keyup" : "keydown", init),
      );
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return null;
}
