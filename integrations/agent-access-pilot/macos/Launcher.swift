import AppKit
import WebKit

private struct Message: Decodable {
    let status: String
    let name: String?
    let identity: String?
    let url: URL?
    let cookie: String?
}

private final class Workspace: NSObject, WKNavigationDelegate {
    let name: String
    let identity: String
    let url: URL
    let window: NSWindow
    private let web: WKWebView
    var verified: ((Bool) -> Void)?

    init(name: String, identity: String, url: URL) {
        self.name = name
        self.identity = identity
        self.url = url
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .nonPersistent()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = false
        web = WKWebView(frame: .zero, configuration: configuration)
        window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 720, height: 480),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered, defer: true
        )
        super.init()
        window.title = name
        window.isReleasedWhenClosed = false
        window.contentView = web
        window.center()
        web.navigationDelegate = self
    }

    func prepare(cookie value: String, completion: @escaping () -> Void) -> Bool {
        let header = "fixture_session=\(value); HttpOnly; SameSite=Strict; Path=/"
        guard let cookie = HTTPCookie.cookies(withResponseHeaderFields: ["Set-Cookie": header], for: url).first,
              cookie.name == "fixture_session", cookie.isHTTPOnly else { return false }
        web.configuration.websiteDataStore.httpCookieStore.setCookie(cookie, completionHandler: completion)
        return true
    }

    func open() {
        web.isHidden = true
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        web.load(URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 10))
    }

    private func failed() {
        web.isHidden = true
        window.orderOut(nil)
        verified?(false)
    }

    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        decisionHandler(action.targetFrame?.isMainFrame == true && action.request.url == url ? .allow : .cancel)
    }

    func webView(_ webView: WKWebView, decidePolicyFor response: WKNavigationResponse,
                 decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
        guard response.isForMainFrame, response.response.url == url,
              (response.response as? HTTPURLResponse)?.statusCode == 200 else {
            decisionHandler(.cancel)
            failed()
            return
        }
        decisionHandler(.allow)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        web.evaluateJavaScript("document.getElementById('identity')?.textContent") { [weak self] result, error in
            guard let self else { return }
            guard error == nil, result as? String == identity else { failed(); return }
            web.isHidden = false
            verified?(true)
        }
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        if (error as NSError).code != NSURLErrorCancelled { failed() }
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        failed()
    }
}

