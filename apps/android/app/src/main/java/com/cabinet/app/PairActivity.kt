package com.cabinet.app

import android.app.Activity
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.text.InputType
import android.view.Gravity
import android.widget.Button
import android.widget.CheckBox
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import java.util.concurrent.Executors

/**
 * Link TV — the phone side of the Smart View-style handshake:
 * enter the code shown on the TV, wait for the TV to approve, and see the
 * live "same Wi-Fi" verdict that gates ROM auto-import.
 */
class PairActivity : Activity() {

    private val main = Handler(Looper.getMainLooper())
    private val io = Executors.newSingleThreadExecutor()

    private lateinit var status: TextView
    private lateinit var codeInput: EditText
    private lateinit var linkButton: Button
    private lateinit var unlinkButton: Button
    private lateinit var autoImport: CheckBox

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(48, 48, 48, 48)
        }

        root.addView(TextView(this).apply {
            text = "Link TV"
            textSize = 26f
            gravity = Gravity.START
        })
        root.addView(TextView(this).apply {
            text = "Open Cabinet on your TV → Link a phone → enter that code here. " +
                "Once linked, ROMs on this phone are added to the library automatically " +
                "while both devices are on the same Wi-Fi."
            textSize = 14f
            setPadding(0, 12, 0, 24)
        })

        codeInput = EditText(this).apply {
            hint = "123-456"
            inputType = InputType.TYPE_CLASS_NUMBER
        }
        root.addView(codeInput)

        linkButton = Button(this).apply {
            text = "Link with TV"
            setOnClickListener { claim() }
        }
        root.addView(linkButton)

        unlinkButton = Button(this).apply {
            text = "Unlink"
            visibility = android.view.View.GONE
            setOnClickListener { unpair() }
        }
        root.addView(unlinkButton)

        autoImport = CheckBox(this).apply {
            text = "Auto-import ROMs when the TV link is verified"
            isChecked = Prefs.autoImport(this@PairActivity)
            setOnCheckedChangeListener { _, checked -> Prefs.setAutoImport(this@PairActivity, checked) }
        }
        root.addView(autoImport)

        status = TextView(this).apply {
            text = "Not linked yet."
            textSize = 15f
            setPadding(0, 24, 0, 0)
        }
        root.addView(status)

        setContentView(ScrollView(this).apply { addView(root) })

        Prefs.pairCode(this)?.let { code ->
            codeInput.setText(code)
            verifyLoop(code)
        }
    }

    private fun claim() {
        val code = PairGate.normalizeCode(codeInput.text.toString())
        if (code.length != 6) {
            status.text = "Enter the 6-digit code shown on the TV."
            return
        }
        linkButton.isEnabled = false
        status.text = "Linking…"
        io.execute {
            val result = runCatching {
                val api = Api(Prefs.serverUrl(this))
                val pair = PairingClient(api).claim(
                    code,
                    phoneName = Prefs.deviceName(this),
                    phoneModel = android.os.Build.MODEL,
                )
                pair to null
            }
            main.post {
                linkButton.isEnabled = true
                result.onSuccess { (pair, _) ->
                    Prefs.setPairCode(this, pair.code)
                    status.text = when (pair.status) {
                        "claimed" -> "Code accepted — approve the link on the TV screen."
                        "linked" -> "Linked. Same Wi-Fi: ${pair.sameNetwork}"
                        else -> "Status: ${pair.status}"
                    }
                    if (pair.status == "claimed" || pair.status == "linked") {
                        unlinkButton.visibility = android.view.View.VISIBLE
                        verifyLoop(pair.code)
                    }
                }.onFailure { error ->
                    status.text = "Could not link: ${error.message}"
                }
            }
        }
    }

    /** Poll /api/pair/verify so the verdict on screen (and the import gate) stays live. */
    private fun verifyLoop(code: String) {
        io.execute {
            val result = runCatching {
                PairingClient(Api(Prefs.serverUrl(this))).verify(code)
            }
            main.post {
                result.onSuccess { verify ->
                    val gate = when (verify.reason) {
                        "ready" -> "✓ Same Wi-Fi — auto-import is active"
                        "different-network" -> "⚠ Not on the same Wi-Fi — auto-import paused"
                        "tv-offline" -> "TV not seen recently — auto-import paused"
                        else -> "Waiting for the TV to approve the link…"
                    }
                    status.text = "Status: ${verify.pair.status}\n$gate"
                    unlinkButton.visibility = android.view.View.VISIBLE
                    main.postDelayed({ verifyLoop(code) }, 30_000)
                }.onFailure { error ->
                    status.text = "Verification failed: ${error.message}"
                }
            }
        }
    }

    private fun unpair() {
        val code = Prefs.pairCode(this) ?: return
        io.execute {
            runCatching { PairingClient(Api(Prefs.serverUrl(this))).unpair(code) }
            main.post {
                Prefs.setPairCode(this, null)
                unlinkButton.visibility = android.view.View.GONE
                status.text = "Unlinked."
            }
        }
    }
}
