package com.cabinet.app

import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.text.InputType
import android.view.Menu
import android.view.MenuItem
import android.webkit.CookieManager
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.EditText
import android.widget.FrameLayout

/**
 * The Cabinet shell: the full web app (library, player, TV mode) in a WebView,
 * plus native Link TV and ROM scan screens. Sign-in happens in the WebView and
 * is shared with the native screens through the cookie jar.
 */
class MainActivity : Activity() {

    private lateinit var webView: WebView
    private var fileChooserCallback: ValueCallback<Array<Uri>>? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        webView = WebView(this)
        setContentView(FrameLayout(this).apply { addView(webView) })

        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true)
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            cacheMode = WebSettings.LOAD_DEFAULT
            mediaPlaybackRequiresUserGesture = false
            allowFileAccess = false
        }
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(
                view: WebView?,
                request: WebResourceRequest?,
            ): Boolean = false // keep all navigation inside the shell
        }
        webView.webChromeClient = object : WebChromeClient() {
            // Let web-side file pickers (attach a ROM in the browser UI) work.
            override fun onShowFileChooser(
                view: WebView?,
                callback: ValueCallback<Array<Uri>>?,
                params: FileChooserParams?,
            ): Boolean {
                fileChooserCallback?.onReceiveValue(null)
                fileChooserCallback = callback
                startActivity(params?.createIntent() ?: Intent(Intent.ACTION_OPEN_DOCUMENT))
                return true
            }
        }

        if (savedInstanceState == null) {
            webView.loadUrl(Prefs.serverUrl(this))
        } else {
            webView.restoreState(savedInstanceState)
        }
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == FILE_PICK) {
            val result = if (resultCode == RESULT_OK) {
                data?.data?.let { arrayOf(it) }
            } else {
                null
            }
            fileChooserCallback?.onReceiveValue(result)
            fileChooserCallback = null
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
    }

    override fun onCreateOptionsMenu(menu: Menu): Boolean {
        menu.add(0, MENU_LINK_TV, 0, "Link TV…")
        menu.add(0, MENU_SCAN, 1, "Scan ROMs…")
        menu.add(0, MENU_SERVER, 2, "Change server…")
        menu.add(0, MENU_RELOAD, 3, "Reload")
        return true
    }

    override fun onOptionsItemSelected(item: MenuItem): Boolean = when (item.itemId) {
        MENU_LINK_TV -> {
            startActivity(Intent(this, PairActivity::class.java)); true
        }
        MENU_SCAN -> {
            startActivity(Intent(this, RomActivity::class.java)); true
        }
        MENU_SERVER -> {
            promptServer(); true
        }
        MENU_RELOAD -> {
            webView.loadUrl(Prefs.serverUrl(this)); true
        }
        else -> super.onOptionsItemSelected(item)
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }

    private fun promptServer() {
        val input = EditText(this).apply {
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_URI
            setText(Prefs.serverUrl(this@MainActivity))
            hint = "https://cabinet-eta-gilt.vercel.app"
        }
        AlertDialog.Builder(this)
            .setTitle("Cabinet server")
            .setView(input)
            .setPositiveButton("Save") { _, _ ->
                val url = input.text.toString().trim()
                if (url.isNotEmpty()) {
                    Prefs.setServerUrl(this, url)
                    webView.loadUrl(url)
                }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    companion object {
        private const val FILE_PICK = 41
        private const val MENU_LINK_TV = 1
        private const val MENU_SCAN = 2
        private const val MENU_SERVER = 3
        private const val MENU_RELOAD = 4
    }
}
