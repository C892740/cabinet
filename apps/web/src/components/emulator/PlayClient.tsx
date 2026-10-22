"use client";

/**
 * The in-browser player page.
 *
 * Loads a ROM (picked locally — Cabinet ships no games) into the EmulatorJS
 * frame and puts the cloud wings around it: save states, screenshots, play
 * history, netplay and one-click desktop launch when running inside
 * Cabinet Desktop.
 */

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  base64ToBytes,
  bytesToBase64,
  captureScreenshot,
  captureState,
  loadState,
  thumbnailFromDataUrl,
} from "@/lib/emulator-bridge";
import { coreForPlatform, DESKTOP_ONLY_PLATFORMS, ejsCoreFor } from "@/lib/emulator-cores";
import { loadRomFromVault, prepareRomFile, saveRomToVault } from "@/lib/rom-vault";
import { fetchRomBlobMeta, romBlobUrl, RomSyncError, uploadRomBlob } from "@/lib/rom-sync";
import type { EmulatorProfile, PlaySession, Rom, SaveState, Screenshot } from "@/lib/types";
import { NetplayClient } from "./NetplayClient";

type Tab = "states" | "screenshots" | "history" | "netplay";

interface DesktopBridge {
  pickFile(filters: { name: string; extensions: string[] }[]): Promise<string | null>;
  launchEmulator(input: {
    emulatorPath: string;
    romPath: string;
    args?: string[];
  }): Promise<{ ok: boolean; error?: string }>;
  /** Fires when a launched emulator exits; returns an unsubscribe function. */
  onEmulatorExit?(
    callback: (info: { emulatorPath: string; code: number | null }) => void,
  ): () => void;
}

function desktopBridge(): DesktopBridge | null {
  return typeof window !== "undefined" && (window as unknown as { cabinet?: DesktopBridge }).cabinet
    ? ((window as unknown as { cabinet?: DesktopBridge }).cabinet ?? null)
    : null;
}

