"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Logo } from "@/components/Logo";
import { ArrowRightIcon, ShieldIcon, SparklesIcon, UsersIcon } from "@/components/Icons";

type Mode = "signin" | "register";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/auth/${mode === "signin" ? "login" : "register"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "signin"
            ? { email, password }
            : { email, password, displayName },
        ),
      });
      const payload = (await response.json()) as { ok: boolean; error?: string };
      if (!payload.ok) {
        setError(payload.error ?? "Something went wrong. Try again.");
        return;
      }
      router.push("/library");
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-[-10%] h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-violet-600/20 blur-[130px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md"
      >
        <Link href="/" className="mb-8 flex justify-center">
          <Logo size={44} />
        </Link>

        <div className="glass-strong rounded-4xl p-9">
          <div className="glass mb-7 flex rounded-full p-1">
            {(["signin", "register"] as Mode[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  setMode(option);
                  setError(null);
                }}
                className={`flex-1 rounded-full py-2.5 text-sm font-medium transition-all duration-300 ${
                  mode === option
                    ? "accent-gradient text-white shadow-glow"
                    : "text-white/60 hover:text-white"
                }`}
              >
                {option === "signin" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-white">
            {mode === "signin" ? "Welcome back" : "Join Cabinet"}
          </h1>
          <p className="mt-2 text-sm text-white/55">
            {mode === "signin"
              ? "One account for the web app, the desktop app and TV mode."
              : "Create an account to sync your library, favourites and play history."}
          </p>

          <form onSubmit={submit} className="mt-7 space-y-4">
            {mode === "register" && (
              <div>
                <label htmlFor="name" className="sr-only">Display name</label>
                <input
                  id="name"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="Display name"
                  required
                  className="glass focus-ring w-full rounded-2xl px-5 py-3.5 text-sm text-white placeholder:text-white/35"
                />
              </div>
            )}
            <div>
              <label htmlFor="email" className="sr-only">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Email address"
                required
                className="glass focus-ring w-full rounded-2xl px-5 py-3.5 text-sm text-white placeholder:text-white/35"
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Password"
                required
                minLength={8}
                className="glass focus-ring w-full rounded-2xl px-5 py-3.5 text-sm text-white placeholder:text-white/35"
              />
            </div>

            {error && <p className="text-sm text-rose-300">{error}</p>}

            <button type="submit" disabled={busy} className="btn-primary w-full">
              {busy ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}
              <ArrowRightIcon size={16} />
            </button>
          </form>

          <div className="mt-6 space-y-2.5 text-xs text-white/45">
            <p className="flex items-center gap-2">
              <ShieldIcon size={13} className="text-emerald-300" />
              Passwords are hashed with scrypt — never stored in plain text.
            </p>
            <p className="flex items-center gap-2">
              <UsersIcon size={13} className="text-sky-300" />
              The first account created on a fresh instance becomes the admin.
            </p>
            <p className="flex items-center gap-2">
              <SparklesIcon size={13} className="text-violet-300" />
              Demo mode works without a database — just explore.
            </p>
          </div>
        </div>
      </motion.div>
    </main>
  );
}
