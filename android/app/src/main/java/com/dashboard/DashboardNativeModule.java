package com.dashboard;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.ActivityInfo;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.PixelFormat;
import android.graphics.drawable.GradientDrawable;
import android.os.BatteryManager;
import android.os.Build;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.os.StatFs;
import android.provider.Settings;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import java.io.File;
import java.util.List;

/**
 * Native bridge for the Dashboard plugin:
 *  - openNote / openFolder / launchActivity: open device targets by intent
 *  - listLaunchableApps: enumerate launchable apps for the Apps zone / config
 *  - overlay: the draggable floating bubble (tap→expand, long-press→close)
 *  - writeFile / appendLog: persistence & on-device logging (SDK has no writeFile)
 */
public class DashboardNativeModule extends ReactContextBaseJavaModule {
    private final Handler main = new Handler(Looper.getMainLooper());

    // Overlay state is static → one bubble per process; last position survives hide/show.
    private static WindowManager wm;
    private static View overlayView;
    private static WindowManager.LayoutParams overlayParams;
    private static int lastX = -1, lastY = -1;
    private int startX, startY;
    private float startRawX, startRawY;
    private boolean dragging;
    private static final String BUBBLE_TAG = "DASHBOARD_BUBBLE";

    public DashboardNativeModule(ReactApplicationContext ctx) {
        super(ctx);
    }

    @Override
    public String getName() {
        return "DashboardNative";
    }

    private void emit(String event, WritableMap payload) {
        getReactApplicationContext()
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                .emit(event, payload);
    }



    // The Pretty Calendar snapshot is stored under PluginHost's private
    // Android files directory, not in the user's shared MyStyle directory.
    // This is a read-only copy of the existing feed and never mirrors records
    // into the system Calendar database.
    private File privateCalendarSnapshotFile() throws java.io.IOException {
        File dir = new File(getReactApplicationContext().getFilesDir(),
                "MySuperPrettyDashboard");
        if (!dir.isDirectory() && !dir.mkdirs()) {
            throw new java.io.IOException("Cannot create private calendar cache folder");
        }
        return new File(dir, "calendar-snapshot.json");
    }

    @ReactMethod
    public void readPrivateCalendarSnapshot(Promise promise) {
        try {
            File file = privateCalendarSnapshotFile();
            if (!file.isFile()) { promise.resolve(""); return; }
            if (file.length() > 4L * 1024L * 1024L) {
                throw new java.io.IOException("Calendar cache exceeds size limit");
            }
            byte[] data = java.nio.file.Files.readAllBytes(file.toPath());
            promise.resolve(new String(data, java.nio.charset.StandardCharsets.UTF_8));
        } catch (Exception e) {
            promise.reject("CALENDAR_CACHE_READ_FAILED",
                    "Could not load saved calendar snapshot", e);
        }
    }

    @ReactMethod
    public void savePrivateCalendarSnapshot(String json, Promise promise) {
        android.util.AtomicFile atomic = null;
        java.io.FileOutputStream out = null;
        try {
            byte[] data = json.getBytes(java.nio.charset.StandardCharsets.UTF_8);
            if (data.length > 4L * 1024L * 1024L) {
                throw new java.io.IOException("Calendar snapshot exceeds size limit");
            }
            atomic = new android.util.AtomicFile(privateCalendarSnapshotFile());
            out = atomic.startWrite();
            out.write(data);
            atomic.finishWrite(out);
            out = null;
            promise.resolve(true);
        } catch (Exception e) {
            if (out != null && atomic != null) atomic.failWrite(out);
            promise.reject("CALENDAR_CACHE_WRITE_FAILED",
                    "Could not save calendar snapshot", e);
        }
    }

    // Calendar interoperability probe (read only). A visible Today button does
    // NOT prove there is an exported date-navigation contract.
    // Inspect PackageManager's documented exported surfaces before attempting
    // any date-specific Intent. Does not read calendar events or credentials.
    @ReactMethod
    public void inspectNativeCalendar(Promise promise) {
        try {
            final String packageName = "com.ratta.supernote.calendar";
            PackageManager pm = getReactApplicationContext().getPackageManager();
            android.content.pm.PackageInfo pkg = pm.getPackageInfo(
                    packageName, PackageManager.GET_ACTIVITIES);
            StringBuilder report = new StringBuilder();
            report.append("Calendar package: ").append(packageName).append('\n');
            report.append("Version: ").append(pkg.versionName).append('\n');
            report.append("Android SDK: ").append(android.os.Build.VERSION.SDK_INT).append('\n');
            report.append("Installed APK: ")
                    .append(pkg.applicationInfo == null ? "(unknown)" : pkg.applicationInfo.sourceDir)
                    .append("\n\nExported activities:\n");
            int count = 0;
            if (pkg.activities != null) {
                for (ActivityInfo item : pkg.activities) {
                    if (!item.exported) continue;
                    count++;
                    report.append("  ").append(item.name);
                    if (item.permission != null) report.append(" [permission: ").append(item.permission).append("]");
                    report.append('\n');
                }
            }
            report.append("Exported activity count: ").append(count).append('\n');

            // PackageManager will only list handlers that were actually
            // registered in the Android manifest for each tested URI/action.
            // An absent match does not rule out private in-app handlers.
            String[] uris = {
                null,
                "content://com.android.calendar/time/" + System.currentTimeMillis(),
                "content://com.android.calendar/events/1",
                "content://com.ratta.supernote.calendar.provider/data_info",
                "supernote://calendar/2026-11-23"
            };
            report.append("\nDate-related ACTION_VIEW filter probes:\n");
            for (String uri : uris) {
                Intent probe = new Intent(Intent.ACTION_VIEW);
                if (uri != null) probe.setData(android.net.Uri.parse(uri));
                probe.setPackage(packageName);
                java.util.List<ResolveInfo> matches = pm.queryIntentActivities(
                    probe, PackageManager.MATCH_DEFAULT_ONLY | PackageManager.GET_RESOLVED_FILTER);
                report.append("  ").append(uri == null ? "(no URI)" : uri)
                      .append(": ").append(matches.size()).append(" handler(s)\n");
                for (ResolveInfo match : matches) {
                    if (match.activityInfo != null) {
                        report.append("    ").append(match.activityInfo.name).append('\n');
                    }
                }
            }
            report.append("\nNo navigation action was invoked. This report is informational only.\n");
            promise.resolve(report.toString());
        } catch (Exception e) {
            promise.reject("CALENDAR_INSPECT_FAILED",
                    "Cannot inspect installed Supernote Calendar: " + e.getMessage(), e);
        }
    }

