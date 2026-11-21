import Cocoa
import WebKit

final class AppDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate, WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate {
    var window: NSWindow!
    var web: WKWebView!
    var backend: Process?
    var output = ""
    var localOrigin: String?
    var closing = false
    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)
        let menu = NSMenu()
        let appItem = NSMenuItem(); menu.addItem(appItem)
        let appMenu = NSMenu(); appItem.submenu = appMenu
        appMenu.addItem(withTitle: "退出 MoveMate", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        let editItem = NSMenuItem(); menu.addItem(editItem)
        let edit = NSMenu(title: "编辑"); editItem.submenu = edit
        for (title, action, key) in [("撤销", "undo:", "z"), ("剪切", "cut:", "x"), ("复制", "copy:", "c"), ("粘贴", "paste:", "v"), ("全选", "selectAll:", "a")] {
            edit.addItem(withTitle: title, action: Selector(action), keyEquivalent: key)
        }
        NSApp.mainMenu = menu
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1240, height: 850), styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
        window.title = "MoveMate 跃动"
        window.minSize = NSSize(width: 820, height: 640)
        window.isReleasedWhenClosed = false
        window.delegate = self
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = self; web.uiDelegate = self
        window.contentView = web
        web.loadHTMLString("<html><meta charset='utf-8'><body style='background:#f7f8f4;color:#244a3b;font:20px -apple-system;padding:80px'><h1>MoveMate 跃动</h1><p>正在启动本机服务并检查数据库…</p></body></html>", baseURL: nil)
        window.center(); window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        startBackend()
    }
    func startBackend() {
        guard let root = Bundle.main.resourceURL else { fail("应用资源缺失，请重新完整解压。"); return }
        #if arch(arm64)
        let relative = "runtime/mac-arm64/python/bin/python3"
        #else
        let relative = "runtime/mac-x64/python/bin/python3"
        #endif
        let process = Process(); self.backend = process
        process.executableURL = root.appendingPathComponent(relative)
        process.arguments = ["-B", root.appendingPathComponent("serve.py").path, "--no-browser"]
        process.currentDirectoryURL = root
        var env = ProcessInfo.processInfo.environment
        env["SSL_CERT_FILE"] = root.appendingPathComponent("certs/cacert.pem").path
        env["PYTHONUNBUFFERED"] = "1"
        env["PYTHONDONTWRITEBYTECODE"] = "1"
        process.environment = env
        let pipe = Pipe(); process.standardOutput = pipe; process.standardError = pipe
        pipe.fileHandleForReading.readabilityHandler = { [weak self] handle in
            let data = handle.availableData
            guard !data.isEmpty, let text = String(data: data, encoding: .utf8) else { return }
            DispatchQueue.main.async {
                guard let self = self else { return }
                self.output += text
                if self.localOrigin == nil, let range = self.output.range(of: "http://127\\.0\\.0\\.1:[0-9]+", options: .regularExpression) {
                    let address = String(self.output[range]); self.localOrigin = address
                    self.web.load(URLRequest(url: URL(string: address)!))
                }
            }
        }
        process.terminationHandler = { [weak self] _ in
            DispatchQueue.main.async {
                guard let self = self, !self.closing else { return }
                self.fail("本机服务已停止，请退出后重新打开应用。")
            }
        }
        do { try process.run() } catch { fail("启动失败：\(error.localizedDescription)") }
    }
    func fail(_ message: String) {
        let alert = NSAlert(); alert.messageText = "MoveMate 启动检查"; alert.informativeText = message
        alert.addButton(withTitle: "退出"); alert.runModal(); NSApp.terminate(nil)
    }
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { decisionHandler(.cancel); return }
        if navigationAction.shouldPerformDownload { decisionHandler(.download); return }
        if url.scheme == "blob" || url.absoluteString == "about:blank" || (localOrigin != nil && url.absoluteString.hasPrefix(localOrigin! + "/")) || url.absoluteString == localOrigin {
            decisionHandler(.allow)
        } else {
            if ["https", "http"].contains(url.scheme ?? "") { NSWorkspace.shared.open(url) }
            decisionHandler(.cancel)
        }
    }
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = navigationAction.request.url, ["https", "http"].contains(url.scheme ?? "") { NSWorkspace.shared.open(url) }
        return nil
    }
    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) { download.delegate = self }
    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse, suggestedFilename: String, completionHandler: @escaping (URL?) -> Void) {
        let panel = NSSavePanel(); panel.nameFieldStringValue = suggestedFilename
        panel.beginSheetModal(for: window) { result in completionHandler(result == .OK ? panel.url : nil) }
    }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
    func applicationWillTerminate(_ notification: Notification) { closing = true; if backend?.isRunning == true { backend?.terminate() } }
}
let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.run()
