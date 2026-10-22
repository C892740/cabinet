package com.cabinet.app

import android.content.Context

/** Small preference store: server URL, pair code, ROM folder, import toggle. */
object Prefs {
    private const val NAME = "cabinet_prefs"
    private const val KEY_SERVER = "server_url"
    private const val KEY_PAIR_CODE = "pair_code"
    private const val KEY_AUTO_IMPORT = "auto_import"
    private const val KEY_ROM_TREE = "rom_tree"

    fun serverUrl(context: Context): String =
        prefs(context).getString(KEY_SERVER, null) ?: defaultServer()

    fun setServerUrl(context: Context, url: String) =
        prefs(context).edit().putString(KEY_SERVER, url.trimEnd('/')).apply()

    fun pairCode(context: Context): String? = prefs(context).getString(KEY_PAIR_CODE, null)

    fun setPairCode(context: Context, code: String?) {
        prefs(context).edit().putString(KEY_PAIR_CODE, code).apply()
    }

    fun autoImport(context: Context): Boolean = prefs(context).getBoolean(KEY_AUTO_IMPORT, true)

    fun setAutoImport(context: Context, enabled: Boolean) =
        prefs(context).edit().putBoolean(KEY_AUTO_IMPORT, enabled).apply()

    fun romTree(context: Context): String? = prefs(context).getString(KEY_ROM_TREE, null)

    fun setRomTree(context: Context, uri: String) =
        prefs(context).edit().putString(KEY_ROM_TREE, uri).apply()

    fun deviceName(context: Context): String = android.os.Build.MODEL ?: "Android phone"

    private fun prefs(context: Context) = context.getSharedPreferences(NAME, Context.MODE_PRIVATE)

    private fun defaultServer(): String = try {
        com.cabinet.app.BuildConfig.DEFAULT_SERVER_URL
    } catch (_: Throwable) {
        "https://cabinet-eta-gilt.vercel.app"
    }
}