    /**
     * User-triggered interoperability research export.
     * Copies the installed Calendar app binary to a visible EXPORT folder.
     * This is NOT automatic, and no calendar events, notes or user data are read.
     * The user chooses whether to share the package for private inspection.
     */
    @ReactMethod
    public void exportNativeCalendarPackage(Promise promise) {
        new Thread(new Runnable() {
            @Override public void run() {
                try {
                    PackageManager pm = getReactApplicationContext().getPackageManager();
                    android.content.pm.ApplicationInfo app = pm.getApplicationInfo(
                        "com.ratta.supernote.calendar", 0);
                    if (app.sourceDir == null || app.sourceDir.isEmpty()) {
                        throw new java.io.IOException("PackageManager has no sourceDir");
                    }
                    File input = new File(app.sourceDir);
                    if (!input.isFile() || !input.canRead()) {
                        throw new java.io.IOException("Installed Calendar APK is not readable");
                    }
                    if (input.length() > 200L * 1024L * 1024L) {
                        throw new java.io.IOException("Unexpectedly large APK; export aborted");
                    }
                    File folder = new File("/storage/emulated/0/EXPORT/MySuperPrettyDashboard");
                    if (!folder.isDirectory() && !folder.mkdirs()) {
                        throw new java.io.IOException("Could not create EXPORT/MySuperPrettyDashboard");
                    }
                    File target = new File(folder, "SupernoteCalendar-for-analysis.apk");
                    File temporary = new File(folder, "SupernoteCalendar-for-analysis.apk.partial");
                    long copied = 0;
                    try (java.io.InputStream from = new java.io.BufferedInputStream(
                            new java.io.FileInputStream(input));
                         java.io.OutputStream to = new java.io.BufferedOutputStream(
                            new java.io.FileOutputStream(temporary))) {
                        byte[] chunk = new byte[65536];
                        int n;
                        while ((n = from.read(chunk)) != -1) {
                            to.write(chunk, 0, n);
                            copied += n;
                        }
                    } catch (Exception e) {
                        temporary.delete();
                        throw e;
                    }
                    if (copied != input.length()) {
                        temporary.delete();
                        throw new java.io.IOException("Copy length mismatch");
                    }
                    if (target.exists() && !target.delete()) {
                        temporary.delete();
                        throw new java.io.IOException("Cannot replace old analysis package");
                    }
                    if (!temporary.renameTo(target)) {
                        temporary.delete();
                        throw new java.io.IOException("Cannot finalize analysis package");
                    }
                    promise.resolve(target.getAbsolutePath());
                } catch (Exception e) {
                    promise.reject("CALENDAR_EXPORT_FAILED",
                        "Cannot export Calendar app: " + e.getMessage(), e);
                }
            }
        }, "SupernoteCalendarExport").start();
    }

    // ---- Intents ----------------------------------------------------------

    /** Open a .note in the editor at a 1-based page (page<=0 → last-used page). */
    @ReactMethod
    public void openNote(String path, int page, Promise promise) {
        try {
            Intent intent = new Intent();
            intent.setComponent(new ComponentName(
                    "com.ratta.supernote.note",
                    "com.ratta.supernote.note.view.NoteInsidePagesActivity"));
            intent.putExtra("file_path", path);
            if (page > 0) intent.putExtra("page", page);
            intent.setAction(Intent.ACTION_VIEW); // required or the file_path extra is ignored
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getReactApplicationContext().startActivity(intent);
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("OPEN_NOTE_FAILED", e.getClass().getSimpleName() + ": " + e.getMessage(), e);
        }
    }

    /**
     * Open a PDF/document in the Supernote Document viewer. Uses the `file_path`
     * extra (a raw file:// data URI throws FileUriExposedException). The `page`
     * extra is passed but currently appears ignored by the viewer (opens last page).
     */
    @ReactMethod
    public void openDocument(String path, int page, Promise promise) {
        try {
            Intent intent = new Intent();
            intent.setComponent(new ComponentName(
                    "com.supernote.document",
                    "com.supernote.document.MainActivity"));
            intent.putExtra("file_path", path);
            if (page > 0) intent.putExtra("page", page);
            intent.setAction(Intent.ACTION_VIEW);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getReactApplicationContext().startActivity(intent);
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("OPEN_DOC_FAILED", e.getClass().getSimpleName() + ": " + e.getMessage(), e);
        }
    }

    /** Open the file manager navigated into a folder. */
    @ReactMethod
    public void openFolder(String folderPath, Promise promise) {
        try {
            Intent intent = new Intent();
            intent.setComponent(new ComponentName(
                    "com.ratta.supernote.inbox",
                    "com.ratta.supernote.explorer.FileManagerMainActivity"));
            intent.putExtra("folder_path", folderPath);
            intent.putExtra("source_type", 2);
            intent.setAction(Intent.ACTION_VIEW);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getReactApplicationContext().startActivity(intent);
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("OPEN_FOLDER_FAILED", e.getClass().getSimpleName() + ": " + e.getMessage(), e);
        }
    }

    /** Launch any activity by "package/activity" component string (Apps zone). */
    @ReactMethod
    public void launchActivity(String component, Promise promise) {
        try {
            String[] parts = component.split("/", 2);
            // Open the app exactly as the launcher does (MAIN + LAUNCHER, reset task
            // if needed): if it is already running, Android just brings its task to
            // the front. A bare MAIN intent doesn't match the running task's root
            // intent, so it was delivered as a NEW intent instead, and some apps
            // (Atelier) crash on a new intent that lacks the extras they expect.
            // (Fix from SuperHub, weedwhitesandwine's fork of SuperDashboard.)
            Intent intent = null;
            PackageManager pm = getReactApplicationContext().getPackageManager();
            Intent launch = pm.getLaunchIntentForPackage(parts[0]);
            if (launch != null && launch.getComponent() != null
                    && (parts.length < 2 || launch.getComponent().getClassName().equals(parts[1]))) {
                intent = launch;
            }
            if (intent == null) {
                intent = new Intent(Intent.ACTION_MAIN);
                intent.addCategory(Intent.CATEGORY_LAUNCHER);
                intent.setComponent(new ComponentName(parts[0], parts[1]));
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED);
            getReactApplicationContext().startActivity(intent);
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("LAUNCH_FAILED", e.getClass().getSimpleName() + ": " + e.getMessage(), e);
        }
    }

