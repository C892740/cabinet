package com.cabinet.app

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import java.util.concurrent.Executors

/**
 * ROMs — pick the phone's ROM folder once; Cabinet detects the games in it
 * (zipped archives included) and imports them into the shared library while
 * the paired TV link verifies the phone is on the same Wi-Fi.
 */
class RomActivity : Activity() {

    private val main = Handler(Looper.getMainLooper())
    private val io = Executors.newSingleThreadExecutor()

    private lateinit var status: TextView
    private lateinit var list: LinearLayout

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(48, 48, 48, 48)
        }

        root.addView(TextView(this).apply {
            text = "ROMs on this phone"
            textSize = 26f
        })
        root.addView(TextView(this).apply {
            text = "Choose the folder that holds your ROMs. Cabinet detects the games in it " +
                "and adds them to your library — automatically, while the linked TV confirms " +
                "you are on the same Wi-Fi."
            textSize = 14f
            setPadding(0, 12, 0, 24)
        })

        root.addView(Button(this).apply {
            text = "Choose ROM folder…"
            setOnClickListener { pickFolder() }
        })
        root.addView(Button(this).apply {
            text = "Scan & import now"
            setOnClickListener { scanAndImport() }
        })

        status = TextView(this).apply {
            text = "No folder chosen yet."
            textSize = 15f
            setPadding(0, 20, 0, 12)
        }
        root.addView(status)

        list = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        root.addView(list)

        setContentView(ScrollView(this).apply { addView(root) })

        SafWalker.persistedTreeUri(this)?.let {
            status.text = "Folder remembered — scanning…"
            scanAndImport()
        }
    }

    private fun pickFolder() {
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).apply {
            addFlags(
                Intent.FLAG_GRANT_READ_URI_PERMISSION or
                    Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION,
            )
        }
        startActivityForResult(intent, PICK_TREE)
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == PICK_TREE && resultCode == RESULT_OK) {
            val uri = data?.data ?: return
            SafWalker.takePersistablePermission(this, uri)
            Prefs.setRomTree(this, uri.toString())
            status.text = "Folder chosen — scanning…"
            scanAndImport()
        }
    }

    private fun scanAndImport() {
        val treeUri: Uri = Prefs.romTree(this)?.let(Uri::parse)
            ?: SafWalker.persistedTreeUri(this)
            ?: run {
                status.text = "Choose a ROM folder first."
                return
            }

        status.text = "Scanning for ROMs…"
        list.removeAllViews()

        io.execute {
            val entries = runCatching { SafWalker.scan(this, treeUri) }.getOrElse {
                main.post { status.text = "Scan failed: ${it.message}" }
                return@execute
            }
            main.post {
                status.text = "Found ${entries.size} ROM file(s)."
                for (entry in entries) {
                    val row = TextView(this).apply {
                        text = "• ${entry.name}  (${RomCatalog.platformFromFileName(entry.name) ?: "zip/other"})"
                        textSize = 14f
                        gravity = Gravity.START
                    }
                    list.addView(row)
                }
            }

            val pairCode = Prefs.pairCode(this)
            if (pairCode == null) {
                main.post { status.text = "Found ${entries.size} ROM(s). Link a TV first to auto-import." }
                return@execute
            }

            val importer = RomImporter(this, Api(Prefs.serverUrl(this)), PairingClient(Api(Prefs.serverUrl(this))))
            val results = importer.importAll(entries, pairCode) { progress ->
                main.post {
                    status.text = "${progress.name}: ${progress.state} ${progress.detail}"
                }
            }
            val imported = results.count { it.state == "imported" }
            main.post {
                status.text = "Done — imported $imported of ${entries.size}. " +
                    results.filter { it.state == "blocked" }
                        .firstOrNull()
                        ?.let { "Stopped: ${it.detail}" }
                        .orEmpty()
            }
        }
    }

    companion object {
        private const val PICK_TREE = 42
    }
}
