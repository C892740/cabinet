"use client";

/**
 * Desktop emulator profiles.
 *
 * Profiles are synced to the account; the actual launch happens through the
 * Cabinet Desktop bridge (window.cabinet). In a plain browser the panel still
 * manages profiles and explains the flow — honesty over dead buttons.
 */

import { useCallback, useEffect, useState } from "react";
import { CORE_BY_PLATFORM, DESKTOP_ONLY_PLATFORMS } from "@/lib/emulator-cores";
import type { EmulatorProfile } from "@/lib/types";

interface DesktopBridge {
  pickFile(filters: { name: string; extensions: string[] }[]): Promise<string | null>;
  launchEmulator(input: {
    emulatorPath: string;
    romPath: string;
    args?: string[];
  }): Promise<{ ok: boolean; error?: string }>;
}

function desktopBridge(): DesktopBridge | null {
  return typeof window !== "undefined" && (window as unknown as { cabinet?: DesktopBridge }).cabinet
    ? ((window as unknown as { cabinet?: DesktopBridge }).cabinet ?? null)
    : null;
}

const PLATFORM_OPTIONS = [
  ...Object.keys(CORE_BY_PLATFORM).map((slug) => ({ slug, label: slug.toUpperCase() })),
  ...Object.keys(DESKTOP_ONLY_PLATFORMS).map((slug) => ({ slug, label: `${slug.toUpperCase()} (desktop)` })),
];

// Placeholders: {rom} {romPath} {core} {emulator} {title}. RetroArch users
// typically want: -L "{core}" "{rom}".
const DEFAULT_TEMPLATE = '"{rom}"';