    /**
     * Five-point stars per page, read straight from the .note file, so it works
     * when the Notes app isn't open (the SDK's searchFiveStars then refuses) and
     * costs one native call instead of an SDK round-trip per note.
     * A .note is append-only: the last 4 bytes point at the current footer, whose
     * <PAGEn:addr> tags point at each current page's metadata block (4-byte LE
     * length + "<KEY:value>" tags); each star is one <FIVESTAR:...> tag there.
     * Older copies of a page (erased stars) sit in unreferenced blocks and are
     * ignored. Returns [{page (1-based), count}] for pages with at least one star.
     * (Reader from SuperHub, weedwhitesandwine's fork of SuperDashboard.)
     */
    @ReactMethod
    public void fileStars(String path, Promise promise) {
        try (java.io.RandomAccessFile f = new java.io.RandomAccessFile(path, "r")) {
            long len = f.length();
            if (len < 32) throw new Exception("too short");
            byte[] head = new byte[8];
            f.readFully(head);
            if (!new String(head, "ISO-8859-1").startsWith("note")) throw new Exception("not a note file");
            f.seek(len - 4);
            long footer = readLE32(f);
            if (footer <= 0 || footer >= len) throw new Exception("bad footer");
            f.seek(footer);
            long flen = readLE32(f);
            if (flen <= 0 || flen > 16_000_000 || footer + 4 + flen > len) throw new Exception("bad footer length");
            byte[] fb = new byte[(int) flen];
            f.readFully(fb);
            java.util.regex.Matcher m = java.util.regex.Pattern.compile("<PAGE(\\d+):(\\d+)>").matcher(new String(fb, "ISO-8859-1"));
            WritableArray out = Arguments.createArray();
            int pages = 0;
            while (m.find()) {
                pages++;
                int page = Integer.parseInt(m.group(1));
                long addr = Long.parseLong(m.group(2));
                if (addr <= 0 || addr >= len) continue;
                f.seek(addr);
                long mlen = readLE32(f);
                if (mlen <= 0 || mlen > 4_000_000 || addr + 4 + mlen > len) continue;
                byte[] mb = new byte[(int) mlen];
                f.readFully(mb);
                String meta = new String(mb, "ISO-8859-1");
                int count = 0, i = 0;
                while ((i = meta.indexOf("<FIVESTAR:", i)) >= 0) { count++; i += 10; }
                if (count > 0) {
                    WritableMap e = Arguments.createMap();
                    e.putInt("page", page);
                    e.putInt("count", count);
                    out.pushMap(e);
                }
            }
            if (pages == 0) throw new Exception("no pages in footer");
            promise.resolve(out);
        } catch (Exception e) {
            promise.reject("FILE_STARS_FAILED", e.getClass().getSimpleName() + ": " + e.getMessage(), e);
        }
    }

    private static long readLE32(java.io.RandomAccessFile f) throws java.io.IOException {
        int b0 = f.read(), b1 = f.read(), b2 = f.read(), b3 = f.read();
        if ((b0 | b1 | b2 | b3) < 0) throw new java.io.EOFException();
        return (b0 & 0xffL) | ((b1 & 0xffL) << 8) | ((b2 & 0xffL) << 16) | ((b3 & 0xffL) << 24);
    }

    /** List launchable apps as [{label, packageName, component}] for the Apps zone / config. */
    @ReactMethod
    public void listLaunchableApps(Promise promise) {
        try {
            PackageManager pm = getReactApplicationContext().getPackageManager();
            Intent launcher = new Intent(Intent.ACTION_MAIN);
            launcher.addCategory(Intent.CATEGORY_LAUNCHER);
            List<ResolveInfo> apps = pm.queryIntentActivities(launcher, 0);
            WritableArray out = Arguments.createArray();
            for (ResolveInfo ri : apps) {
                ActivityInfo ai = ri.activityInfo;
                WritableMap m = Arguments.createMap();
                CharSequence label = ai.loadLabel(pm);
                m.putString("label", label != null ? label.toString() : ai.name);
                m.putString("packageName", ai.packageName);
                m.putString("component", ai.packageName + "/" + ai.name);
                out.pushMap(m);
            }
            promise.resolve(out);
        } catch (Exception e) {
            promise.reject("LIST_APPS_FAILED", e.getClass().getSimpleName() + ": " + e.getMessage(), e);
        }
    }

    /**
     * List a directory as [{name, path, isDir, mtime}] using java.io.File.
     * More reliable than the SDK's device-wide getFileList (which crashed the
     * plugin view) and gives mtime for "most recent" sorting.
     */
    @ReactMethod
    public void listDir(String dirPath, Promise promise) {
        try {
            File dir = new File(dirPath);
            File[] children = dir.listFiles();
            WritableArray out = Arguments.createArray();
            if (children != null) {
                for (File c : children) {
                    WritableMap m = Arguments.createMap();
                    m.putString("name", c.getName());
                    m.putString("path", c.getAbsolutePath());
                    m.putBoolean("isDir", c.isDirectory());
                    m.putDouble("mtime", (double) c.lastModified());
                // Creation timestamp for the weekly NOTE activity dots. Avoid
                // confusing modification time with notebook creation time.
                try {
                    java.nio.file.attribute.BasicFileAttributes attrs =
                        java.nio.file.Files.readAttributes(c.toPath(),
                            java.nio.file.attribute.BasicFileAttributes.class);
                    long birth = attrs.creationTime().toMillis();
                    if (birth > 0 && birth <= System.currentTimeMillis() + 86400000L) {
                        m.putDouble("createdAt", (double) birth);
                    }
                } catch (Throwable ignored) {
                    // Older firmware / external storage may not expose birth time.
                }
                // Supernote's stable FILE_ID in the .note header encodes the
                // original notebook creation date: FyyyyMMddHHmmss....
                // Prefer this to Android birth time, which can change when a
                // notebook is copied or re-synced from another device.
                if (c.isFile() && c.getName().toLowerCase(java.util.Locale.US).endsWith(".note")) {
                    try (java.io.RandomAccessFile note = new java.io.RandomAccessFile(c, "r")) {
                        int count = (int) Math.min(note.length(), 8192L);
                        if (count >= 32) {
                            byte[] head = new byte[count];
                            note.readFully(head);
                            String metadata = new String(head, java.nio.charset.StandardCharsets.ISO_8859_1);
                            java.util.regex.Matcher fileId = java.util.regex.Pattern
                                .compile("<FILE_ID:F([0-9]{14})").matcher(metadata);
                            if (fileId.find()) {
                                java.text.SimpleDateFormat format = new java.text.SimpleDateFormat(
                                    "yyyyMMddHHmmss", java.util.Locale.US);
                                format.setLenient(false);
                                java.util.Date made = format.parse(fileId.group(1));
                                if (made != null && made.getTime() >= 946684800000L &&
                                    made.getTime() <= System.currentTimeMillis() + 86400000L) {
                                    m.putDouble("createdAt", (double) made.getTime());
                                }
                            }
                        }
                    } catch (Throwable ignored) {
                        // Unrecognized/older note header; retain file birth time.
                    }
                }
                    out.pushMap(m);
                }
            }
            promise.resolve(out);
        } catch (Exception e) {
            promise.reject("LISTDIR_FAILED", e.getClass().getSimpleName() + ": " + e.getMessage(), e);
        }
    }

    /**
     * Removable storage roots (SD cards), e.g. ["/storage/1C04-5DD5"]. The
     * PluginHost's view of /storage does NOT list mounted cards (verified in
     * SuperSearch), so ask Android: StorageManager volumes (API 30+) plus the
     * per-volume app dir from getExternalFilesDirs, cut at "/Android/". Primary
     * (internal, /storage/emulated/0) is excluded. Same approach as SuperSearch /
     * SmartNoteAI; plain java.io then reads the card under the FILE:READ grant.
     */
    @ReactMethod
    public void listStorageVolumes(Promise promise) {
        java.util.LinkedHashSet<String> roots = new java.util.LinkedHashSet<>();
        Context ctx = getReactApplicationContext();
        try {
            android.os.storage.StorageManager sm = (android.os.storage.StorageManager) ctx.getSystemService(Context.STORAGE_SERVICE);
            if (sm != null && Build.VERSION.SDK_INT >= 30) {
                for (android.os.storage.StorageVolume v : sm.getStorageVolumes()) {
                    if (v.isPrimary()) continue;
                    File d = v.getDirectory();
                    if (d != null) roots.add(d.getAbsolutePath());
                }
            }
        } catch (Throwable e) {
            android.util.Log.w("SuperDashboard", "storageVolumes failed", e);
        }
        try {
            File[] dirs = ctx.getExternalFilesDirs(null);
            if (dirs != null) {
                for (File f : dirs) {
                    if (f == null) continue;
                    String p = f.getAbsolutePath();
                    if (p.startsWith("/storage/emulated/")) continue;
                    int i = p.indexOf("/Android/");
                    if (i > 0) roots.add(p.substring(0, i));
                }
            }
        } catch (Throwable e) {
            android.util.Log.w("SuperDashboard", "externalFilesDirs failed", e);
        }
        WritableArray out = Arguments.createArray();
        for (String r : roots) out.pushString(r);
        promise.resolve(out);
    }

