import Capacitor
import UIKit
import UniformTypeIdentifiers

/// Registers the app's own plugin (local plugins aren't discovered automatically).
class MainViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(SafFoldersPlugin())
    }
}

/**
 * iOS twin of android/.../SafFoldersPlugin.java, with the same JS API (src/androidBridge.ts).
 * The user picks a folder once in the Files picker (the SD card in a USB-C or Lightning
 * reader, or an export folder); a security-scoped bookmark keeps the access, so the
 * card is recognised again when it's plugged back in. The "uri" handed to JS is the
 * bookmark's id, so only folders the user picked can be read or written.
 *
 * Paths are lists of folder names matched case-insensitively (FAT/exFAT cards may use
 * any case). The NIKON/CUSTOMPC rules themselves live in the web code.
 */
@objc(SafFoldersPlugin)
public class SafFoldersPlugin: CAPPlugin, CAPBridgedPlugin, UIDocumentPickerDelegate {
    public let identifier = "SafFoldersPlugin"
    public let jsName = "SafFolders"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "pick", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "list", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "forget", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "children", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "readFile", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "writeFile", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "deleteFile", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "saveFile", returnType: CAPPluginReturnPromise),
    ]

    private static let maxFileBytes = 1024 * 1024
    private let kinds = ["card", "export"]

    /// The call waiting on the document picker, and whether it is a folder pick or a "save as".
    private var pendingCall: CAPPluginCall?
    private var pendingSave: URL?

    public override func load() {
        // A card may have been inserted or removed while the app was in the background.
        NotificationCenter.default.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main) { [weak self] _ in
            self?.notifyListeners("foldersChanged", data: [:])
        }
    }

    // MARK: Saved folders (id → bookmark)

    private func saved(_ kind: String) -> [String: Data] {
        UserDefaults.standard.dictionary(forKey: "saf-folders.\(kind)") as? [String: Data] ?? [:]
    }

    private func save(_ kind: String, _ folders: [String: Data]) {
        UserDefaults.standard.set(folders, forKey: "saf-folders.\(kind)")
    }

    private func bookmark(_ id: String) -> (kind: String, data: Data)? {
        for kind in kinds { if let data = saved(kind)[id] { return (kind, data) } }
        return nil
    }

    /// Resolve a saved folder and run `body` with access to it.
    private func withFolder<T>(_ id: String?, _ body: (URL) throws -> T) throws -> T {
        guard let id else { throw PluginError("missing-uri") }
        guard let (kind, data) = bookmark(id) else { throw PluginError("folder-not-allowed") }
        var stale = false
        guard let url = try? URL(resolvingBookmarkData: data, bookmarkDataIsStale: &stale) else { throw PluginError("card-not-found") }
        let scoped = url.startAccessingSecurityScopedResource()
        defer { if scoped { url.stopAccessingSecurityScopedResource() } }
        if stale, let fresh = try? url.bookmarkData() {
            var folders = saved(kind)
            folders[id] = fresh
            save(kind, folders)
        }
        var isDir: ObjCBool = false
        guard FileManager.default.fileExists(atPath: url.path, isDirectory: &isDir), isDir.boolValue else { throw PluginError("card-not-found") }
        return try body(url)
    }

    /// id, display name, whether it's reachable now (card inserted), free space.
    private func describe(_ id: String, _ url: URL) -> [String: Any] {
        let values = try? url.resourceValues(forKeys: [.volumeNameKey, .volumeAvailableCapacityKey])
        var d: [String: Any] = [
            "uri": id,
            "folderName": url.lastPathComponent,
            "volumeName": values?.volumeName ?? "",
            "available": true,
        ]
        if let free = values?.volumeAvailableCapacity { d["freeBytes"] = free }
        return d
    }

    @objc func pick(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.folder])
            self.present(picker, for: call, saving: nil)
        }
    }

    /// "Save as" for one file (NP3, ZIP, backup JSON): WKWebView ignores <a download>. Resolves { saved }.
    @objc func saveFile(_ call: CAPPluginCall) {
        guard let name = call.getString("name"), let data = call.getString("data").flatMap({ Data(base64Encoded: $0) }),
              !name.isEmpty, !name.contains("/") else {
            call.reject("missing-file")
            return
        }
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
        let file = dir.appendingPathComponent(name)
        do {
            try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
            try data.write(to: file)
        } catch {
            call.reject("cannot-write")
            return
        }
        DispatchQueue.main.async {
            let picker = UIDocumentPickerViewController(forExporting: [file], asCopy: true)
            self.present(picker, for: call, saving: dir)
        }
    }

    private func present(_ picker: UIDocumentPickerViewController, for call: CAPPluginCall, saving: URL?) {
        if let previous = pendingCall { previous.reject("busy") }
        pendingCall = call
        pendingSave = saving
        picker.delegate = self
        bridge?.viewController?.present(picker, animated: true)
    }

    public func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        guard let call = pendingCall else { return }
        pendingCall = nil
        if let saving = pendingSave {
            try? FileManager.default.removeItem(at: saving)
            call.resolve(["saved": true])
            return
        }
        guard let url = urls.first else {
            call.resolve([:])
            return
        }
        let scoped = url.startAccessingSecurityScopedResource()
        defer { if scoped { url.stopAccessingSecurityScopedResource() } }
        guard let data = try? url.bookmarkData() else {
            call.reject("permission-denied")
            return
        }
        let kind = call.getString("kind") ?? "card"
        var folders = saved(kind)
        // Picking the same folder again reuses its id.
        let id = folders.first { _, b in
            var stale = false
            return (try? URL(resolvingBookmarkData: b, bookmarkDataIsStale: &stale))?.standardizedFileURL == url.standardizedFileURL
        }?.key ?? UUID().uuidString
        folders[id] = data
        save(kind, folders)
        call.resolve(describe(id, url))
    }

    public func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        guard let call = pendingCall else { return }
        pendingCall = nil
        if let saving = pendingSave {
            try? FileManager.default.removeItem(at: saving)
            call.resolve(["saved": false])
        } else {
            call.resolve([:]) // cancelled: no uri
        }
    }

    @objc func list(_ call: CAPPluginCall) {
        let kind = call.getString("kind") ?? "card"
        var out: [[String: Any]] = []
        for id in saved(kind).keys.sorted() {
            if let d = try? withFolder(id, { describe(id, $0) }) { out.append(d) }
        }
        call.resolve(["folders": out])
    }

    @objc func forget(_ call: CAPPluginCall) {
        guard let id = call.getString("uri") else {
            call.reject("missing-uri")
            return
        }
        for kind in kinds {
            var folders = saved(kind)
            if folders.removeValue(forKey: id) != nil { save(kind, folders) }
        }
        call.resolve()
    }

    // MARK: Files

    private static func safeName(_ name: String?) throws -> String {
        guard let name, !name.isEmpty, name != ".", name != "..", !name.contains("/"), !name.contains("\\") else {
            throw PluginError("invalid-name")
        }
        return name
    }

    private static func entries(_ dir: URL) throws -> [URL] {
        try FileManager.default.contentsOfDirectory(at: dir, includingPropertiesForKeys: [.isDirectoryKey, .fileSizeKey])
    }

    private static func isDir(_ url: URL) -> Bool {
        (try? url.resourceValues(forKeys: [.isDirectoryKey]))?.isDirectory == true
    }

    private static func childNamed(_ dir: URL, _ name: String) throws -> URL? {
        try entries(dir).first { $0.lastPathComponent.caseInsensitiveCompare(name) == .orderedSame }
    }

    /// Walk `path` from the root; creates missing folders when `create`, else returns nil.
    private static func folder(_ root: URL, _ call: CAPPluginCall, create: Bool) throws -> URL? {
        var dir = root
        for raw in call.getArray("path", String.self) ?? [] {
            let seg = try safeName(raw)
            if let next = try childNamed(dir, seg) {
                guard isDir(next) else { throw PluginError("not-a-folder:\(seg)") }
                dir = next
            } else {
                guard create else { return nil }
                dir = dir.appendingPathComponent(seg, isDirectory: true)
                do { try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: false) } catch { throw PluginError("cannot-create-folder:\(seg)") }
            }
        }
        return dir
    }

    private func run(_ call: CAPPluginCall, _ body: (URL) throws -> [String: Any]?) {
        do {
            let ret = try withFolder(call.getString("uri"), body)
            call.resolve(ret ?? [:])
        } catch {
            call.reject((error as? PluginError)?.message ?? error.localizedDescription)
        }
    }

    @objc func children(_ call: CAPPluginCall) {
        run(call) { root in
            guard let dir = try Self.folder(root, call, create: false) else { return ["exists": false, "entries": []] }
            let entries: [[String: Any]] = try Self.entries(dir).map { url in
                let v = try? url.resourceValues(forKeys: [.isDirectoryKey, .fileSizeKey])
                return ["name": url.lastPathComponent, "isDir": v?.isDirectory == true, "size": v?.fileSize ?? 0]
            }
            return ["exists": true, "entries": entries]
        }
    }

    @objc func readFile(_ call: CAPPluginCall) {
        run(call) { root in
            let name = try Self.safeName(call.getString("name"))
            guard let dir = try Self.folder(root, call, create: false), let f = try Self.childNamed(dir, name), !Self.isDir(f) else {
                throw PluginError("not-found")
            }
            if ((try? f.resourceValues(forKeys: [.fileSizeKey]))?.fileSize ?? 0) > Self.maxFileBytes { throw PluginError("too-large") }
            guard let data = try? Data(contentsOf: f) else { throw PluginError("cannot-read") }
            return ["data": data.base64EncodedString()]
        }
    }

    /// Write one file; fails with "exists:<name>" unless `overwrite` is set.
    @objc func writeFile(_ call: CAPPluginCall) {
        run(call) { root in
            let name = try Self.safeName(call.getString("name"))
            guard let data = Data(base64Encoded: call.getString("data") ?? "") else { throw PluginError("invalid-data") }
            if data.count > Self.maxFileBytes { throw PluginError("too-large") }
            guard let dir = try Self.folder(root, call, create: true) else { throw PluginError("not-found") }
            let existing = try Self.childNamed(dir, name)
            if existing != nil && !(call.getBool("overwrite") ?? false) { throw PluginError("exists:\(name)") }
            // Keep the existing file's spelling; write in place (no temp file) so the card keeps one directory entry.
            do { try data.write(to: existing ?? dir.appendingPathComponent(name)) } catch { throw PluginError("cannot-write:\(name)") }
            return nil
        }
    }

    @objc func deleteFile(_ call: CAPPluginCall) {
        run(call) { root in
            let name = try Self.safeName(call.getString("name"))
            guard let dir = try Self.folder(root, call, create: false), let f = try Self.childNamed(dir, name) else { throw PluginError("not-found") }
            do { try FileManager.default.removeItem(at: f) } catch { throw PluginError("cannot-delete") }
            return nil
        }
    }
}

struct PluginError: Error {
    let message: String
    init(_ message: String) { self.message = message }
}
