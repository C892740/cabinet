/**
 * E2E: phone ↔ TV pairing protocol + ROM auto-import flow.
 *
 * Exercises the exact wire calls the Android/iOS apps make (the mobile unit
 * tests cover the local logic; this covers the server contract):
 *
 *   TV opens code → phone claims → TV approves → same-Wi-Fi verdict →
 *   verify gate drives auto-import → ROM created + chunk-uploaded →
 *   TV sees it in the library and streams the bytes back.
 *
 * Requires a dev server on :3000 (`npm run dev -w cabinet-web`).
 * Run: node scripts/e2e-pairing.mjs
 */

const BASE = process.env.CABINET_URL ?? "http://localhost:3000";

let passed = 0;
let failed = 0;

function check(name, ok, detail = "") {
  if (ok) {
    passed += 1;
    console.log(`[ok]   ${name}`);
  } else {
    failed += 1;
    console.log(`[FAIL] ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function failHard(name, detail) {
  check(name, false, detail);
  console.log("\n[e2e] stopping after hard failure");
  process.exit(1);
}

async function api(path, { method = "GET", body, cookie, ip } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (cookie) headers.Cookie = cookie;
  if (ip) headers["X-Forwarded-For"] = ip;
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* binary */
  }
  return { status: response.status, json, text, headers: response.headers };
}

async function register(label) {
  const email = `e2e-pair-${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@test.local`;
  const response = await api("/api/auth/register", {
    method: "POST",
    body: { email, displayName: `Pair ${label}`, password: "correct-horse-battery" },
  });
  if (response.status !== 201 && response.status !== 200) {
    failHard(`register ${label} account`, `HTTP ${response.status}: ${response.text}`);
  }
  const raw = response.headers.getSetCookie?.() ?? [];
  const cookie = raw.map((c) => c.split(";")[0]).join("; ");
  if (!cookie.includes("cabinet_session")) {
    failHard(`register ${label} session cookie`, `got: ${cookie || "(none)"}`);
  }
  return cookie;
}

async function main() {
  console.log(`[e2e] pairing protocol against ${BASE}\n`);

  const tv = await register("tv");
  const intruder = await register("intruder");

  // ── 1. TV opens a pairing code ───────────────────────────────────────────
  const started = await api("/api/pair/start", {
    method: "POST",
    body: { tvName: "Living Room TV" },
    cookie: tv,
    ip: "192.168.1.10",
  });
  check("TV opens a pairing code", started.status === 200 && started.json?.ok);
  const code = started.json?.pair?.code ?? "";
  check("code is 6 digits", /^\d{6}$/.test(code), `got "${code}"`);
  check("code shown as XXX-XXX", started.json?.pair?.code?.length === 6);

  // ── 2. A different account cannot claim this code ────────────────────────
  const stolen = await api("/api/pair/claim", {
    method: "POST",
    body: { code, phoneName: "Evil Phone" },
    cookie: intruder,
    ip: "10.7.0.5",
  });
  check("other account cannot claim the code", stolen.status === 404, `HTTP ${stolen.status}`);

  // ── 3. Wrong-length code rejected ────────────────────────────────────────
  const short = await api("/api/pair/claim", {
    method: "POST",
    body: { code: "12", phoneName: "Phone" },
    cookie: tv,
    ip: "192.168.1.20",
  });
  check("malformed code rejected", short.status === 400, `HTTP ${short.status}`);

  // ── 4. Same-account phone claims on the SAME Wi-Fi ───────────────────────
  const claimed = await api("/api/pair/claim", {
    method: "POST",
    body: { code, phoneName: "Pixel", phoneModel: "Pixel 9" },
    cookie: tv,
    ip: "192.168.1.10", // same egress IP as the TV ⇒ same Wi-Fi
  });
  check("phone claims the code", claimed.status === 200 && claimed.json?.ok);
  check("claim shows status=claimed", claimed.json?.pair?.status === "claimed");
  check("same-Wi-Fi verdict is positive", claimed.json?.pair?.sameNetwork === true);

  // ── 5. Gate stays closed until the TV approves ───────────────────────────
  const premature = await api("/api/pair/verify", {
    method: "POST",
    body: { code, side: "phone" },
    cookie: tv,
    ip: "192.168.1.10",
  });
  check(
    "auto-import blocked before TV approval",
    premature.json?.canAutoImport === false && premature.json?.pair?.status === "claimed",
    `status=${premature.json?.pair?.status} gate=${premature.json?.canAutoImport}`,
  );

  // ── 6. TV approves → linked ──────────────────────────────────────────────
  const approved = await api("/api/pair/approve", {
    method: "POST",
    body: { code, approve: true },
    cookie: tv,
    ip: "192.168.1.10",
  });
  check("TV approval links the phone", approved.json?.pair?.status === "linked");
  check("link keeps the same-Wi-Fi verdict", approved.json?.pair?.sameNetwork === true);

  const verifyOk = await api("/api/pair/verify", {
    method: "POST",
    body: { code, side: "phone" },
    cookie: tv,
    ip: "192.168.1.10",
  });
  check("auto-import opens on linked + same Wi-Fi + TV present", verifyOk.json?.canAutoImport === true);

  // ── 7. Phone leaves the Wi-Fi → gate closes again ────────────────────────
  const roaming = await api("/api/pair/verify", {
    method: "POST",
    body: { code, side: "phone" },
    cookie: tv,
    ip: "10.7.0.5", // cellular egress: different network
  });
  check(
    "roaming to another network pauses auto-import",
    roaming.json?.canAutoImport === false && roaming.json?.sameNetwork === false,
    `sameNetwork=${roaming.json?.sameNetwork} gate=${roaming.json?.canAutoImport}`,
  );

  // back on Wi-Fi (heartbeat refreshes the verdict)
  const homeAgain = await api("/api/pair/verify", {
    method: "POST",
    body: { code, side: "phone" },
    cookie: tv,
    ip: "192.168.1.10",
  });
  check("returning to the Wi-Fi re-opens auto-import", homeAgain.json?.canAutoImport === true);

  // ── 8. Auto-import: create the library entry like the phone does ─────────
  const created = await api("/api/roms", {
    method: "POST",
    body: {
      title: "Pokemon Diamond",
      platformSlug: "nds",
      year: 0,
      genre: "Imported",
      region: "USA",
      sizeMb: 4.8,
      filePath: "Pokemon Diamond.zip",
      description: "Auto-imported from phone",
    },
    cookie: tv,
    ip: "192.168.1.10",
  });
  check("phone creates the library entry", created.status === 201 && created.json?.ok);
  const romId = created.json?.rom?.id ?? "";
  check("entry carries the import metadata", created.json?.rom?.platformSlug === "nds");

  // ── 9. Chunked upload (2 chunks, the mobile wire contract) ───────────────
  const bytes = Buffer.alloc(2_500_000);
  for (let i = 0; i < bytes.length; i += 1) bytes[i] = (i * 31 + 7) % 251;
  const chunkSize = 2_000_000;
  const total = Math.ceil(bytes.length / chunkSize);
  for (let index = 0; index < total; index += 1) {
    const slice = bytes.subarray(index * chunkSize, Math.min((index + 1) * chunkSize, bytes.length));
    const put = await api(`/api/roms/${romId}/rom`, {
      method: "POST",
      body: {
        index,
        total,
        fileName: "Pokemon Diamond.zip",
        sizeBytes: bytes.length,
        chunkSize,
        data: slice.toString("base64"),
      },
      cookie: tv,
      ip: "192.168.1.10",
    });
    check(`chunk ${index + 1}/${total} uploaded`, put.status === 200 && put.json?.ok);
  }

  // ── 10. The TV streams the ROM back byte-exact ───────────────────────────
  const downloaded = await fetch(`${BASE}/api/roms/${romId}/rom`, {
    headers: { Cookie: tv },
  });
  const roundTrip = Buffer.from(await downloaded.arrayBuffer());
  check("TV streams the ROM back", downloaded.status === 200);
  check(
    "round-trip is byte-exact",
    roundTrip.length === bytes.length && roundTrip.equals(bytes),
    `got ${roundTrip.length}B want ${bytes.length}B`,
  );

  // ── 11. The TV's library lists the imported game ─────────────────────────
  const list = await api("/api/roms", { cookie: tv });
  const listed = (list.json?.roms ?? []).some((rom) => rom.id === romId);
  check("imported game appears in the library", listed);

  // ── 12. Unpair drops the link and its privileges ─────────────────────────
  const unpaired = await api("/api/pair/unpair", {
    method: "POST",
    body: { code },
    cookie: tv,
    ip: "192.168.1.10",
  });
  check("unpair succeeds", unpaired.json?.ok === true && unpaired.json?.removed === true);

  const afterUnpair = await api("/api/pair/verify", {
    method: "POST",
    body: { code, side: "phone" },
    cookie: tv,
    ip: "192.168.1.10",
  });
  check("no verification after unpair", afterUnpair.status === 404);

  // ── 13. Decline path: claimed but rejected on the TV ─────────────────────
  const again = await api("/api/pair/start", {
    method: "POST",
    body: { tvName: "Living Room TV" },
    cookie: tv,
    ip: "192.168.1.10",
  });
  const code2 = again.json?.pair?.code ?? "";
  await api("/api/pair/claim", {
    method: "POST",
    body: { code: code2, phoneName: "Pixel" },
    cookie: tv,
    ip: "192.168.1.10",
  });
  const declined = await api("/api/pair/approve", {
    method: "POST",
    body: { code: code2, approve: false },
    cookie: tv,
    ip: "192.168.1.10",
  });
  check("declining on the TV removes the pairing", declined.json?.removed === true);

  console.log(`\n[e2e] ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
  console.log("[e2e] PAIRING E2E PASSED");
}

main().catch((error) => {
  console.error("[e2e] crashed:", error);
  process.exit(1);
});
