package io.github.mj_best.np3lab;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.UriPermission;
import android.net.Uri;
import android.os.Build;
import android.os.StatFs;
import android.os.storage.StorageManager;
import android.os.storage.StorageVolume;
import android.provider.DocumentsContract;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import androidx.documentfile.provider.DocumentFile;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.HashSet;
import java.util.Set;

/**
 * Folder access through the Storage Access Framework. The user picks a folder once
 * (the SD card in a USB reader, or an export folder); the permission is kept, so the
 * same card is recognised again whenever it's plugged back in.
 *
 * Paths are lists of folder names matched case-insensitively (FAT/exFAT cards may use
 * any case). The NIKON/CUSTOMPC rules themselves live in the web code (src/androidBridge.ts).
 */
@CapacitorPlugin(name = "SafFolders")
public class SafFoldersPlugin extends Plugin {

    private static final String PREFS = "saf-folders";
    private static final int MAX_FILE_BYTES = 1024 * 1024;

    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        // A card may have been inserted or removed while the app was in the background.
        notifyListeners("foldersChanged", new JSObject());
    }

    // ------------------------------------------------------------------------
    // Saved folders

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private Set<String> saved(String kind) {
        return new HashSet<>(prefs().getStringSet(kind, new HashSet<>()));
    }

    private void save(String kind, Set<String> uris) {
        prefs().edit().putStringSet(kind, uris).apply();
    }

    private boolean hasPermission(Uri uri) {
        for (UriPermission p : getContext().getContentResolver().getPersistedUriPermissions()) {
            if (p.getUri().equals(uri) && p.isReadPermission() && p.isWritePermission()) return true;
        }
        return false;
    }

    @PluginMethod
    public void pick(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        intent.addFlags(
            Intent.FLAG_GRANT_READ_URI_PERMISSION |
                Intent.FLAG_GRANT_WRITE_URI_PERMISSION |
                Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
        );
        startActivityForResult(call, intent, "onPicked");
    }

    @ActivityCallback
    private void onPicked(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Intent data = result.getData();
        if (result.getResultCode() != Activity.RESULT_OK || data == null || data.getData() == null) {
            call.resolve(new JSObject()); // cancelled: no uri
            return;
        }
        Uri uri = data.getData();
        try {
            getContext().getContentResolver().takePersistableUriPermission(
                uri,
                Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
            );
        } catch (SecurityException e) {
            call.reject("permission-denied");
            return;
        }
        String kind = call.getString("kind", "card");
        Set<String> uris = saved(kind);
        uris.add(uri.toString());
        save(kind, uris);
        call.resolve(describe(uri));
    }

    /**
     * Bytes for the next saveFile, sent ahead in their own call: the call that opens the
     * "Save as" screen is kept in the activity's saved state, and a large file there (a framed
     * photo, a backup) is more than Android allows, which crashes the app.
     */
    private byte[] pendingSave;

    @PluginMethod
    public void stageSave(PluginCall call) {
        String data = call.getString("data");
        if (data == null) {
            call.reject("missing-file");
            return;
        }
        pendingSave = Base64.decode(data, Base64.DEFAULT);
        call.resolve();
    }

    /** "Save as" for one file (NP3, ZIP, backup JSON): WebViews ignore <a download>. Resolves { saved }. */
    @PluginMethod
    public void saveFile(PluginCall call) {
        String name = call.getString("name");
        if (name == null || name.isEmpty() || pendingSave == null) {
            call.reject("missing-file");
            return;
        }
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(call.getString("mime", "application/octet-stream"));
        intent.putExtra(Intent.EXTRA_TITLE, name);
        startActivityForResult(call, intent, "onSaveTarget");
    }

    @ActivityCallback
    private void onSaveTarget(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Intent data = result.getData();
        JSObject ret = new JSObject();
        if (result.getResultCode() != Activity.RESULT_OK || data == null || data.getData() == null) {
            pendingSave = null;
            ret.put("saved", false);
            call.resolve(ret);
            return;
        }
        byte[] bytes = pendingSave;
        pendingSave = null;
        if (bytes == null) {
            call.reject("missing-file");
            return;
        }
        try (OutputStream out = getContext().getContentResolver().openOutputStream(data.getData(), "wt")) {
            if (out == null) throw new Exception("cannot-write");
            out.write(bytes);
        } catch (Exception e) {
            call.reject(e.getMessage() != null ? e.getMessage() : "cannot-write");
            return;
        }
        ret.put("saved", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void list(PluginCall call) {
        String kind = call.getString("kind", "card");
        JSArray out = new JSArray();
        Set<String> keep = new HashSet<>();
        for (String s : saved(kind)) {
            Uri uri = Uri.parse(s);
            if (!hasPermission(uri)) continue; // permission revoked in system settings
            keep.add(s);
            JSObject d = describe(uri);
            if (Boolean.TRUE.equals(d.getBool("available"))) out.put(d);
        }
        save(kind, keep);
        JSObject ret = new JSObject();
        ret.put("folders", out);
        call.resolve(ret);
    }

    @PluginMethod
    public void forget(PluginCall call) {
        String uriString = call.getString("uri");
        if (uriString == null) {
            call.reject("missing-uri");
            return;
        }
        Uri uri = Uri.parse(uriString);
        for (String kind : new String[] { "card", "export" }) {
            Set<String> uris = saved(kind);
            if (uris.remove(uriString)) save(kind, uris);
        }
        try {
            getContext().getContentResolver().releasePersistableUriPermission(
                uri,
                Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
            );
        } catch (SecurityException ignored) {
            // not held any more
        }
        call.resolve();
    }

    /** uri, display name, whether it's reachable now (card inserted), free space. */
    private JSObject describe(Uri uri) {
        JSObject d = new JSObject();
        d.put("uri", uri.toString());
        DocumentFile root = DocumentFile.fromTreeUri(getContext(), uri);
        boolean available = false;
        try {
            available = root != null && root.exists() && root.isDirectory();
        } catch (Exception ignored) {
            // provider gone (card removed)
        }
        d.put("available", available);
        String folderName = root != null ? root.getName() : null;
        StorageVolume volume = volumeFor(uri);
        String volumeName = null;
        if (volume != null) volumeName = volume.getDescription(getContext());
        d.put("folderName", folderName != null ? folderName : "");
        d.put("volumeName", volumeName != null ? volumeName : "");
        Long free = available ? freeBytes(uri, volume) : null;
        if (free != null) d.put("freeBytes", free);
        return d;
    }

    /** The storage volume a tree belongs to: tree ids look like "1A2B-3C4D:DCIM" or "primary:Download". */
    private StorageVolume volumeFor(Uri uri) {
        String uuid = volumeUuid(uri);
        if (uuid == null) return null;
        StorageManager sm = (StorageManager) getContext().getSystemService(Context.STORAGE_SERVICE);
        if (sm == null) return null;
        for (StorageVolume v : sm.getStorageVolumes()) {
            if ("primary".equalsIgnoreCase(uuid) ? v.isPrimary() : uuid.equalsIgnoreCase(v.getUuid())) return v;
        }
        return null;
    }

    private static String volumeUuid(Uri uri) {
        try {
            String id = DocumentsContract.getTreeDocumentId(uri);
            int colon = id.indexOf(':');
            return colon > 0 ? id.substring(0, colon) : null;
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private Long freeBytes(Uri uri, StorageVolume volume) {
        try {
            File dir = null;
            if (volume != null && Build.VERSION.SDK_INT >= 30) dir = volume.getDirectory();
            if (dir == null) {
                String uuid = volumeUuid(uri);
                if (uuid != null && !"primary".equalsIgnoreCase(uuid)) dir = new File("/storage/" + uuid);
            }
            if (dir == null || !dir.exists()) return null;
            return new StatFs(dir.getPath()).getAvailableBytes();
        } catch (Exception e) {
            return null;
        }
    }

    // ------------------------------------------------------------------------
    // Files

    private static DocumentFile childNamed(DocumentFile dir, String name) {
        for (DocumentFile f : dir.listFiles()) {
            String n = f.getName();
            if (n != null && n.equalsIgnoreCase(name)) return f;
        }
        return null;
    }

    private DocumentFile root(PluginCall call) throws Exception {
        String uriString = call.getString("uri");
        if (uriString == null) throw new Exception("missing-uri");
        Uri uri = Uri.parse(uriString);
        if (!saved("card").contains(uriString) && !saved("export").contains(uriString)) throw new Exception("folder-not-allowed");
        DocumentFile root = DocumentFile.fromTreeUri(getContext(), uri);
        if (root == null || !root.exists()) throw new Exception("card-not-found");
        return root;
    }

    /** Walk `path` from the root; creates missing folders when `create`, else returns null. */
    private DocumentFile folder(PluginCall call, boolean create) throws Exception {
        DocumentFile dir = root(call);
        JSArray path = call.getArray("path", new JSArray());
        for (int i = 0; i < path.length(); i++) {
            String seg = safeName(path.getString(i));
            DocumentFile next = childNamed(dir, seg);
            if (next == null) {
                if (!create) return null;
                next = dir.createDirectory(seg);
                if (next == null) throw new Exception("cannot-create-folder:" + seg);
            } else if (!next.isDirectory()) {
                throw new Exception("not-a-folder:" + seg);
            }
            dir = next;
        }
        return dir;
    }

    private static String safeName(String name) throws Exception {
        if (name == null || name.isEmpty() || name.equals(".") || name.equals("..") || name.contains("/") || name.contains("\\")) {
            throw new Exception("invalid-name");
        }
        return name;
    }

    @PluginMethod
    public void children(PluginCall call) {
        try {
            DocumentFile dir = folder(call, false);
            JSObject ret = new JSObject();
            JSArray entries = new JSArray();
            if (dir != null) {
                for (DocumentFile f : dir.listFiles()) {
                    if (f.getName() == null) continue;
                    JSObject e = new JSObject();
                    e.put("name", f.getName());
                    e.put("isDir", f.isDirectory());
                    e.put("size", f.length());
                    entries.put(e);
                }
            }
            ret.put("exists", dir != null);
            ret.put("entries", entries);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    @PluginMethod
    public void readFile(PluginCall call) {
        try {
            DocumentFile dir = folder(call, false);
            DocumentFile f = dir == null ? null : childNamed(dir, safeName(call.getString("name")));
            if (f == null || !f.isFile()) throw new Exception("not-found");
            if (f.length() > MAX_FILE_BYTES) throw new Exception("too-large");
            ByteArrayOutputStream buf = new ByteArrayOutputStream();
            try (InputStream in = getContext().getContentResolver().openInputStream(f.getUri())) {
                if (in == null) throw new Exception("cannot-read");
                byte[] chunk = new byte[8192];
                int n;
                while ((n = in.read(chunk)) > 0) buf.write(chunk, 0, n);
            }
            JSObject ret = new JSObject();
            ret.put("data", Base64.encodeToString(buf.toByteArray(), Base64.NO_WRAP));
            call.resolve(ret);
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    /** Write one file; fails with "exists:<name>" unless `overwrite` is set. */
    @PluginMethod
    public void writeFile(PluginCall call) {
        try {
            String name = safeName(call.getString("name"));
            byte[] bytes = Base64.decode(call.getString("data", ""), Base64.DEFAULT);
            if (bytes.length > MAX_FILE_BYTES) throw new Exception("too-large");
            DocumentFile dir = folder(call, true);
            DocumentFile f = childNamed(dir, name);
            if (f != null && !call.getBoolean("overwrite", false)) throw new Exception("exists:" + name);
            if (f == null) {
                f = dir.createFile("application/octet-stream", name);
                if (f == null) throw new Exception("cannot-create:" + name);
                // Some providers add an extension of their own; keep the exact name the camera expects.
                if (!name.equals(f.getName())) f.renameTo(name);
            }
            try (OutputStream out = getContext().getContentResolver().openOutputStream(f.getUri(), "wt")) {
                if (out == null) throw new Exception("cannot-write:" + name);
                out.write(bytes);
            }
            call.resolve();
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    @PluginMethod
    public void deleteFile(PluginCall call) {
        try {
            DocumentFile dir = folder(call, false);
            DocumentFile f = dir == null ? null : childNamed(dir, safeName(call.getString("name")));
            if (f == null) throw new Exception("not-found");
            if (!f.delete()) throw new Exception("cannot-delete");
            call.resolve();
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }
}
