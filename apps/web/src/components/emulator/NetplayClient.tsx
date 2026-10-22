"use client";

/**
 * Cabinet Netplay.
 *
 * Host-authoritative play over WebRTC:
 *   • the host runs the emulator and streams its canvas (+ audio) to guests
 *   • guests' key presses travel back over the data channel and are injected
 *     into the host's emulator (synthetic key events)
 *   • the host broadcasts save states periodically and on request, so a guest
 *     can take a snapshot home or resync after a hiccup
 *
 * Signalling (SDP + trickled ICE) runs through Cabinet's polling API — no
 * WebSocket server needed, works on serverless hosting.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { pressKey } from "@/lib/emulator-bridge";

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

interface NetplayClientProps {
  romId: string;
  core: string;
  gameTitle: string;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  onNotice: (message: string) => void;
}

type Mode = "idle" | "hosting" | "guest";

export function NetplayClient({ romId, core, gameTitle, iframeRef, onNotice }: NetplayClientProps) {
  const [mode, setMode] = useState<Mode>("idle");
  const [code, setCode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [status, setStatus] = useState("Ready to play together.");
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [guests, setGuests] = useState(0);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const seqRef = useRef(0);
  // The room code lives in a ref as well as state: signalling handlers run in
  // old closures where the `code` state is still empty.
  const roomRef = useRef("");
  const stateTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const pingRef = useRef<number>(0);
  const roleRef = useRef<"host" | "guest">("host");

  const sendSignal = useCallback(
    async (roomCode: string, kind: string, payload: unknown) => {
      await fetch(`/api/netplay/${roomCode}/signal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromRole: roleRef.current, kind, payload }),
      }).catch(() => undefined);
    },
    [],
  );

  /** Poll the signalling endpoint for the other peer's messages. */
  const startPolling = useCallback(
    (roomCode: string) => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        const response = await fetch(
          `/api/netplay/${roomCode}/signal?role=${roleRef.current}&after=${seqRef.current}`,
        ).catch(() => null);
        if (!response) return;
        const data = await response.json().catch(() => null);
        if (!data?.ok) return;
        for (const message of data.messages as {
          seq: number;
          kind: string;
          payload: unknown;
        }[]) {
          seqRef.current = Math.max(seqRef.current, message.seq);
          await handleSignal(message.kind, message.payload);
        }
      }, 1500);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // ── signalling handlers ───────────────────────────────────────────────────
  const handleSignal = async (kind: string, payload: unknown) => {
    const pc = pcRef.current;
    if (!pc) return;
    if (kind === "offer" && roleRef.current === "guest") {
      await pc.setRemoteDescription(new RTCSessionDescription(payload as RTCSessionDescriptionInit));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await waitIce(pc);
      if (roomRef.current) await sendSignal(roomRef.current, "answer", pc.localDescription);
    } else if (kind === "answer" && roleRef.current === "host") {
      await pc.setRemoteDescription(new RTCSessionDescription(payload as RTCSessionDescriptionInit));
    } else if (kind === "ice") {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(payload as RTCIceCandidateInit));
      } catch {
        // candidates can arrive before the remote description; harmless
      }
    } else if (kind === "bye") {
      setStatus("The other player left.");
    }
  };

  // ── data channel ──────────────────────────────────────────────────────────
  const setupDataChannel = useCallback(
    (dc: RTCDataChannel, role: "host" | "guest") => {
      dcRef.current = dc;
      dc.onopen = () => {
        setStatus(role === "host" ? "A player joined — you're streaming." : "Connected! You're playing on the host's game.");
        if (role === "host") setGuests((g) => g + 1);
      };
      dc.onclose = () => {
        setStatus("Data channel closed.");
        if (role === "host") setGuests((g) => Math.max(0, g - 1));
      };
      dc.onmessage = (event) => {
        if (typeof event.data !== "string") {
          // Binary → a save-state snapshot from the host.
          if (role === "guest") {
            void applyState(new Uint8Array(event.data as ArrayBuffer));
          }
          return;
        }
        let message: { t: string; action?: string; key?: string; code?: string; ts?: number };
        try {
          message = JSON.parse(event.data);
        } catch {
          return;
        }
        if (message.t === "key" && role === "host" && message.action && message.key && message.code) {
          const iframe = iframeRef.current;
          if (iframe) pressKey(iframe, message.action as "keydown" | "keyup", message.key, message.code);
        } else if (message.t === "ping") {
          dc.send(JSON.stringify({ t: "pong", ts: message.ts }));
        } else if (message.t === "pong" && message.ts) {
          setLatencyMs(Math.round(performance.now() - message.ts));
        }
      };
    },
    [iframeRef],
  );

  const applyState = async (bytes: Uint8Array) => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    try {
      const gm = (iframe.contentWindow as unknown as {
        EJS_emulator?: { gameManager?: { loadState(b: Uint8Array): void } };
      }).EJS_emulator?.gameManager;
      gm?.loadState(bytes);
    } catch {
      // guest may not have a game loaded — state application is best-effort
    }
  };

  // ── host ──────────────────────────────────────────────────────────────────
  const hostSession = async () => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) {
      onNotice("Start the game first, then host a session.");
      return;
    }
    roleRef.current = "host";
    setMode("hosting");
    setStatus("Creating room…");

    const response = await fetch("/api/netplay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ romId, gameTitle, core }),
    });
    const data = await response.json();
    if (!data.ok) {
      setStatus(`Could not create a room: ${data.error ?? "unknown error"}`);
      setMode("idle");
      return;
    }
    const roomCode: string = data.session.code;
    roomRef.current = roomCode;
    setCode(roomCode);

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;

    // Stream the emulator canvas (+ audio element when present).
    try {
      const canvas = iframe.contentWindow.document.querySelector("canvas");
      if (canvas) {
        const stream = (canvas as HTMLCanvasElement).captureStream(30);
        for (const track of stream.getTracks()) pc.addTrack(track, stream);
      }
      const audio = iframe.contentWindow.document.querySelector("audio") as HTMLAudioElement | null;
      const audioStream = (audio as unknown as { captureStream?: () => MediaStream })?.captureStream?.();
      for (const track of audioStream?.getTracks() ?? []) pc.addTrack(track, audioStream!);
    } catch {
      // canvas may not exist until the core boots
    }

    const dc = pc.createDataChannel("input", { ordered: true });
    setupDataChannel(dc, "host");

    pc.onicecandidate = (event) => {
      if (event.candidate) void sendSignal(roomCode, "ice", event.candidate.toJSON());
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await waitIce(pc);
    await sendSignal(roomCode, "offer", pc.localDescription);
    startPolling(roomCode);
    setStatus("Room created — share the code with a friend.");

    // Periodic + on-demand state snapshots keep guests in sync.
    if (stateTimerRef.current) clearInterval(stateTimerRef.current);
    stateTimerRef.current = setInterval(async () => {
      if (dc.readyState !== "open") return;
      try {
        const bytes = await captureStateDirect(iframe);
        // The Uint8Array overload of send() trips on some TS lib versions;
        // the runtime accepts typed arrays regardless.
        if (bytes) dc.send(bytes as unknown as ArrayBuffer);
      } catch {
        // ignore transient capture failures
      }
    }, 5000);
  };

  // ── guest ────────────────────────────────────────────────────────────────
  const joinSession = async () => {
    const roomCode = joinCode.trim().toUpperCase();
    if (!roomCode) return;
    roleRef.current = "guest";
    setMode("guest");
    setStatus("Looking up room…");

    const response = await fetch(`/api/netplay?code=${roomCode}`);
    const data = await response.json();
    if (!data.ok) {
      setStatus(`Room not found: ${data.error ?? "check the code"}`);
      setMode("idle");
      return;
    }
    roomRef.current = roomCode;
    setCode(roomCode);

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;
    pc.ontrack = (event) => {
      const stream = event.streams[0];
      if (videoRef.current && stream) {
        videoRef.current.srcObject = stream;
        void videoRef.current.play().catch(() => undefined);
      }
    };
    pc.ondatachannel = (event) => setupDataChannel(event.channel, "guest");
    pc.onicecandidate = (event) => {
      if (event.candidate) void sendSignal(roomCode, "ice", event.candidate.toJSON());
    };

    startPolling(roomCode);
    setStatus("Waiting for the host…");

    // Guest keyboard → host emulator.
    const onKeyDown = (event: KeyboardEvent) => {
      if (dcRef.current?.readyState === "open" && !event.repeat) {
        dcRef.current.send(JSON.stringify({ t: "key", action: "keydown", key: event.key, code: event.code }));
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (dcRef.current?.readyState === "open") {
        dcRef.current.send(JSON.stringify({ t: "key", action: "keyup", key: event.key, code: event.code }));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    cleanupInputRef.current = () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };

    // Keepalive pings → latency readout.
    if (stateTimerRef.current) clearInterval(stateTimerRef.current);
    stateTimerRef.current = setInterval(() => {
      if (dcRef.current?.readyState === "open") {
        pingRef.current = performance.now();
        dcRef.current.send(JSON.stringify({ t: "ping", ts: pingRef.current }));
      }
    }, 3000);
  };

  const cleanupInputRef = useRef<(() => void) | null>(null);

  const leave = useCallback(() => {
    const room = roomRef.current;
    roomRef.current = "";
    if (room) void sendSignal(room, "bye", {});
    if (stateTimerRef.current) clearInterval(stateTimerRef.current);
    if (pollRef.current) clearInterval(pollRef.current);
    cleanupInputRef.current?.();
    dcRef.current?.close();
    pcRef.current?.close();
    dcRef.current = null;
    pcRef.current = null;
    setMode("idle");
    setGuests(0);
    setLatencyMs(null);
    setStatus("Left the session.");
  }, [sendSignal]);

  useEffect(() => () => leave(), [leave]);

  return (
    <div className="space-y-3">
      {mode === "idle" && (
        <>
          <button className="btn-primary w-full !py-2 text-xs" onClick={hostSession}>
            🎮 Host a session
          </button>
          <div className="flex items-center gap-2">
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="ROOM CODE"
              maxLength={5}
              className="focus-ring w-28 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-center text-sm tracking-[0.3em] text-white"
            />
            <button className="btn-glass flex-1 !py-2 text-xs" onClick={joinSession}>
              Join a session
            </button>
          </div>
          <p className="text-[11px] leading-relaxed text-white/45">
            Netplay streams the host&rsquo;s game over a direct peer-to-peer connection and
            forwards your controls to the host — like remote couch co-op. Both players need
            the same game.
          </p>
        </>
      )}

      {mode !== "idle" && (
        <>
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-white/60">Room</span>
              <span className="font-mono text-base tracking-[0.3em] text-white">{code}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-white/50">
              <span>{status}</span>
              {latencyMs !== null && <span>{latencyMs} ms</span>}
            </div>
            {mode === "hosting" && (
              <div className="mt-1 text-white/50">
                {guests > 0 ? `${guests} player(s) connected` : "Waiting for players…"}
              </div>
            )}
          </div>

          {mode === "guest" && (
            <video
              ref={videoRef}
              playsInline
              className="w-full rounded-xl border border-white/10 bg-black"
              onDoubleClick={(e) => void e.currentTarget.requestFullscreen?.()}
            />
          )}

          <button className="btn-glass w-full !py-2 text-xs" onClick={leave}>
            Leave session
          </button>
        </>
      )}
    </div>
  );
}

/** Wait for ICE gathering to settle so one SDP blob carries all candidates. */
function waitIce(pc: RTCPeerConnection, timeoutMs = 2500): Promise<void> {
  if (pc.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      pc.removeEventListener("icegatheringstatechange", check);
      resolve();
    };
    const check = () => {
      if (pc.iceGatheringState === "complete") done();
    };
    pc.addEventListener("icegatheringstatechange", check);
    setTimeout(done, timeoutMs);
  });
}

async function captureStateDirect(iframe: HTMLIFrameElement): Promise<Uint8Array | null> {
  const gm = (iframe.contentWindow as unknown as {
    EJS_emulator?: { gameManager?: { getState(): Uint8Array } };
  } | null)?.EJS_emulator?.gameManager;
  if (!gm) return null;
  const state = gm.getState();
  return state instanceof Uint8Array ? state : null;
}
