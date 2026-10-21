"use client";

import { useEffect, useRef } from "react";

/**
 * Shared shell input: keyboard + gamepad → one directional API.
 *
 * Every console-style shell (PS5, Nintendo, 3DS, PS3 XMB) navigates with the
 * same grammar — arrows/dpad to move, Enter/A to confirm, Escape/B to go
 * back — so this hook normalises keyboards and the Gamepad API into those
 * events. D-pad (buttons 12–15), left stick (axes 0/1) and face buttons
 * (0 = confirm, 1 = back) are supported.
 */

export type ShellDirection = "up" | "down" | "left" | "right";

export interface ShellInputHandlers {
  onDirection: (direction: ShellDirection) => void;
  onConfirm: () => void;
  onBack: () => void;
}

const KEY_MAP: Record<string, ShellDirection> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

const GAMEPAD_DPAD: Record<number, ShellDirection> = {
  12: "up",
  13: "down",
  14: "left",
  15: "right",
};

export function useShellInput(handlers: ShellInputHandlers): void {
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;

      const direction = KEY_MAP[event.key];
      if (direction) {
        event.preventDefault();
        ref.current.onDirection(direction);
        return;
      }
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        ref.current.onConfirm();
        return;
      }
      if (event.key === "Escape" || event.key === "Backspace") {
        event.preventDefault();
        ref.current.onBack();
      }
    }

    window.addEventListener("keydown", onKeyDown);

    // Gamepad polling — edge-triggered so held buttons don't repeat wildly.
    let frame = 0;
    const previous = new Map<number, Set<string>>();
    const STICK_DEADZONE = 0.55;
    const REPEAT_MS = 170;
    const lastFire = new Map<string, number>();

    function fire(key: string, action: () => void) {
      const now = performance.now();
      if ((lastFire.get(key) ?? 0) + REPEAT_MS > now) return;
      lastFire.set(key, now);
      action();
    }

    function poll() {
      const pads = navigator.getGamepads?.() ?? [];
      for (const pad of pads) {
        if (!pad) continue;
        const seen = new Set<string>();

        for (const [index, direction] of Object.entries(GAMEPAD_DPAD)) {
          const pressed = pad.buttons[Number(index)]?.pressed;
          const key = `b${index}`;
          if (pressed) {
            seen.add(key);
            fire(`pad${pad.index}:${key}`, () => ref.current.onDirection(direction));
          }
        }

        // Left stick with hysteresis per axis.
        const axes: Array<[number, ShellDirection, ShellDirection]> = [
          [0, "left", "right"],
          [1, "up", "down"],
        ];
        for (const [axisIndex, negative, positive] of axes) {
          const value = pad.axes[axisIndex] ?? 0;
          const key = `a${axisIndex}`;
          if (value < -STICK_DEADZONE) {
            seen.add(key);
            fire(`pad${pad.index}:${key}-`, () => ref.current.onDirection(negative));
          } else if (value > STICK_DEADZONE) {
            seen.add(key);
            fire(`pad${pad.index}:${key}+`, () => ref.current.onDirection(positive));
          }
        }

        if (pad.buttons[0]?.pressed && !previous.get(pad.index)?.has("b0")) {
          ref.current.onConfirm();
        }
        if (pad.buttons[1]?.pressed && !previous.get(pad.index)?.has("b1")) {
          ref.current.onBack();
        }
        seen.add("b0");
        seen.add("b1");
        if (!pad.buttons[0]?.pressed) seen.delete("b0");
        if (!pad.buttons[1]?.pressed) seen.delete("b1");
        previous.set(pad.index, seen);
      }
      frame = requestAnimationFrame(poll);
    }
    frame = requestAnimationFrame(poll);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      cancelAnimationFrame(frame);
    };
  }, []);
}
