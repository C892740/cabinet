"use client";

/**
 * Phone ↔ TV linking on the TV side ("Smart View"-style).
 *
 * The TV mints a short code; the Cabinet phone app claims it; the TV user
 * approves the phone on-screen. The server compares both devices' egress IPs
 * to verify they sit behind the same router (the "same Wi-Fi" link the phone
 * needs before it auto-imports ROMs into the shared library).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { PadGlyph } from "./GamepadNavMap";

export interface PairView {
  code: string;
  deviceName: string;
  phoneName: string;
  phoneModel: string;
  status: "waiting" | "claimed" | "linked" | "removed";
  sameNetwork: boolean;
  linkedAt: string | null;
  tvLastSeenAt: string | null;
  phoneLastSeenAt: string | null;
  createdAt: string;
  expiresAt: string;
}

async function pairFetch<T>(path: string, init?: RequestInit): Promise<T | null> {
  try {
    const response = await fetch(path, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function formatCode(code: string): string {
  return code.length > 3 ? `${code.slice(0, 3)}-${code.slice(3)}` : code;
}

/** Compact header pill: how many phones are linked right now. */
export function PhoneLinkBadge({
  onOpen,
  focusable = true,
}: {
  onOpen: () => void;
  focusable?: boolean;
}) {
  const [linked, setLinked] = useState<PairView[] | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const data = await pairFetch<{ ok: boolean; pairs: PairView[] }>("/api/pair/list");
      if (alive) setLinked(data?.pairs ?? []);
    };
    void load();
    const timer = window.setInterval(load, 30_000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  const count = linked?.length ?? 0;
  return (
    <button
      type="button"
      onClick={onOpen}
      {...(focusable ? { "data-tv-focusable": true } : {})}
      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm outline-none transition-transform duration-200 focus-visible:scale-[1.05] ${
        count > 0
          ? "border border-sky-400/30 bg-sky-400/10 text-sky-200"
          : "glass text-white/75"
      }`}
    >
      <span aria-hidden>📱</span>
      {count > 0
        ? `${count} phone${count > 1 ? "s" : ""} linked`
        : "Link a phone"}
    </button>
  );
}

/** Full pairing overlay: code display, approval prompt, linked phones. */
export function PhonePairPanel({ onClose }: { onClose: () => void }) {
  const [pair, setPair] = useState<PairView | null>(null);
  const [expired, setExpired] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const pollRef = useRef<number | null>(null);

  const loadStatus = useCallback(async () => {
    if (!pair?.code) return;
    const data = await pairFetch<{ ok: boolean; pair: PairView; expired: boolean }>(
      `/api/pair/status?code=${pair.code}`,
    );
    if (data?.pair) {
      setPair(data.pair);
      setExpired(Boolean(data.expired));
    }
  }, [pair?.code]);

  // Poll while a code is live: the phone's claim flips the state to "claimed".
  useEffect(() => {
    if (!pair?.code || pair.status === "linked") return;
    pollRef.current = window.setInterval(() => void loadStatus(), 2500);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [pair?.code, pair?.status, loadStatus]);

  // Once linked, the TV heartbeats so the phone's "TV present" check stays true.
  useEffect(() => {
    if (pair?.status !== "linked") return;
    const beat = () =>
      void pairFetch("/api/pair/verify", {
        method: "POST",
        body: JSON.stringify({ code: pair.code, side: "tv" }),
      });
    beat();
    const timer = window.setInterval(beat, 45_000);
    return () => window.clearInterval(timer);
  }, [pair?.status, pair?.code]);

  // Clock for the countdown label.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const startPairing = async () => {
    setBusy(true);
    setError("");
    const data = await pairFetch<{ ok: boolean; pair: PairView; error?: string }>(
      "/api/pair/start",
      {
        method: "POST",
        body: JSON.stringify({ tvName: "Living Room TV" }),
      },
    );
    setBusy(false);
    if (data?.pair) {
      setPair(data.pair);
      setExpired(false);
    } else {
      setError(data?.error ?? "Could not open a pairing code — are you signed in?");
    }
  };

  const approve = async (ok: boolean) => {
    if (!pair) return;
    setBusy(true);
    const data = await pairFetch<{ ok: boolean; pair?: PairView; error?: string }>(
      "/api/pair/approve",
      {
        method: "POST",
        body: JSON.stringify({ code: pair.code, approve: ok }),
      },
    );
    setBusy(false);
    if (ok && data?.pair) setPair(data.pair);
    else onClose();
    if (!data?.ok && data?.error) setError(data.error);
  };

  const unpair = async () => {
    if (!pair) return;
    await pairFetch("/api/pair/unpair", {
      method: "POST",
      body: JSON.stringify({ code: pair.code }),
    });
    onClose();
  };

  const secondsLeft = pair ? Math.max(0, Math.ceil((Date.parse(pair.expiresAt) - now) / 1000)) : 0;
  const mmss = `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm">
      <div className="glass-strong w-full max-w-2xl rounded-4xl p-8">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h2 className="text-2xl font-semibold text-white">Link your phone</h2>
            <p className="mt-1 text-sm text-white/55">
              Cabinet on your phone finds ROMs and adds them to this library — but only while the
              phone is on the same Wi-Fi as this TV.
            </p>
          </div>
          <button
            type="button"
            data-tv-focusable
            onClick={onClose}
            className="glass inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm text-white/80 outline-none transition-transform duration-200 focus-visible:scale-[1.05]"
          >
            Close
            <PadGlyph kind="circle" size={14} />
          </button>
        </div>

        {error && (
          <p className="mt-4 rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-2.5 text-sm text-rose-200">
            {error}
          </p>
        )}

        {!pair && (
          <div className="mt-8 flex flex-col items-center gap-4">
            <p className="text-center text-white/70">
              On your phone, open Cabinet → <span className="text-white">Link TV</span> and enter
              the code shown here.
            </p>
            <button
              type="button"
              data-tv-focusable
              data-tv-autofocus
              onClick={() => void startPairing()}
              disabled={busy}
              className="accent-gradient inline-flex items-center gap-2 rounded-full px-8 py-4 text-base font-semibold text-white shadow-glow outline-none transition-transform duration-200 focus-visible:scale-[1.05] disabled:opacity-60"
            >
              <PadGlyph kind="cross" size={16} />
              {busy ? "Opening…" : "Show pairing code"}
            </button>
          </div>
        )}

        {pair && pair.status !== "linked" && (
          <div className="mt-8 flex flex-col items-center gap-5">
            <p className="text-sm uppercase tracking-[0.3em] text-white/45">Enter this code</p>
            <p className="font-mono text-6xl font-bold tracking-[0.18em] text-white">
              {formatCode(pair.code)}
            </p>
            <p className="text-sm text-white/50">
              {expired ? "Code expired — open a new one." : `Expires in ${mmss}`}
            </p>
            {expired ? (
              <button
                type="button"
                data-tv-focusable
                onClick={() => void startPairing()}
                className="accent-gradient rounded-full px-7 py-3 text-sm font-semibold text-white shadow-glow outline-none transition-transform duration-200 focus-visible:scale-[1.05]"
              >
                New code
              </button>
            ) : pair.status === "claimed" ? (
              <div className="glass flex flex-col items-center gap-4 rounded-3xl px-8 py-6">
                <p className="text-lg text-white">
                  <span className="font-semibold">{pair.phoneName || "A phone"}</span>
                  {pair.phoneModel ? ` (${pair.phoneModel})` : ""} wants to link
                </p>
                <p
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm ${
                    pair.sameNetwork
                      ? "bg-emerald-400/10 text-emerald-200"
                      : "bg-amber-400/10 text-amber-200"
                  }`}
                >
                  {pair.sameNetwork
                    ? "✓ On the same Wi-Fi as this TV"
                    : "⚠ Could not confirm the same Wi-Fi"}
                </p>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    data-tv-focusable
                    data-tv-autofocus
                    onClick={() => void approve(true)}
                    disabled={busy}
                    className="accent-gradient inline-flex items-center gap-2 rounded-full px-7 py-3 text-sm font-semibold text-white shadow-glow outline-none transition-transform duration-200 focus-visible:scale-[1.05] disabled:opacity-60"
                  >
                    <PadGlyph kind="cross" size={15} />
                    Link
                  </button>
                  <button
                    type="button"
                    data-tv-focusable
                    onClick={() => void approve(false)}
                    className="glass inline-flex items-center gap-2 rounded-full px-7 py-3 text-sm text-white/80 outline-none transition-transform duration-200 focus-visible:scale-[1.05]"
                  >
                    Decline
                    <PadGlyph kind="circle" size={15} />
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-white/60">Waiting for the phone to enter the code…</p>
            )}
          </div>
        )}

        {pair && pair.status === "linked" && (
          <div className="mt-8 flex flex-col items-center gap-5">
            <p className="text-2xl text-white">
              ✓ {(pair.phoneName || "Phone") + (pair.phoneModel ? ` · ${pair.phoneModel}` : "")}{" "}
              linked
            </p>
            <p
              className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm ${
                pair.sameNetwork
                  ? "bg-emerald-400/10 text-emerald-200"
                  : "bg-amber-400/10 text-amber-200"
              }`}
            >
              {pair.sameNetwork
                ? "Same Wi-Fi ✓ — ROMs on the phone auto-import to this library"
                : "Different networks — auto-import is paused until both are on the same Wi-Fi"}
            </p>
            <button
              type="button"
              data-tv-focusable
              data-tv-autofocus
              onClick={() => void unpair()}
              className="glass inline-flex items-center gap-2 rounded-full px-7 py-3 text-sm text-white/80 outline-none transition-transform duration-200 focus-visible:scale-[1.05]"
            >
              Unlink phone
              <PadGlyph kind="circle" size={15} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