export function ProfilesPanel() {
  const [profiles, setProfiles] = useState<EmulatorProfile[]>([]);
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<Partial<EmulatorProfile> | null>(null);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/emulators/profiles").catch(() => null);
    const data = await response?.json().catch(() => null);
    if (data?.ok) setProfiles(data.profiles);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = async () => {
    if (!editing?.name?.trim() || !editing.emulatorPath?.trim()) {
      setNotice("Name and emulator path are required.");
      return;
    }
    const payload = {
      name: editing.name,
      platformSlug: editing.platformSlug || null,
      emulatorPath: editing.emulatorPath,
      corePath: editing.corePath ?? "",
      argsTemplate: editing.argsTemplate || "{rom}",
      isDefault: Boolean(editing.isDefault),
    };
    const response = await fetch(
      editing.id ? `/api/emulators/profiles/${editing.id}` : "/api/emulators/profiles",
      {
        method: editing.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    const data = await response.json();
    if (!data.ok) {
      setNotice(data.error ?? "could not save");
      return;
    }
    setEditing(null);
    setNotice("");
    await refresh();
  };

  const remove = async (profile: EmulatorProfile) => {
    await fetch(`/api/emulators/profiles/${profile.id}`, { method: "DELETE" });
    await refresh();
  };

  const launch = async (profile: EmulatorProfile) => {
    const bridge = desktopBridge();
    if (!bridge) return;
    const romPath = await bridge.pickFile([
      { name: "ROM files", extensions: ["zip", "nes", "sfc", "smc", "gb", "gbc", "gba", "gen", "md", "bin", "cue", "iso", "chd", "n64", "z64", "v64", "gg", "sms", "nds"] },
    ]);
    if (!romPath) return;
    const args =
      (profile.argsTemplate || "{rom}")
        .replace(/\{romPath\}|\{rom\}/g, romPath)
        .replace(/\{core\}/g, profile.corePath)
        .replace(/\{emulator\}/g, profile.emulatorPath)
        .replace(/\{title\}/g, "")
        .match(/(?:[^\s"]+|"[^"]*")+/g)?.map((a: string) => a.replace(/^"|"$/g, "")) ?? [romPath];
    const result = await bridge.launchEmulator({ emulatorPath: profile.emulatorPath, romPath, args });
    setNotice(result.ok ? `Launched ${profile.name}.` : `Launch failed: ${result.error ?? "unknown"}`);
  };

  return (
    <div>
      {!desktopBridge() && (
        <p className="mb-3 rounded-xl border border-sky-300/20 bg-sky-400/10 p-3 text-xs text-sky-200/90">
          Profiles sync everywhere; launching happens in Cabinet Desktop, where one click starts
          your emulator with the right ROM, core and arguments.
        </p>
      )}

      <div className="space-y-2">
        {profiles.map((profile) => (
          <div key={profile.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">
                {profile.name}
                {profile.isDefault && <span className="ml-2 rounded-full bg-violet-400/15 px-2 py-0.5 text-[10px] text-violet-200">default</span>}
              </p>
              <p className="truncate text-[11px] text-white/50">
                {profile.platformSlug ?? "any platform"} · {profile.emulatorPath}
              </p>
            </div>
            {desktopBridge() && (
              <button className="rounded-full bg-white/10 px-4 py-1.5 text-xs hover:bg-white/20" onClick={() => launch(profile)}>
                🚀 Launch
              </button>
            )}
            <button className="rounded-full px-3 py-1.5 text-xs text-white/60 hover:bg-white/10" onClick={() => setEditing(profile)}>
              Edit
            </button>
            <button className="rounded-full px-3 py-1.5 text-xs text-rose-300 hover:bg-rose-400/10" onClick={() => remove(profile)}>
              ✕
            </button>
          </div>
        ))}
        {profiles.length === 0 && (
          <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-xs text-white/45">
            No profiles yet — add your favourite emulator below.
          </p>
        )}
      </div>

      {editing ? (
        <div className="mt-4 space-y-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Profile name">
              <input
                value={editing.name ?? ""}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                placeholder="RetroArch (SNES)"
                className={inputClass}
              />
            </Field>
            <Field label="Platform">
              <select
                value={editing.platformSlug ?? ""}
                onChange={(e) => setEditing({ ...editing, platformSlug: e.target.value || null })}
                className={inputClass}
              >
                <option value="">Any platform</option>
                {PLATFORM_OPTIONS.map((p) => (
                  <option key={p.slug} value={p.slug}>{p.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Emulator executable">
              <input
                value={editing.emulatorPath ?? ""}
                onChange={(e) => setEditing({ ...editing, emulatorPath: e.target.value })}
                placeholder="C:\\RetroArch\\retroarch.exe"
                className={inputClass}
              />
            </Field>
            <Field label="Core (optional, for RetroArch -L)">
              <input
                value={editing.corePath ?? ""}
                onChange={(e) => setEditing({ ...editing, corePath: e.target.value })}
                placeholder="C:\\RetroArch\\cores\\snes9x_libretro.dll"
                className={inputClass}
              />
            </Field>
          </div>
          <Field label={'Arguments template — {rom} {core} {emulator} {title} (RetroArch: -L "{core}" "{rom}")'}>
            <input
              value={editing.argsTemplate ?? DEFAULT_TEMPLATE}
              onChange={(e) => setEditing({ ...editing, argsTemplate: e.target.value })}
              className={inputClass}
            />
          </Field>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-white/70">
              <input
                type="checkbox"
                checked={Boolean(editing.isDefault)}
                onChange={(e) => setEditing({ ...editing, isDefault: e.target.checked })}
              />
              Default for this platform
            </label>
            <div className="ml-auto flex gap-2">
              <button className="btn-glass !px-4 !py-2 text-xs" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn-primary !px-4 !py-2 text-xs" onClick={save}>Save profile</button>
            </div>
          </div>
        </div>
      ) : (
        <button className="btn-glass mt-4 !px-5 !py-2.5 text-xs" onClick={() => setEditing({ argsTemplate: DEFAULT_TEMPLATE })}>
          + Add emulator profile
        </button>
      )}

      {notice && <p className="mt-3 text-xs text-white/60">{notice}</p>}
    </div>
  );
}

const inputClass =
  "focus-ring w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/85";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-white/55">{label}</span>
      {children}
    </label>
  );
}