    // ---- Persistence / logging -------------------------------------------

    /** Write text to an absolute path (SDK has no writeFile). Creates parent dirs. */
    /** Write atomically: fill a temp file then rename, so a kill mid-write can't
     *  corrupt/truncate config.json or profiles.json. */
    @ReactMethod
    public void writeFile(String path, String content, Promise promise) {
        try {
            File f = new File(path);
            File parent = f.getParentFile();
            if (parent != null && !parent.exists()) parent.mkdirs();
            // Write a temp file then rename it over the target (atomic: a crash
            // mid-write can't leave a half file). The firmware forbids plugins to
            // delete files (SecurityException), and may treat a rename-over as
            // one: on ANY failure, fall back to overwriting the target directly.
            // Never call delete() here — it threw and lost the whole save.
            File tmp = new File(path + ".tmp");
            boolean done = false;
            try {
                try (java.io.FileWriter w = new java.io.FileWriter(tmp, false)) {
                    w.write(content);
                    w.flush();
                }
                done = tmp.renameTo(f);
            } catch (Exception e) {
                android.util.Log.w("SuperDashboard", "writeFile tmp+rename failed for " + path, e);
            }
            if (!done) {
                try (java.io.FileWriter w = new java.io.FileWriter(f, false)) {
                    w.write(content);
                    w.flush();
                }
            }
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("WRITE_FAILED", e.getClass().getSimpleName() + ": " + e.getMessage(), e);
        }
    }

    /** Whether an absolute path exists (used before recreating a Picture's backing PNG). */
    @ReactMethod
    public void fileExists(String path, Promise promise) {
        try {
            promise.resolve(new File(path).exists());
        } catch (Exception e) {
            promise.resolve(false);
        }
    }

    /** Copy src → dst (overwrites). Used to recreate a Picture element's backing PNG,
     *  which the note app deletes after save, before modifyElements repositions it. */
    @ReactMethod
    public void copyFile(String src, String dst, Promise promise) {
        try {
            File s = new File(src);
            if (!s.exists()) { promise.reject("COPY_FAILED", "source missing: " + src); return; }
            File d = new File(dst);
            File parent = d.getParentFile();
            if (parent != null && !parent.exists()) parent.mkdirs();
            try (java.io.FileInputStream in = new java.io.FileInputStream(s);
                 java.io.FileOutputStream out = new java.io.FileOutputStream(d, false)) {
                byte[] buf = new byte[65536];
                int n;
                while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
                out.flush();
            }
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("COPY_FAILED", e.getClass().getSimpleName() + ": " + e.getMessage(), e);
        }
    }

    /** Delete files in `dir` whose name starts with `prefix`, except `keepName`.
     *  Used to prune stale per-page handwriting PNGs (line_<hash>_p<n>_<mtime>.png). */
    @ReactMethod
    public void pruneMatching(String dir, String prefix, String keepName, Promise promise) {
        try {
            File[] kids = new File(dir).listFiles();
            int removed = 0;
            if (kids != null) {
                for (File k : kids) {
                    String n = k.getName();
                    if (n.startsWith(prefix) && !n.equals(keepName) && k.isFile()) {
                        if (safeDelete(k)) removed++;
                    }
                }
            }
            promise.resolve(removed);
        } catch (Exception e) {
            promise.reject("PRUNE_FAILED", e.getClass().getSimpleName() + ": " + e.getMessage(), e);
        }
    }

    /**
     * PluginHost keeps every past version's files (app_<ts>.npk / _libs / oat)
     * on reinstall — a plugin's footprint balloons over time. We run inside the
     * PluginHost process, so we can delete our own old versions: keep the newest
     * timestamp (the running one), drop the rest. dirPath = getPluginDirPath().
     */
    @ReactMethod
    public void cleanupOldVersions(String dirPath, Promise promise) {
        try {
            File dir = new File(dirPath);
            File[] files = dir.listFiles();
            WritableMap m = Arguments.createMap();
            if (files == null) { m.putDouble("freed", 0); m.putString("kept", "none"); promise.resolve(m); return; }
            long maxTs = -1;
            for (File f : files) {
                String n = f.getName();
                if (n.startsWith("app_") && n.endsWith(".npk")) {
                    long ts = leadingTs(n.substring(4));
                    if (ts > maxTs) maxTs = ts;
                }
            }
            if (maxTs < 0) { m.putDouble("freed", 0); m.putString("kept", "none"); promise.resolve(m); return; }
            String keep = Long.toString(maxTs);
            long freed = 0;
            // Older app_<ts>.npk and app_<ts>_libs directories
            for (File f : files) {
                String n = f.getName();
                if (n.startsWith("app_") && !n.contains(keep)) freed += deleteRecursively(f);
            }
            // Compiled artifacts in oat/ for older versions
            File oat = new File(dir, "oat");
            if (oat.isDirectory()) freed += cleanOat(oat, keep);
            m.putDouble("freed", (double) freed);
            m.putString("kept", keep);
            promise.resolve(m);
        } catch (Exception e) {
            promise.reject("CLEANUP_FAILED", e.getClass().getSimpleName() + ": " + e.getMessage(), e);
        }
    }

    /** Leading run of digits of a string → long (-1 if none). */
    private static long leadingTs(String s) {
        int i = 0;
        while (i < s.length() && Character.isDigit(s.charAt(i))) i++;
        if (i == 0) return -1;
        try { return Long.parseLong(s.substring(0, i)); } catch (Exception e) { return -1; }
    }

    /** Delete a file/dir recursively, returning the bytes reclaimed. */
    private static long deleteRecursively(File f) {
        long sum = 0;
        if (f.isDirectory()) {
            File[] kids = f.listFiles();
            if (kids != null) for (File k : kids) sum += deleteRecursively(k);
        } else {
            sum += f.length();
        }
        safeDelete(f);
        return sum;
    }

    /** delete() that never throws: the firmware's PluginSecurityManager raises a
     *  SecurityException where the plugin may not delete, which would otherwise
     *  abort a whole cleanup loop at the first refused file. */
    private static boolean safeDelete(File f) {
        try {
            return f.delete();
        } catch (Exception e) {
            return false;
        }
    }

