"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { LockIcon, ShieldIcon, UnlockIcon } from "../Icons";

export function KeyPrompt() {
  const router = useRouter();
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      const payload = (await response.json()) as { ok: boolean; error?: string };
      if (!payload.ok) {
        setError(
          payload.error === "missing-config"
            ? "No admin key is configured on this server. Set ADMIN_KEY or ADMIN_KEY_HASH."
            : "That key doesn't match. Try again.",
        );
        return;
      }
      router.refresh();
    } catch {
      setError("Could not reach the server. Check your connection.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="glass-strong w-full max-w-md rounded-4xl p-9"
      >
        <div className="flex flex-col items-center text-center">
          <span className="accent-gradient inline-flex h-16 w-16 items-center justify-center rounded-3xl text-white shadow-glow">
            <LockIcon size={30} />
          </span>
          <h1 className="mt-6 text-2xl font-semibold tracking-tight text-white">
            Admin dashboard
          </h1>
          <p className="mt-2.5 text-sm leading-relaxed text-white/55">
            This area is protected by a key-password. Enter the admin key to continue —
            sessions expire after 8 hours.
          </p>
        </div>

        <form onSubmit={submit} className="mt-8">
          <motion.div animate={error ? { x: [0, -10, 10, -6, 6, 0] } : {}} transition={{ duration: 0.45 }}>
            <label htmlFor="admin-key" className="sr-only">
              Admin key
            </label>
            <div className="glass flex items-center gap-3 rounded-full px-5 py-3.5 transition-colors focus-within:border-white/30">
              <UnlockIcon size={19} className="text-white/50" />
              <input
                id="admin-key"
                type="password"
                value={key}
                onChange={(event) => setKey(event.target.value)}
                placeholder="Enter admin key-password"
                autoComplete="off"
                autoFocus
                className="w-full bg-transparent text-sm text-white placeholder:text-white/35 focus:outline-none"
              />
            </div>
          </motion.div>

          {error && (
            <p className="mt-3 text-center text-sm text-rose-300">{error}</p>
          )}

          <button
            type="submit"
            disabled={busy || key.length === 0}
            className="btn-primary mt-6 w-full disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ShieldIcon size={17} />
            {busy ? "Checking…" : "Unlock dashboard"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs leading-relaxed text-white/35">
          On desktop, the key is held in an AES-256-GCM encrypted vault and converted to
          readable form only when you unlock it.
        </p>
      </motion.div>
    </div>
  );
}
