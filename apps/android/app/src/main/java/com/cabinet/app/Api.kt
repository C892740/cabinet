package com.cabinet.app

import android.util.Log
import android.webkit.CookieManager
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

/**
 * Thin JSON-over-HTTP client for the Cabinet API.
 *
 * Auth reuses the WebView's cookie jar (CookieManager), so signing in once in
 * the embedded web app also authenticates the native Link TV / ROM import
 * screens. Non-browser clients send no Origin header, which the server's
 * CSRF check accepts (same policy as the desktop app).
 */
class Api(private val baseUrl: String) {

    class ApiException(val status: Int, message: String) : Exception(message)

    private fun cookiesFor(url: String): String =
        CookieManager.getInstance().getCookie(url) ?: ""

    fun get(path: String): JSONObject = request("GET", path, null)

    fun post(path: String, body: JSONObject): JSONObject = request("POST", path, body.toString())

    private fun request(method: String, path: String, body: String?): JSONObject {
        val url = URL(baseUrl.trimEnd('/') + path)
        val connection = (url.openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 15_000
            readTimeout = 120_000
            setRequestProperty("Accept", "application/json")
            val cookies = cookiesFor(url.toString())
            if (cookies.isNotEmpty()) setRequestProperty("Cookie", cookies)
            if (body != null) {
                doOutput = true
                setRequestProperty("Content-Type", "application/json")
            }
        }
        try {
            if (body != null) {
                OutputStreamWriter(connection.outputStream, Charsets.UTF_8).use { it.write(body) }
            }
            val status = connection.responseCode
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            val text = stream?.let { input ->
                BufferedReader(InputStreamReader(input, Charsets.UTF_8)).use { it.readText() }
            } ?: ""
            val json = try {
                JSONObject(text)
            } catch (_: Exception) {
                JSONObject()
            }
            if (status !in 200..299) {
                throw ApiException(status, json.optString("error", "HTTP $status"))
            }
            return json
        } finally {
            connection.disconnect()
        }
    }

    companion object {
        private const val TAG = "CabinetApi"

        fun log(message: String) {
            Log.d(TAG, message)
        }
    }
}