    /** In oat/, drop compiled artifacts (app_<oldts>.odex/vdex/art) not matching keep. */
    private static long cleanOat(File oat, String keep) {
        long sum = 0;
        File[] kids = oat.listFiles();
        if (kids == null) return 0;
        for (File k : kids) {
            if (k.isDirectory()) {
                sum += cleanOat(k, keep);
            } else if (k.getName().startsWith("app_") && !k.getName().contains(keep)) {
                sum += k.length();
                safeDelete(k);
            }
        }
        return sum;
    }

    /** Read a whole text file, fresh each call (no fetch caching). Reads fully —
     *  a single read() could truncate config/profiles and corrupt the JSON. */
    @ReactMethod
    public void readTextFile(String path, Promise promise) {
        try {
            File f = new File(path);
            if (!f.exists()) {
                promise.resolve("");
                return;
            }
            byte[] all = java.nio.file.Files.readAllBytes(f.toPath());
            promise.resolve(new String(all, "UTF-8"));
        } catch (Exception e) {
            promise.reject("READ_FAILED", e.getClass().getSimpleName() + ": " + e.getMessage(), e);
        }
    }

    /** Read a byte range of a file, returning {success, fileSize, latin1}.
     *  latin1 is the raw bytes as an ISO-8859-1 string (1 char == 1 byte), so
     *  JS can read little-endian length prefixes via charCodeAt and match text
     *  markers with a regex — no base64 decoder needed on the JS side. `length`
     *  <= 0 returns just the size (a stat). Used to parse .note page IDs. */
    @ReactMethod
    public void readFileRange(String path, double offset, double length, Promise promise) {
        java.io.RandomAccessFile raf = null;
        try {
            File f = new File(path);
            if (!f.exists()) {
                WritableMap m = Arguments.createMap();
                m.putBoolean("success", false);
                promise.resolve(m);
                return;
            }
            raf = new java.io.RandomAccessFile(f, "r");
            long size = raf.length();
            WritableMap m = Arguments.createMap();
            m.putBoolean("success", true);
            m.putDouble("fileSize", (double) size);
            long off = (long) offset;
            int len = (int) length;
            if (len > 0 && off >= 0 && off < size) {
                int toRead = (int) Math.min((long) len, size - off);
                byte[] buf = new byte[toRead];
                raf.seek(off);
                raf.readFully(buf);
                m.putString("latin1", new String(buf, "ISO-8859-1"));
            }
            promise.resolve(m);
        } catch (Exception e) {
            promise.reject("RANGE_READ_FAILED", e.getClass().getSimpleName() + ": " + e.getMessage(), e);
        } finally {
            if (raf != null) {
                try {
                    raf.close();
                } catch (Exception ignored) {
                }
            }
        }
    }

    private static final String LOG_PATH = "/storage/emulated/0/MyStyle/Plugins/Dashboard/SuperDashboard_log.txt";
    private static final String LOG_OLD_PATH = "/storage/emulated/0/MyStyle/Plugins/Dashboard/SuperDashboard_log.old.txt";
    private static final long LOG_CAP = 262_144;
    // Settings → Diagnostics → Debug log. Off = logcat only, no file. Static so
    // it holds for the whole PluginHost process; JS sets it on every config load/save.
    private static volatile boolean fileLog = true;

    @ReactMethod
    public void setFileLog(boolean on, Promise promise) {
        fileLog = on;
        promise.resolve(true);
    }

    @ReactMethod
    public void appendLog(String text, Promise promise) {
        // Mirror to logcat first: it survives whatever happens to the file
        // (`adb logcat -s SuperDashboard`).
        android.util.Log.i("SuperDashboard", text);
        if (!fileLog) {
            promise.resolve(true);
            return;
        }
        try {
            File f = new File(LOG_PATH);
            File parent = f.getParentFile();
            if (parent != null && !parent.isDirectory()) parent.mkdirs();
            // Cap the debug log so it can't grow without bound. The firmware's
            // PluginSecurityManager forbids plugins to DELETE files (it throws
            // SecurityException), so any delete/rename-over in the rotation killed
            // every later append. Rotate with plain writes only: copy the full log
            // over .old (overwrite), then truncate the log in place.
            boolean fresh = false;
            if (f.length() > LOG_CAP) {
                try (java.io.FileInputStream in = new java.io.FileInputStream(f);
                     java.io.FileOutputStream out = new java.io.FileOutputStream(LOG_OLD_PATH, false)) {
                    byte[] buf = new byte[16384];
                    int n;
                    while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
                } catch (Exception e) {
                    android.util.Log.w("SuperDashboard", "log rotate copy failed", e);
                }
                fresh = true; // truncate: overwrite is allowed wherever append is
            }
            try (java.io.FileWriter w = new java.io.FileWriter(f, !fresh)) {
                w.write(text + "\n");
            }
            promise.resolve(true);
        } catch (Exception e) {
            android.util.Log.w("SuperDashboard", "appendLog failed", e);
            promise.reject("LOG_FAILED", e.getClass().getSimpleName() + ": " + e.getMessage(), e);
        }
    }

    // ---- Fonts (user .ttf/.otf from MyStyle/fonts) ------------------------

    /** List usable font files in MyStyle/fonts as [{name, path}]. */
    @ReactMethod
    public void listFonts(Promise promise) {
        try {
            File dir = new File("/storage/emulated/0/MyStyle/fonts");
            File[] kids = dir.listFiles();
            WritableArray out = Arguments.createArray();
            if (kids != null) {
                for (File f : kids) {
                    String n = f.getName().toLowerCase();
                    if (f.isFile() && (n.endsWith(".ttf") || n.endsWith(".otf"))) {
                        WritableMap m = Arguments.createMap();
                        m.putString("name", f.getName());
                        m.putString("path", f.getAbsolutePath());
                        out.pushMap(m);
                    }
                }
            }
            promise.resolve(out);
        } catch (Exception e) {
            promise.reject("LISTFONTS_FAILED", e.getClass().getSimpleName() + ": " + e.getMessage(), e);
        }
    }

    /** Register a MyStyle font file under a RN fontFamily name so {@code <Text fontFamily>}
     *  can use it. RN can't load a font from an arbitrary path directly — this bridges it. */
    @ReactMethod
    public void registerFont(String path, String family, Promise promise) {
        try {
            android.graphics.Typeface tf = android.graphics.Typeface.createFromFile(path);
            com.facebook.react.common.assets.ReactFontManager.getInstance().addCustomFont(family, tf);
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("REGFONT_FAILED", e.getClass().getSimpleName() + ": " + e.getMessage(), e);
        }
    }

    /** Register a font shipped inside the JS bundle (base64) under a RN fontFamily.
     *  Used for the bundled DSEG7 7-segment face so the plugin stays fully offline:
     *  decode → write to cacheDir → Typeface.createFromFile → addCustomFont. */
    @ReactMethod
    public void registerFontBase64(String base64, String family, Promise promise) {
        try {
            java.io.File out = new java.io.File(getReactApplicationContext().getCacheDir(), "font_" + family + ".ttf");
            // Decode + write only once; a later process load reuses the cached .ttf
            // (registration itself is per-process, but the 31 KB decode/write is not
            // repeated). try-with-resources closes the stream even if write() throws.
            if (!out.exists() || out.length() == 0) {
                byte[] bytes = android.util.Base64.decode(base64, android.util.Base64.DEFAULT);
                try (java.io.FileOutputStream fos = new java.io.FileOutputStream(out)) {
                    fos.write(bytes);
                }
            }
            android.graphics.Typeface tf = android.graphics.Typeface.createFromFile(out);
            com.facebook.react.common.assets.ReactFontManager.getInstance().addCustomFont(family, tf);
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("REGFONT64_FAILED", e.getClass().getSimpleName() + ": " + e.getMessage(), e);
        }
    }