export function PlayClient() {
  const search = useSearchParams();
  const romId = search.get("rom");
  const playSource = search.get("source") === "tv" ? "tv" : "browser";

  const [rom, setRom] = useState<Rom | null>(null);
  const [romError, setRomError] = useState("");
  const [gameUrl, setGameUrl] = useState<string | null>(null);
  const [gameLabel, setGameLabel] = useState("");
  const [remoteUrl, setRemoteUrl] = useState("");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");

  const [states, setStates] = useState<SaveState[]>([]);
  const [screenshots, setScreenshots] = useState<Screenshot[]>([]);
  const [history, setHistory] = useState<PlaySession[]>([]);
  const [profiles, setProfiles] = useState<EmulatorProfile[]>([]);
  const [profileId, setProfileId] = useState("");
  const [tab, setTab] = useState<Tab>("states");

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const sessionRef = useRef<{ id: string; startedAt: number } | null>(null);
  const desktopSessionRef = useRef<{ id: string; startedAt: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const coreInfo = rom ? coreForPlatform(rom.platformSlug) : null;
  const desktopOnly = rom ? DESKTOP_ONLY_PLATFORMS[rom.platformSlug] : null;

  // ── rom lookup ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!romId) return;
    let cancelled = false;
    fetch(`/api/roms/${romId}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.ok) setRom(data.rom);
        else setRomError(data.error ?? "not found");
      })
      .catch(() => !cancelled && setRomError("could not load the game"));
    return () => {
      cancelled = true;
    };
  }, [romId]);

  const refreshSyncLists = useCallback(async () => {
    if (!romId) return;
    const [s, sc, h] = await Promise.all([
      fetch(`/api/roms/${romId}/states`).then((r) => r.json()).catch(() => null),
      fetch(`/api/roms/${romId}/screenshots`).then((r) => r.json()).catch(() => null),
      fetch(`/api/play-sessions?romId=${romId}`).then((r) => r.json()).catch(() => null),
    ]);
    if (s?.ok) setStates(s.states);
    if (sc?.ok) setScreenshots(sc.screenshots);
    if (h?.ok) setHistory(h.sessions);
  }, [romId]);

  useEffect(() => {
    void refreshSyncLists();
    fetch("/api/emulators/profiles")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setProfiles(data.profiles);
          if (data.profiles[0]) setProfileId(data.profiles[0].id);
        }
      })
      .catch(() => undefined);
  }, [refreshSyncLists]);

  // ── play-session tracking (history sync) ──────────────────────────────────
  const closeSession = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return;
    sessionRef.current = null;
    const durationSeconds = Math.round((Date.now() - session.startedAt) / 1000);
    void fetch(`/api/sessions/${session.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ durationSeconds }),
      keepalive: true,
    });
  }, []);

  useEffect(() => {
    if (!gameUrl || !romId) return;
    let cancelled = false;
    void fetch("/api/play-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ romId, source: playSource }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data.ok) {
          sessionRef.current = { id: data.session.id, startedAt: Date.now() };
        }
      })
      .catch(() => undefined);
    window.addEventListener("beforeunload", closeSession);
    return () => {
      cancelled = true;
      window.removeEventListener("beforeunload", closeSession);
      closeSession();
    };
  }, [gameUrl, romId, closeSession]);

  // ── desktop play-session tracking (same history, real exit time) ─────────
  const closeDesktopSession = useCallback(() => {
    const session = desktopSessionRef.current;
    if (!session) return;
    desktopSessionRef.current = null;
    const durationSeconds = Math.round((Date.now() - session.startedAt) / 1000);
    void fetch(`/api/sessions/${session.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ durationSeconds }),
      keepalive: true,
    });
  }, []);

  useEffect(() => {
    window.addEventListener("beforeunload", closeDesktopSession);
    return () => window.removeEventListener("beforeunload", closeDesktopSession);
  }, [closeDesktopSession]);

  // ── game loading ──────────────────────────────────────────────────────────

  // Auto-boot: the ROM vault (this device) or the account's cloud copy means
  // Play works without re-attaching the file every session — and on the TV,
  // which has no file picker at all.
  useEffect(() => {
    if (!romId || gameUrl) return;
    let cancelled = false;
    void (async () => {
      try {
        const local = await loadRomFromVault(romId);
        if (cancelled) return;
        if (local) {
          setGameUrl(URL.createObjectURL(new Blob([local.bytes])));
          setGameLabel(local.fileName.replace(/\.[^.]+$/, ""));
          setNotice("Loaded from this device's ROM vault.");
          return;
        }
        const meta = await fetchRomBlobMeta(romId);
        if (cancelled) return;
        if (meta) {
          setGameUrl(romBlobUrl(romId));
          setGameLabel(meta.fileName.replace(/\.[^.]+$/, ""));
          setNotice("Streaming the attached ROM from your account.");
        }
      } catch {
        // Not signed in (or offline): the attach UI below takes over.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [romId, gameUrl]);

  const onPickFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !romId) return;
    event.target.value = "";
    setBusy("Preparing ROM…");
    setNotice("");
    try {
      const prepared = await prepareRomFile(file);
      if (gameUrl?.startsWith("blob:")) URL.revokeObjectURL(gameUrl);
      setGameUrl(URL.createObjectURL(new Blob([prepared.bytes])));
      setGameLabel(prepared.fileName.replace(/\.[^.]+$/, ""));
      let message = prepared.fromZip ? `Unpacked ${prepared.fileName} from the zip. ` : "";
      try {
        await saveRomToVault(romId, prepared.fileName, prepared.bytes);
        message += "Saved for instant replay on this device.";
      } catch {
        // Storage quota exceeded — the cloud copy below still works.
      }
      setNotice(message.trim());
      try {
        setBusy("Syncing to your devices…");
        await uploadRomBlob(romId, prepared.fileName, prepared.bytes, (fraction) =>
          setBusy(`Syncing to your devices… ${Math.round(fraction * 100)}%`),
        );
        setNotice(`${message} ROM synced — playable on every device, TV included.`.trim());
      } catch (error) {
        setNotice(
          `${message} ${
            error instanceof RomSyncError ? error.message : "Cloud sync failed"
          } — playing from this device.`.trim(),
        );
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "could not read that file");
    } finally {
      setBusy("");
    }
  };

  const useRemoteUrl = () => {
    const url = remoteUrl.trim();
    if (!/^https:\/\//.test(url)) {
      setNotice("Remote ROMs must be served over https (CORS must allow this origin).");
      return;
    }
    setGameUrl(url);
    setGameLabel(url.split("/").pop() ?? "remote game");
    setNotice("");
  };

  // ── cloud actions ─────────────────────────────────────────────────────────
  const uploadState = useCallback(
    async (bytes: Uint8Array, thumbnail: string | null) => {
      if (!romId || !coreInfo) return;
      const label = `State · ${new Date().toLocaleTimeString()}`;
      const response = await fetch(`/api/roms/${romId}/states`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          state: bytesToBase64(bytes),
          thumbnail,
          core: coreInfo.core,
          label,
        }),
      });
      const data = await response.json();
      if (!data.ok) throw new Error(data.error ?? "save failed");
      await refreshSyncLists();
    },
    [romId, coreInfo, refreshSyncLists],
  );

  const saveStateNow = async () => {
    const iframe = iframeRef.current;
    if (!iframe || !romId || !coreInfo) return;
    setBusy("Saving state…");
    try {
      const bytes = await captureState(iframe);
      const shot = await captureScreenshot(iframe);
      const thumbnail = shot ? await thumbnailFromDataUrl(shot) : null;
      await uploadState(bytes, thumbnail);
      setNotice("State saved to your account.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "save failed");
    } finally {
      setBusy("");
    }
  };

  // States saved with EmulatorJS's own save-state button sync to the account
  // too (the frame relays the documented EJS_onSaveState hook).
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { type?: string; bytes?: Uint8Array | number[] } | null;
      if (data?.type !== "cabinet:uiStateSaved" || !romId) return;
      const raw = data.bytes;
      const bytes =
        raw instanceof Uint8Array ? raw : Array.isArray(raw) ? new Uint8Array(raw) : null;
      if (!bytes || bytes.length === 0) return;
      void (async () => {
        try {
          const shot = iframeRef.current ? await captureScreenshot(iframeRef.current) : null;
          const thumbnail = shot ? await thumbnailFromDataUrl(shot) : null;
          await uploadState(bytes, thumbnail);
          setNotice("State saved in the emulator — synced to your account.");
        } catch {
          // best-effort; the manual save button remains the reliable path
        }
      })();
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [romId, uploadState]);

  const loadStateItem = async (state: SaveState) => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    setBusy("Loading state…");
    try {
      await loadState(iframe, base64ToBytes(state.state));
      setNotice(`Loaded "${state.label || "state"}".`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "load failed");
    } finally {
      setBusy("");
    }
  };

  const deleteStateItem = async (state: SaveState) => {
    await fetch(`/api/states/${state.id}`, { method: "DELETE" });
    await refreshSyncLists();
  };

  const takeScreenshot = async () => {
    const iframe = iframeRef.current;
    if (!iframe || !romId) return;
    setBusy("Capturing…");
    try {
      const dataUrl = await captureScreenshot(iframe);
      if (!dataUrl) throw new Error("no frame captured");
      const response = await fetch(`/api/roms/${romId}/screenshots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageData: dataUrl }),
      });
      const data = await response.json();
      if (!data.ok) throw new Error(data.error ?? "upload failed");
      setTab("screenshots");
      await refreshSyncLists();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "capture failed");
    } finally {
      setBusy("");
    }
  };

  const deleteScreenshot = async (shot: Screenshot) => {
    await fetch(`/api/screenshots/${shot.id}`, { method: "DELETE" });
    await refreshSyncLists();
  };

  // ── desktop launch ────────────────────────────────────────────────────────
  const launchOnDesktop = async () => {
    const bridge = desktopBridge();
    if (!bridge) return;
    const profile = profiles.find((p) => p.id === profileId) ?? profiles[0];
    if (!profile) {
      setNotice("Create a desktop emulator profile first (Emulators → Desktop profiles).");
      return;
    }
    const romPath = await bridge.pickFile([{ name: "ROM files", extensions: ["zip", "nes", "sfc", "smc", "gb", "gbc", "gba", "gen", "md", "bin", "cue", "iso", "chd", "n64", "z64", "v64", "gg", "sms", "nds"] }]);
    if (!romPath) return;
    const args = (profile.argsTemplate || "{rom}")
      .replace(/\{romPath\}|\{rom\}/g, romPath)
      .replace(/\{core\}/g, profile.corePath)
      .replace(/\{emulator\}/g, profile.emulatorPath)
      .replace(/\{title\}/g, rom?.title ?? "")        .match(/(?:[^\s"]+|"[^"]*")+/g)?.map((a: string) => a.replace(/^"|"$/g, "")) ?? [romPath];
    const result = await bridge.launchEmulator({
      emulatorPath: profile.emulatorPath,
      romPath,
      args,
    });
    setNotice(result.ok ? `Launched ${profile.name}.` : `Launch failed: ${result.error ?? "unknown error"}`);
    if (result.ok && romId) {
      // Desktop play joins the same synced history as browser play; the
      // session closes when the emulator process exits.
      void fetch("/api/play-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ romId, source: "desktop" }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.ok) {
            desktopSessionRef.current = { id: data.session.id, startedAt: Date.now() };
            bridge.onEmulatorExit?.(() => closeDesktopSession());
          }
        })
        .catch(() => undefined);
    }
  };

  // ── render ────────────────────────────────────────────────────────────────
  if (!romId) {
    return <PlayerShell><p className="text-white/60">Pick a game from the library to play.</p></PlayerShell>;
  }
  if (romError) {
    return <PlayerShell><p className="text-rose-300">{romError}</p></PlayerShell>;
  }

  return (
    <PlayerShell>
      <div className="flex flex-wrap items-center gap-3">
        <Link href={romId ? `/library?rom=${romId}` : "/library"} className="btn-glass !px-4 !py-2 text-xs">
          ← Back
        </Link>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-white">{rom?.title ?? "…"}</h1>
          <p className="text-xs text-white/50">
            {coreInfo ? `${coreInfo.label} · core ${coreInfo.core}` : (desktopOnly ?? "Loading…")}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button className="btn-glass !px-4 !py-2 text-xs" onClick={takeScreenshot} disabled={!gameUrl || !!busy}>
            📸 Screenshot
          </button>
          <button className="btn-primary !px-4 !py-2 text-xs" onClick={saveStateNow} disabled={!gameUrl || !!busy}>
            💾 Save state
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_340px]">
        <div>
          <div className="glass relative overflow-hidden rounded-2xl" style={{ aspectRatio: "4 / 3" }}>
            {gameUrl && coreInfo ? (
              <iframe
                key={gameUrl}
                ref={iframeRef}
                src={`/play/frame?core=${coreInfo ? ejsCoreFor(coreInfo.core) : ""}&gameUrl=${encodeURIComponent(gameUrl)}&name=${encodeURIComponent(gameLabel)}&gameId=${romId}`}
                title="Cabinet player"
                className="h-full w-full border-0"
                allow="gamepad; autoplay; fullscreen"
              />
            ) : gameUrl ? (
              // ROM bytes are ready but the game's platform metadata hasn't
              // landed yet — the frame needs it to pick the emulator core.
              <div className="flex h-full items-center justify-center text-sm text-white/60">
                Loading game info…
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
                <p className="text-white/70">
                  Attach the ROM for <span className="text-white">{rom?.title}</span> — zipped
                  archives work too. One-time step: it saves to this device and streams to your
                  other devices (the TV included). Cabinet ships no games — bring your own
                  legally obtained ROMs.
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={onPickFile}
                  accept={coreInfo ? coreInfo.extensions.map((e) => `.${e}`).join(",") : undefined}
                />
                <button className="btn-primary" onClick={() => fileInputRef.current?.click()}>
                  Choose ROM file
                </button>
                {coreInfo?.bios && <p className="max-w-md text-xs text-amber-200/80">⚠ {coreInfo.bios}</p>}
                <div className="flex w-full max-w-md items-center gap-2">
                  <input
                    value={remoteUrl}
                    onChange={(e) => setRemoteUrl(e.target.value)}
                    placeholder="…or paste an https ROM URL"
                    className="focus-ring flex-1 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80"
                  />
                  <button className="btn-glass !px-4 !py-2 text-xs" onClick={useRemoteUrl}>Load</button>
                </div>
              </div>
            )}
          </div>
          {busy && <p className="mt-2 text-xs text-violet-300">{busy}</p>}
          {notice && <p className="mt-2 text-xs text-white/60">{notice}</p>}
          {desktopBridge() && (
            <div className="glass mt-3 flex flex-wrap items-center gap-2 rounded-2xl p-3">
              <span className="text-xs text-white/60">Desktop:</span>
              <select
                value={profileId}
                onChange={(e) => setProfileId(e.target.value)}
                className="focus-ring rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80"
              >
                {profiles.length === 0 && <option value="">No profiles yet</option>}
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <button className="btn-glass !px-4 !py-1.5 text-xs" onClick={launchOnDesktop}>
                🚀 Launch on desktop
              </button>
            </div>
          )}
        </div>

        <div className="glass flex h-[560px] flex-col rounded-2xl p-4">
          <div className="flex gap-1 rounded-full bg-white/5 p-1 text-xs">
            {(["states", "screenshots", "history", "netplay"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 rounded-full px-3 py-1.5 font-medium capitalize transition ${
                  tab === t ? "accent-gradient text-white" : "text-white/60 hover:text-white"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="mt-3 flex-1 space-y-2 overflow-y-auto pr-1">
            {tab === "states" && (
              states.length === 0 ? (
                <EmptyNote>No cloud states yet — hit “Save state” while playing.</EmptyNote>
              ) : (
                states.map((state) => (
                  <div key={state.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-2">
                    {state.thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={state.thumbnail} alt="" className="h-10 w-14 rounded-md object-cover" />
                    ) : (
                      <div className="h-10 w-14 rounded-md bg-white/10" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-white">{state.label || `Slot ${state.slot}`}</p>
                      <p className="text-[10px] text-white/50">
                        {new Date(state.createdAt).toLocaleString()} · {Math.round(state.sizeBytes / 1024)} KB
                      </p>
                    </div>
                    <button className="rounded-full bg-white/10 px-3 py-1 text-[11px] hover:bg-white/20" onClick={() => loadStateItem(state)}>
                      Load
                    </button>
                    <button className="rounded-full px-2 py-1 text-[11px] text-rose-300 hover:bg-rose-400/10" onClick={() => deleteStateItem(state)}>
                      ✕
                    </button>
                  </div>
                ))
              )
            )}

            {tab === "screenshots" && (
              screenshots.length === 0 ? (
                <EmptyNote>No screenshots yet — hit “📸 Screenshot” while playing.</EmptyNote>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {screenshots.map((shot) => (
                    <div key={shot.id} className="group relative overflow-hidden rounded-xl border border-white/10">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={shot.imageData} alt={shot.caption || "screenshot"} className="aspect-4/3 w-full object-cover" />
                      <button
                        className="absolute right-1 top-1 hidden rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-rose-300 group-hover:block"
                        onClick={() => deleteScreenshot(shot)}
                      >
                        delete
                      </button>
                      <p className="px-2 py-1 text-[10px] text-white/50">{new Date(shot.createdAt).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              )
            )}

            {tab === "history" && (
              history.length === 0 ? (
                <EmptyNote>No play sessions yet — they appear here automatically.</EmptyNote>
              ) : (
                history.map((session) => (
                  <div key={session.id} className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-white capitalize">{session.source}</span>
                      <span className="text-white/50">
                        {session.durationSeconds >= 60
                          ? `${Math.round(session.durationSeconds / 60)} min`
                          : `${session.durationSeconds}s`}
                      </span>
                    </div>
                    <p className="mt-1 text-[10px] text-white/50">
                      {new Date(session.startedAt).toLocaleString()}
                      {session.endedAt ? "" : " · in progress"}
                    </p>
                  </div>
                ))
              )
            )}

            {tab === "netplay" && (
              <NetplayClient
                romId={romId}
                core={coreInfo?.core ?? ""}
                gameTitle={rom?.title ?? "Game"}
                iframeRef={iframeRef}
                onNotice={setNotice}
              />
            )}
          </div>
        </div>
      </div>
    </PlayerShell>
  );
}

function PlayerShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      {children}
    </div>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-xs text-white/45">{children}</p>;
}
