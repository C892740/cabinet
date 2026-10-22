package com.cabinet.app

import org.json.JSONObject

/**
 * Phone ↔ TV link client: claim the TV's code, heartbeat/verify the same
 * Wi-Fi link, and list or drop links. Everything goes through the Cabinet
 * server — the TV is a web app and cannot accept direct connections.
 */
class PairingClient(private val api: Api) {

    data class PairState(
        val code: String,
        val status: String,
        val phoneName: String,
        val phoneModel: String,
        val sameNetwork: Boolean,
        val tvLastSeenAt: Long?,
    )

    data class VerifyResult(val pair: PairState, val canAutoImport: Boolean, val reason: String)

    /** Claim the code shown on the TV. Throws Api.ApiException on bad/expired codes. */
    fun claim(code: String, phoneName: String, phoneModel: String): PairState {
        val response = api.post(
            "/api/pair/claim",
            JSONObject()
                .put("code", PairGate.normalizeCode(code))
                .put("phoneName", phoneName)
                .put("phoneModel", phoneModel),
        )
        return parsePair(response.getJSONObject("pair"))
    }

    /**
     * Heartbeat + re-verification. The server refreshes this phone's observed
     * egress IP and recomputes the same-network verdict; the response decides
     * whether ROM auto-import may run right now.
     */
    fun verify(code: String): VerifyResult {
        val response = api.post(
            "/api/pair/verify",
            JSONObject()
                .put("code", PairGate.normalizeCode(code))
                .put("side", "phone"),
        )
        val pair = parsePair(response.getJSONObject("pair"))
        val state = PairGate.VerifyState(
            status = pair.status,
            sameNetwork = pair.sameNetwork,
            tvLastSeenAt = pair.tvLastSeenAt,
            now = System.currentTimeMillis(),
        )
        val decision = PairGate.decide(state)
        return VerifyResult(pair, decision.ok, decision.reason)
    }

    fun unpair(code: String) {
        api.post("/api/pair/unpair", JSONObject().put("code", PairGate.normalizeCode(code)))
    }

    fun list(): List<PairState> {
        val response = api.get("/api/pair/list")
        val pairs = response.optJSONArray("pairs") ?: return emptyList()
        return (0 until pairs.length()).map { parsePair(pairs.getJSONObject(it)) }
    }

    private fun parsePair(json: JSONObject): PairState {
        val tvSeen = json.optString("tvLastSeenAt", "")
        return PairState(
            code = json.optString("code", ""),
            status = json.optString("status", "waiting"),
            phoneName = json.optString("phoneName", ""),
            phoneModel = json.optString("phoneModel", ""),
            sameNetwork = json.optBoolean("sameNetwork", false),
            tvLastSeenAt = if (tvSeen.isNullOrEmpty()) null else parseIso(tvSeen),
        )
    }

    companion object {
        /** Minimal ISO-8601 → epoch ms (the API always sends UTC "Z" stamps). */
        fun parseIso(value: String): Long? = try {
            java.time.Instant.parse(value).toEpochMilli()
        } catch (_: Exception) {
            null
        }
    }
}