    // ---- Device status (battery / storage / info) ------------------------

    /** Battery {level: 0-100 (or -1), charging: bool} via the sticky battery intent. */
    @ReactMethod
    public void getBattery(Promise promise) {
        try {
            Intent b = getReactApplicationContext().registerReceiver(null, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
            WritableMap m = Arguments.createMap();
            if (b == null) {
                m.putInt("level", -1);
                m.putBoolean("charging", false);
                promise.resolve(m);
                return;
            }
            int level = b.getIntExtra(BatteryManager.EXTRA_LEVEL, -1);
            int scale = b.getIntExtra(BatteryManager.EXTRA_SCALE, -1);
            int status = b.getIntExtra(BatteryManager.EXTRA_STATUS, -1);
            m.putInt("level", (scale > 0 && level >= 0) ? Math.round(level * 100f / scale) : -1);
            m.putBoolean("charging", status == BatteryManager.BATTERY_STATUS_CHARGING || status == BatteryManager.BATTERY_STATUS_FULL);
            promise.resolve(m);
        } catch (Exception e) {
            promise.reject("BATTERY_FAILED", e.getClass().getSimpleName() + ": " + e.getMessage(), e);
        }
    }

    /** Free/total bytes for internal shared storage, and the SD card if present. */
    @ReactMethod
    public void getStorage(Promise promise) {
        try {
            WritableMap m = Arguments.createMap();
            StatFs in = new StatFs(Environment.getExternalStorageDirectory().getAbsolutePath());
            m.putDouble("internalFree", (double) in.getAvailableBytes());
            m.putDouble("internalTotal", (double) in.getTotalBytes());
            boolean hasSd = false;
            // The 2nd app-specific external dir, when present, lives on removable media.
            File[] ext = getReactApplicationContext().getExternalFilesDirs(null);
            if (ext != null && ext.length > 1 && ext[1] != null) {
                try {
                    StatFs sd = new StatFs(ext[1].getAbsolutePath());
                    m.putDouble("sdFree", (double) sd.getAvailableBytes());
                    m.putDouble("sdTotal", (double) sd.getTotalBytes());
                    hasSd = true;
                } catch (Exception ignored) {}
            }
            m.putBoolean("hasSd", hasSd);
            promise.resolve(m);
        } catch (Exception e) {
            promise.reject("STORAGE_FAILED", e.getClass().getSimpleName() + ": " + e.getMessage(), e);
        }
    }


    // Native Supernote To-do login session lives in Android Keystore-encrypted
    // private app storage. Passwords and email verification codes never persist.
    private static final String TODO_KEY_ALIAS = "MySuperPrettyDashboard.Supernote.ToDo.v1";
    private static final String TODO_PREFS = "MySuperPrettyDashboard.Private";
    private static final String TODO_TOKEN = "cloudtodo-token";
    private static final String BUBBLE_PREFS = "MySuperPrettyDashboard.Bubble";
    private String preferredBubbleSpot = "middle-right";

    private javax.crypto.SecretKey todoSecretKey() throws Exception {
        java.security.KeyStore ks = java.security.KeyStore.getInstance("AndroidKeyStore");
        ks.load(null);
        java.security.KeyStore.Entry existing = ks.getEntry(TODO_KEY_ALIAS, null);
        if (existing instanceof java.security.KeyStore.SecretKeyEntry) {
            return ((java.security.KeyStore.SecretKeyEntry) existing).getSecretKey();
        }
        javax.crypto.KeyGenerator gen = javax.crypto.KeyGenerator.getInstance(
            android.security.keystore.KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        gen.init(new android.security.keystore.KeyGenParameterSpec.Builder(
                TODO_KEY_ALIAS,
                android.security.keystore.KeyProperties.PURPOSE_ENCRYPT |
                android.security.keystore.KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(android.security.keystore.KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(android.security.keystore.KeyProperties.ENCRYPTION_PADDING_NONE)
                .setRandomizedEncryptionRequired(true)
                .build());
        return gen.generateKey();
    }


    // The calendar feed URL may function as a bearer capability. Never embed
    // it in a public source repository or save it to shared MyStyle storage.
    // Store it encrypted with a device-only Android Keystore key instead.
    private static final String CALENDAR_SOURCE_KEY = "pretty-calendar-source-url";
    @ReactMethod
    public void secureSaveCalendarUrl(String value, Promise promise) {
        try {
            String url = value == null ? "" : value.trim();
            if (!url.matches("(?i)^https://[a-z0-9-]+(\\.[a-z0-9-]+)*\\.workers\\.dev/calendar/?$")) {
                throw new IllegalArgumentException("Expected an HTTPS Cloudflare Worker /calendar URL");
            }
            javax.crypto.Cipher cipher = javax.crypto.Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(javax.crypto.Cipher.ENCRYPT_MODE, todoSecretKey());
            byte[] encrypted = cipher.doFinal(url.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            String stored = android.util.Base64.encodeToString(cipher.getIV(), android.util.Base64.NO_WRAP)
                + "." + android.util.Base64.encodeToString(encrypted, android.util.Base64.NO_WRAP);
            if (!getReactApplicationContext().getSharedPreferences(TODO_PREFS, Context.MODE_PRIVATE)
                    .edit().putString(CALENDAR_SOURCE_KEY, stored).commit()) {
                throw new IllegalStateException("Encrypted calendar source was not saved");
            }
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("CALENDAR_SOURCE_SAVE_FAILED", "Unable to store calendar feed URL", e);
        }
    }

    @ReactMethod
    public void secureLoadCalendarUrl(Promise promise) {
        try {
            String value = getReactApplicationContext()
                .getSharedPreferences(TODO_PREFS, Context.MODE_PRIVATE)
                .getString(CALENDAR_SOURCE_KEY, "");
            if (value == null || value.isEmpty()) { promise.resolve(""); return; }
            String[] parts = value.split("\\.",2);
            if (parts.length!=2) throw new IllegalStateException("Encrypted source is malformed");
            javax.crypto.Cipher cipher = javax.crypto.Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(javax.crypto.Cipher.DECRYPT_MODE,todoSecretKey(),
                new javax.crypto.spec.GCMParameterSpec(128,
                  android.util.Base64.decode(parts[0],android.util.Base64.DEFAULT)));
            byte[] decoded=cipher.doFinal(android.util.Base64.decode(parts[1],android.util.Base64.DEFAULT));
            promise.resolve(new String(decoded,java.nio.charset.StandardCharsets.UTF_8));
        } catch (Exception e) {
            promise.reject("CALENDAR_SOURCE_READ_FAILED",
                "Cannot read calendar source; re-enter the URL in dashboard Settings",e);
        }
    }

    /** Position of the house bubble outside the plugin view, user-selectable. */
    @ReactMethod
    public void setBubblePosition(String place, Promise promise) {
        try {
            if (!place.matches("^(top|middle|bottom)-(left|right)$")) {
                throw new IllegalArgumentException("Invalid placement");
            }
            preferredBubbleSpot = place;
            getReactApplicationContext().getSharedPreferences(BUBBLE_PREFS, Context.MODE_PRIVATE)
                .edit().putString("spot", place).apply();
            // Clear the last dragged location so the next show uses the preset.
            lastX = -1;
            lastY = -1;
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("BUBBLE_POSITION", "Unable to change bubble position", e);
        }
    }

    @ReactMethod
    public void secureSaveTodoToken(String token, Promise promise) {
        try {
            if (token == null || token.trim().isEmpty()) throw new IllegalArgumentException("Empty session");
            javax.crypto.Cipher cipher = javax.crypto.Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(javax.crypto.Cipher.ENCRYPT_MODE, todoSecretKey());
            byte[] encrypted = cipher.doFinal(token.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            byte[] iv = cipher.getIV();
            String value = android.util.Base64.encodeToString(iv, android.util.Base64.NO_WRAP)
                    + "." + android.util.Base64.encodeToString(encrypted, android.util.Base64.NO_WRAP);
            boolean ok = getReactApplicationContext()
                    .getSharedPreferences(TODO_PREFS, Context.MODE_PRIVATE)
                    .edit().putString(TODO_TOKEN, value).commit();
            if (!ok) throw new IllegalStateException("Unable to persist session");
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("TODO_SESSION_SAVE_FAILED", "Unable to store encrypted Supernote session", e);
        }
    }

    @ReactMethod
    public void secureLoadTodoToken(Promise promise) {
        try {
            String value = getReactApplicationContext()
                    .getSharedPreferences(TODO_PREFS, Context.MODE_PRIVATE)
                    .getString(TODO_TOKEN, "");
            if (value == null || value.isEmpty()) {promise.resolve("");return;}
            String[] pieces = value.split("\\.", 2);
            if (pieces.length != 2) throw new IllegalStateException("Invalid stored session");
            javax.crypto.Cipher cipher = javax.crypto.Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(javax.crypto.Cipher.DECRYPT_MODE, todoSecretKey(),
                    new javax.crypto.spec.GCMParameterSpec(128,
                        android.util.Base64.decode(pieces[0], android.util.Base64.DEFAULT)));
            byte[] plain = cipher.doFinal(android.util.Base64.decode(pieces[1], android.util.Base64.DEFAULT));
            promise.resolve(new String(plain, java.nio.charset.StandardCharsets.UTF_8));
        } catch (Exception e) {
            promise.reject("TODO_SESSION_READ_FAILED", "Unable to read saved Supernote session; reconnect in Settings", e);
        }
    }

    @ReactMethod
    public void secureClearTodoToken(Promise promise) {
        try {
            getReactApplicationContext().getSharedPreferences(TODO_PREFS, Context.MODE_PRIVATE)
                    .edit().remove(TODO_TOKEN).apply();
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("TODO_SESSION_CLEAR_FAILED", "Could not clear Supernote session", e);
        }
    }

    @ReactMethod
    public void hashHex(String algorithm, String text, Promise promise) {
        try {
            if (!"MD5".equals(algorithm) && !"SHA-256".equals(algorithm)) {
                throw new IllegalArgumentException("Unsupported hash");
            }
            byte[] dig = java.security.MessageDigest.getInstance(algorithm).digest(
                    text.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            StringBuilder out = new StringBuilder(dig.length * 2);
            for (byte b : dig) out.append(String.format(java.util.Locale.ROOT, "%02x", b & 0xff));
            promise.resolve(out.toString());
        } catch (Exception e) {
            promise.reject("TODO_SIGNIN_HASH_FAILED", "Unable to hash sign-in challenge", e);
        }
    }

    // ---- Overlay bubble ---------------------------------------------------

    /**
     * Show the floating bubble: the SuperDashboard house in a rounded white chip with
     * a black outline (like SuperStickyNote's bubble). Icon‑only — no label/hint text.
     */
    @ReactMethod
    public void showBubble(Promise promise) {
        main.post(() -> {
            try {
                Context ctx = getReactApplicationContext();
                if (Build.VERSION.SDK_INT >= 23 && !Settings.canDrawOverlays(ctx)) {
                    promise.reject("NO_PERMISSION", "overlay permission not granted");
                    return;
                }
                // Remove our tracked view AND any orphaned bubbles left in the
                // (persistent PluginHost) process by a previous classloader.
                removeOverlayInternal();
                clearTaggedBubbles();
                wm = (WindowManager) ctx.getSystemService(Context.WINDOW_SERVICE);

                // The bubble is just the SuperDashboard house, DRAWN on a Canvas (loading
                // R.drawable inside the persistent plugin host renders unreliably — an ugly
                // black bar, the same issue SuperStickyNote hit). It sits in a rounded white
                // chip with a black outline, matching SuperStickyNote's bubble.
                // Size the house in SP (like the old ⊕ glyph did) so it tracks the device's
                // font-size setting — that's why the old bubble felt "adaptive" — and keep
                // it small: the previous dp(34) icon + dp(12) padding + dp(3) border read as
                // ~1cm on a 300dpi Manta/Nomad. ~24sp + dp(8) padding + dp(2) border ≈ 6–7mm.
                int glyphSize = (int) TypedValue.applyDimension(
                        TypedValue.COMPLEX_UNIT_SP, 24, ctx.getResources().getDisplayMetrics());
                ImageView panel = new ImageView(ctx);
                panel.setTag(BUBBLE_TAG);
                panel.setImageBitmap(makeHouseIcon(glyphSize));
                panel.setScaleType(ImageView.ScaleType.CENTER);
                panel.setPadding(dp(8), dp(8), dp(8), dp(8));
                panel.setBackground(roundedBg(Color.WHITE, Color.BLACK, dp(16), dp(2)));

                int type = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                        ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                        : WindowManager.LayoutParams.TYPE_PHONE;
                overlayParams = new WindowManager.LayoutParams(
                        WindowManager.LayoutParams.WRAP_CONTENT,
                        WindowManager.LayoutParams.WRAP_CONTENT,
                        type,
                        WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                                | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
                        // TRANSLUCENT (not OPAQUE): the bubble is a ROUNDED chip, so the view's
                        // square corners are transparent. On an OPAQUE overlay some e-ink
                        // compositors (reported on Manta) fill those transparent corners with
                        // BLACK — the bubble then looks like a black square. TRANSLUCENT keeps
                        // the window's alpha so the corners show the note behind, as intended.
                        PixelFormat.TRANSLUCENT);
                // Coordinates are top-left origin (matches the drag handler).
                // First placement (no dragged position yet) → top-right corner;
                // x needs the laid-out width, so it's set in a post() below.
                preferredBubbleSpot = ctx.getSharedPreferences(BUBBLE_PREFS, Context.MODE_PRIVATE)
                    .getString("spot", "middle-right");
                final boolean firstPlacement = lastX < 0;
                overlayParams.gravity = Gravity.TOP | Gravity.START;
                overlayParams.x = lastX >= 0 ? lastX : dp(40); // provisional; fixed on first layout
                overlayParams.y = lastY >= 0 ? lastY : dp(40);

                // No long-press: a tap opens the dashboard, a drag moves the bubble.
                // (Long-press-to-delete fired on slow e-ink taps → the bubble vanished.
                //  The bubble is turned off from Settings → Look instead.)
                panel.setOnTouchListener((v, ev) -> {
                    switch (ev.getAction()) {
                        case MotionEvent.ACTION_DOWN:
                            startX = overlayParams.x; startY = overlayParams.y;
                            startRawX = ev.getRawX(); startRawY = ev.getRawY();
                            dragging = false;
                            return true;
                        case MotionEvent.ACTION_MOVE: {
                            float dx = ev.getRawX() - startRawX, dy = ev.getRawY() - startRawY;
                            if (!dragging && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) dragging = true;
                            if (dragging) {
                                int vw = v.getWidth(), vh = v.getHeight();
                                int maxX = Math.max(0, screenW() - vw);
                                int maxY = Math.max(0, screenH() - vh);
                                overlayParams.x = clamp(startX + (int) dx, 0, maxX);
                                overlayParams.y = clamp(startY + (int) dy, 0, maxY);
                                lastX = overlayParams.x; lastY = overlayParams.y;
                                try { wm.updateViewLayout(overlayView, overlayParams); } catch (Exception ignored) {}
                            }
                            return true;
                        }
                        case MotionEvent.ACTION_UP:
                            if (!dragging) emit("onBubbleTap", Arguments.createMap());
                            return true;
                        default:
                            return false;
                    }
                });

                overlayView = panel;
                wm.addView(overlayView, overlayParams);
                if (firstPlacement) {
                    // Snap to the top-right once the bubble's width is known.
                    panel.post(() -> {
                        try {
                            boolean left = preferredBubbleSpot.endsWith("-left");
                            int x = left ? dp(18) : Math.max(0, screenW() - panel.getWidth() - dp(18));
                            int y;
                            if (preferredBubbleSpot.startsWith("top")) y = dp(65);
                            else if (preferredBubbleSpot.startsWith("bottom"))
                                y = Math.max(0, screenH() - panel.getHeight() - dp(120));
                            else y = Math.max(0, (screenH() - panel.getHeight()) / 2);
                            overlayParams.x = x;
                            overlayParams.y = y;
                            lastX = x;
                            lastY = y;
                            wm.updateViewLayout(panel, overlayParams);
                        } catch (Exception ignored) {}
                    });
                }
                promise.resolve(true);
            } catch (Exception e) {
                promise.reject("SHOW_BUBBLE_FAILED", e.getClass().getSimpleName() + ": " + e.getMessage(), e);
            }
        });
    }

    @ReactMethod
    public void hideBubble(Promise promise) {
        main.post(() -> {
            removeOverlayInternal();
            promise.resolve(true);
        });
    }

    private void removeOverlayInternal() {
        if (overlayView != null && wm != null) {
            try { wm.removeView(overlayView); } catch (Exception ignored) {}
        }
        overlayView = null;
        overlayParams = null;
    }

    /**
     * Remove every bubble view in this process, even orphans from a previous
     * plugin classloader (PluginHost persists across reload/reinstall, so a
     * stale bubble can't be reached via our static reference). We reflect into
     * WindowManagerGlobal — process-wide — and drop any view tagged BUBBLE_TAG.
     */
    @ReactMethod
    public void clearAllBubbles(Promise promise) {
        main.post(() -> {
            int n = clearTaggedBubbles();
            if (promise != null) promise.resolve(n);
        });
    }

    @SuppressWarnings("unchecked")
    private int clearTaggedBubbles() {
        int removed = 0;
        try {
            Class<?> wmg = Class.forName("android.view.WindowManagerGlobal");
            Object inst = wmg.getMethod("getInstance").invoke(null);
            java.lang.reflect.Field f = wmg.getDeclaredField("mViews");
            f.setAccessible(true);
            java.util.List<View> views = (java.util.List<View>) f.get(inst);
            WindowManager w = (WindowManager) getReactApplicationContext()
                    .getSystemService(Context.WINDOW_SERVICE);
            for (View v : new java.util.ArrayList<>(views)) {
                if (v != null && BUBBLE_TAG.equals(v.getTag())) {
                    try { w.removeViewImmediate(v); removed++; } catch (Exception ignored) {}
                }
            }
        } catch (Throwable ignored) {
            // Reflection unavailable → fall back to the tracked reference only.
        }
        if (removed > 0) {
            overlayView = null;
            overlayParams = null;
        }
        return removed;
    }

    private int screenW() {
        return getReactApplicationContext().getResources().getDisplayMetrics().widthPixels;
    }

    private int screenH() {
        return getReactApplicationContext().getResources().getDisplayMetrics().heightPixels;
    }

    private int clamp(int v, int lo, int hi) {
        return Math.max(lo, Math.min(hi, v));
    }

    private int dp(int v) {
        float d = getReactApplicationContext().getResources().getDisplayMetrics().density;
        return (int) (v * d);
    }

    /** A rounded chip background: solid fill + outline (used for the bubble). */
    private GradientDrawable roundedBg(int fill, int stroke, int radius, int strokeW) {
        GradientDrawable g = new GradientDrawable();
        g.setColor(fill);
        g.setCornerRadius(radius);
        g.setStroke(strokeW, stroke);
        return g;
    }

    /**
     * Draw the SuperDashboard house (24×24 viewBox) as a stroked bitmap — the bubble
     * face and a match for the plugin icon. Drawn in code because loading R.drawable
     * inside the plugin host renders unreliably. Round cap/join keeps the line-art
     * clean at small sizes on e-ink.
     */
    private Bitmap makeHouseIcon(int size) {
        Bitmap bmp = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        Canvas cv = new Canvas(bmp);
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        p.setColor(Color.BLACK);
        p.setStyle(Paint.Style.STROKE);
        p.setStrokeWidth(size * 2f / 24f);
        p.setStrokeCap(Paint.Cap.ROUND);
        p.setStrokeJoin(Paint.Join.ROUND);
        float s = size / 24f; // 24×24 viewBox
        // Outline: left eave → apex → right eave → down the right wall → floor → close up the left wall.
        Path house = new Path();
        house.moveTo(4 * s, 9.5f * s);
        house.lineTo(12 * s, 2.5f * s);
        house.lineTo(20 * s, 9.5f * s);
        house.lineTo(20 * s, 20 * s);
        house.lineTo(4 * s, 20 * s);
        house.close();
        // Door, open at the floor line.
        Path door = new Path();
        door.moveTo(9.5f * s, 20 * s);
        door.lineTo(9.5f * s, 13.5f * s);
        door.lineTo(14.5f * s, 13.5f * s);
        door.lineTo(14.5f * s, 20 * s);
        cv.drawPath(house, p);
        cv.drawPath(door, p);
        return bmp;
    }
}
