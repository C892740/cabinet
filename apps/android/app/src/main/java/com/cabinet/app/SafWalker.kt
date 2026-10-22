package com.cabinet.app

import android.content.ContentResolver
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.DocumentsContract

/**
 * ROM discovery on Android: the user picks a ROM folder once
 * (ACTION_OPEN_DOCUMENT_TREE, persistable grant) and this walker enumerates
 * ROM files inside it. Modern Android deliberately has no "scan all of
 * storage" API — user-granted trees are the supported route.
 */
object SafWalker {

    data class FoundRom(
        val uri: Uri,
        val name: String,
        val sizeBytes: Long,
        val lastModified: Long,
    )

    fun takePersistablePermission(context: Context, uri: Uri) {
        try {
            context.contentResolver.takePersistableUriPermission(
                uri,
                Intent.FLAG_GRANT_READ_URI_PERMISSION,
            )
        } catch (_: SecurityException) {
            // Some providers only grant transient access; the scan still works
            // for this session and the app re-prompts on the next one.
        }
    }

    fun persistedTreeUri(context: Context): Uri? =
        context.contentResolver.persistedUriPermissions
            .firstOrNull { it.isReadPermission }
            ?.uri

    fun scan(context: Context, treeUri: Uri, maxFiles: Int = 2000): List<FoundRom> {
        val found = ArrayList<FoundRom>()
        walk(context.contentResolver, treeUri, DocumentsContract.getTreeDocumentId(treeUri), found, maxFiles)
        return found
    }

    private fun walk(
        resolver: ContentResolver,
        treeUri: Uri,
        documentId: String,
        out: MutableList<FoundRom>,
        maxFiles: Int,
    ) {
        if (out.size >= maxFiles) return
        val children = DocumentsContract.buildChildDocumentsUriUsingTree(treeUri, documentId)
        resolver.query(children, null, null, null, null)?.use { cursor ->
            val idIdx = cursor.getColumnIndex(DocumentsContract.Document.COLUMN_DOCUMENT_ID)
            val nameIdx = cursor.getColumnIndex(DocumentsContract.Document.COLUMN_DISPLAY_NAME)
            val mimeIdx = cursor.getColumnIndex(DocumentsContract.Document.COLUMN_MIME_TYPE)
            val sizeIdx = cursor.getColumnIndex(DocumentsContract.Document.COLUMN_SIZE)
            val modifiedIdx = cursor.getColumnIndex(DocumentsContract.Document.COLUMN_LAST_MODIFIED)
            while (cursor.moveToNext() && out.size < maxFiles) {
                val childId = cursor.getString(idIdx)
                val name = cursor.getString(nameIdx) ?: continue
                val mime = cursor.getString(mimeIdx) ?: ""
                if (mime == DocumentsContract.Document.MIME_TYPE_DIR) {
                    walk(resolver, treeUri, childId, out, maxFiles)
                } else if (RomCatalog.isRomFile(name)) {
                    out.add(
                        FoundRom(
                            uri = DocumentsContract.buildDocumentUriUsingTree(treeUri, childId),
                            name = name,
                            sizeBytes = cursor.getLong(sizeIdx),
                            lastModified = cursor.getLong(modifiedIdx),
                        ),
                    )
                }
            }
        }
    }
}