private final class Launcher: NSObject, NSApplicationDelegate {
    private let status = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
    private let menu = NSMenu()
    private let helper = Process()
    private let input = Pipe()
    private let output = Pipe()
    private var workspaces: [String: Workspace] = [:]
    private var failedApps: Set<String> = []
    private var prepared = false
    private var pending = 0
    private var stopping = false
    private var startedVerification = false
    private var resultCode: Int32 = 0
    private let verify = CommandLine.arguments.contains("--verify-launches")
    private let names = ["Design Library", "Project Notes"]
    private let identities = ["Design Library": "design@fixture.invalid", "Project Notes": "notes@fixture.invalid"]

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.accessory)
        status.button?.title = "Vault"
        status.button?.image = NSImage(systemSymbolName: "key.fill", accessibilityDescription: nil)
        status.button?.imagePosition = .imageLeading
        status.button?.setAccessibilityLabel("Vault Launcher")
        status.menu = menu
        menu.autoenablesItems = false
        updateMenu()
        startHelper()
    }

    private func updateMenu() {
        menu.removeAllItems()
        let headline = prepared && pending == 0 ? "\(workspaces.count) of \(names.count) demo apps signed in" :
            "Signing in to demo apps…"
        let heading = menu.addItem(withTitle: headline, action: nil, keyEquivalent: "")
        heading.isEnabled = false
        menu.addItem(.separator())
        for name in names {
            let title = failedApps.contains(name) ? name + " · Sign-in unavailable" : name
            let item = menu.addItem(withTitle: title, action: #selector(selectApp(_:)), keyEquivalent: "")
            item.target = self
            item.representedObject = name
            item.isEnabled = workspaces[name] != nil
        }
        menu.addItem(.separator())
        let quit = menu.addItem(withTitle: "Quit Vault Launcher", action: #selector(quitApp), keyEquivalent: "q")
        quit.target = self
        quit.isEnabled = !stopping
    }

    private func startHelper() {
        let bundle = Bundle.main
        let root = bundle.bundleURL.deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
        guard let bun = bundle.object(forInfoDictionaryKey: "VaultBunExecutable") as? String else {
            helperUnavailable()
            return
        }
        helper.executableURL = URL(fileURLWithPath: bun)
        helper.currentDirectoryURL = root.appendingPathComponent("integrations/agent-access-pilot")
        helper.arguments = ["run", "pilot.ts", "launcher"]
        helper.environment = [
            "HOME": NSHomeDirectory(), "TMPDIR": NSTemporaryDirectory(),
            "PATH": NSHomeDirectory() + "/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin",
        ]
        helper.standardInput = input
        helper.standardOutput = output
        helper.standardError = FileHandle.nullDevice
        helper.terminationHandler = { [weak self] _ in DispatchQueue.main.async { self?.helperEnded() } }
        do { try helper.run() } catch { helperUnavailable(); return }
        let stream = output.fileHandleForReading
        DispatchQueue.global(qos: .utility).async { [weak self] in
            var buffer = Data()
            while true {
                let chunk = stream.availableData
                if chunk.isEmpty { break }
                buffer.append(chunk)
                if buffer.count > 8192 { break }
                while let end = buffer.firstIndex(of: 10) {
                    let line = Data(buffer[..<end])
                    buffer.removeSubrange(...end)
                    if let message = try? JSONDecoder().decode(Message.self, from: line) {
                        DispatchQueue.main.async { self?.receive(message) }
                    }
                }
            }
            try? stream.close()
        }
        if verify {
            DispatchQueue.main.asyncAfter(deadline: .now() + 120) { [weak self] in
                guard let self, !stopping else { return }
                finishVerification(success: false)
            }
        }
    }

    private func receive(_ message: Message) {
        guard !stopping else { return }
        if message.status == "ready" {
            prepared = true
        } else if let name = message.name, let expected = identities[name], expected == message.identity {
            if message.status == "signed-in", let url = message.url, let cookie = message.cookie,
               url.scheme == "http", url.host == "127.0.0.1", url.port != nil, url.path == "/app",
               url.user == nil, url.password == nil, url.query == nil, url.fragment == nil,
               cookie.count == 43, cookie.allSatisfy({ $0.isASCII && ($0.isLetter || $0.isNumber || $0 == "-" || $0 == "_") }) {
                let workspace = Workspace(name: name, identity: expected, url: url)
                pending += 1
                if !workspace.prepare(cookie: cookie, completion: { [weak self] in
                    guard let self, !stopping else { return }
                    pending -= 1
                    workspace.verified = { [weak self] ok in
                        if !ok { self?.showUnavailable(name) }
                    }
                    workspaces[name] = workspace
                    updateMenu()
                    verifyIfReady()
                }) {
                    pending -= 1
                    failedApps.insert(name)
                }
            } else {
                failedApps.insert(name)
            }
        }
        updateMenu()
        verifyIfReady()
    }

    private func showUnavailable(_ name: String) {
        failedApps.insert(name)
        workspaces.removeValue(forKey: name)
        updateMenu()
        let alert = NSAlert()
        alert.messageText = "\(name) needs sign-in"
        alert.informativeText = "Quit and reopen Vault Launcher to start a fresh demo session."
        alert.runModal()
    }

    private func helperEnded() {
        if stopping { exit(resultCode) }
        helperUnavailable()
    }

    private func helperUnavailable() {
        workspaces.values.forEach { $0.window.orderOut(nil) }
        workspaces.removeAll()
        failedApps = Set(names)
        prepared = true
        pending = 0
        updateMenu()
        verifyIfReady()
    }

    @objc private func selectApp(_ item: NSMenuItem) {
        guard let name = item.representedObject as? String else { return }
        workspaces[name]?.open()
    }

    private func verifyIfReady() {
        guard verify, prepared, pending == 0, !startedVerification else { return }
        startedVerification = true
        guard workspaces.count == names.count else { finishVerification(success: false); return }
        verifyOpening([names[0], names[1], names[0]])
    }

    private func verifyOpening(_ remaining: [String]) {
        guard let name = remaining.first else { finishVerification(success: true); return }
        guard let workspace = workspaces[name],
              let item = menu.items.first(where: { $0.representedObject as? String == name }),
              item.isEnabled else { finishVerification(success: false); return }
        workspace.verified = { [weak self, weak workspace] ok in
            guard let self, let workspace else { return }
            guard ok else { finishVerification(success: false); return }
            print("Opened \(name) already signed in as \(workspace.identity)")
            workspace.window.close()
            DispatchQueue.main.async { self.verifyOpening(Array(remaining.dropFirst())) }
        }
        selectApp(item)
    }

    private func finishVerification(success: Bool) {
        if !success { fputs("Vault Launcher verification failed.\n", stderr) }
        resultCode = success ? 0 : 1
        quitApp()
    }

    @objc private func quitApp() {
        guard !stopping else { return }
        stopping = true
        updateMenu()
        guard helper.isRunning else { exit(resultCode) }
        try? input.fileHandleForWriting.close()
    }
}

private let launcher = Launcher()
NSApplication.shared.delegate = launcher
NSApplication.shared.run()
