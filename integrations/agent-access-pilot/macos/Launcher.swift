import AppKit
import WebKit

private struct Message: Decodable {
    let status: String
    let requestId: Int?
    let id: String?
    let origin: URL?
    let automaticSignIn: Bool?
    let source: String?
    let reason: String?
    let identity: String?
    let url: URL?
    let cookie: String?
}

private final class Workspace: NSObject, WKNavigationDelegate {
    let id: String
    let name: String
    let identity: String
    let url: URL
    let window: NSWindow
    private let web: WKWebView
    var verified: ((Bool) -> Void)?

    init(id: String, name: String, identity: String, url: URL) {
        self.id = id
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
        web.evaluateJavaScript("[document.getElementById('identity')?.textContent, document.querySelector('main')?.dataset.workspace]") { [weak self] result, error in
            guard let self else { return }
            guard error == nil, result as? [String] == [identity, id] else { failed(); return }
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
    private let apps = [
        (id: "design", name: "Design Library", identity: "design@fixture.invalid"),
        (id: "notes", name: "Project Notes", identity: "notes@fixture.invalid")
    ]
    private let verify = CommandLine.arguments.contains("--verify-launches")
    private let preferenceKey = "AutomaticSignIn"
    private var workspaces: [String: Workspace] = [:]
    private var origin: URL?
    private var notionURL: URL?
    private var launcherWindow: NSWindow?
    private var panelToggle: NSButton?
    private var panelAppButtons: [NSButton] = []
    private var automaticSignIn = false
    private var nextRequestId = 0
    private var reply: ((id: Int, handler: (Message?) -> Void))?
    private var loadingWindow = false
    private var stopping = false
    private var helperFailed = false
    private var resultCode: Int32 = 0

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.accessory)
        status.button?.title = "Vault"
        status.button?.image = NSImage(systemSymbolName: "key.fill", accessibilityDescription: nil)
        status.button?.imagePosition = .imageLeading
        status.button?.setAccessibilityLabel("Vault Launcher")
        status.menu = menu
        menu.autoenablesItems = false
        automaticSignIn = !verify && UserDefaults.standard.bool(forKey: preferenceKey)
        notionURL = loadNotionURL()
        updateMenu()
        startHelper()
        if !verify && notionURL != nil { showLauncher() }
    }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        if !verify && notionURL != nil { showLauncher() }
        return false
    }

    @objc private func showLauncher() {
        if launcherWindow == nil {
            let window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 350, height: 230),
                                  styleMask: [.titled, .closable], backing: .buffered, defer: false)
            window.title = "Vault Launcher"
            window.isReleasedWhenClosed = false
            window.center()
            let notion = NSButton(title: "Open Notion", target: self, action: #selector(openNotion))
            let browserNote = NSTextField(labelWithString: "Notion opens in your default browser.")
            let divider = NSBox()
            divider.boxType = .separator
            let toggle = NSButton(checkboxWithTitle: "Automatic Sign-In (Demo Apps)", target: self,
                                  action: #selector(toggleSignIn))
            panelToggle = toggle
            panelAppButtons = apps.enumerated().map { index, app in
                let button = NSButton(title: app.name, target: self, action: #selector(selectPanelApp(_:)))
                button.tag = index
                return button
            }
            let stack = NSStackView(views: [notion, browserNote, divider, toggle] + panelAppButtons)
            stack.orientation = .vertical
            stack.alignment = .leading
            stack.spacing = 9
            stack.edgeInsets = NSEdgeInsets(top: 16, left: 20, bottom: 16, right: 20)
            window.contentView = stack
            launcherWindow = window
        }
        updateMenu()
        launcherWindow?.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    @objc private func selectPanelApp(_ sender: NSButton) {
        guard apps.indices.contains(sender.tag) else { return }
        open(apps[sender.tag].id)
    }

    private var checkoutRoot: URL {
        Bundle.main.bundleURL.deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
    }

    private func loadNotionURL() -> URL? {
        let config = checkoutRoot.appendingPathComponent(".local/notion-launch-url")
        guard let raw = try? String(contentsOf: config, encoding: .utf8),
              let url = URL(string: raw.trimmingCharacters(in: .whitespacesAndNewlines)),
              url.scheme == "https", url.host == "app.notion.com", url.port == nil,
              url.user == nil, url.password == nil, url.query == nil, url.fragment == nil,
              url.path.range(of: "^/p/[0-9a-f]{32}$", options: .regularExpression) != nil else { return nil }
        return url
    }

    @objc private func openNotion() {
        guard let notionURL, !stopping else { return }
        if !NSWorkspace.shared.open(notionURL) {
            notice("Could not open Notion", "Try opening Notion again from the Vault menu.")
        }
    }

    private func updateMenu() {
        menu.removeAllItems()
        if notionURL != nil {
            let notion = menu.addItem(withTitle: "Open Notion", action: #selector(openNotion), keyEquivalent: "")
            notion.target = self
            notion.toolTip = "Opens the approved page in your browser. Notion handles Google sign-in."
            notion.isEnabled = !stopping
            let show = menu.addItem(withTitle: "Show Launcher", action: #selector(showLauncher), keyEquivalent: "")
            show.target = self
            show.isEnabled = !stopping
            menu.addItem(.separator())
        }
        let headline = helperFailed ? "Vault Launcher unavailable" :
            origin == nil ? "Preparing demo apps…" :
            reply != nil || loadingWindow ? "Checking sign-in…" : "Vault demo apps"
        menu.addItem(withTitle: headline, action: nil, keyEquivalent: "").isEnabled = false
        menu.addItem(.separator())
        let enabled = origin != nil && !helperFailed && !stopping && reply == nil && !loadingWindow
        panelToggle?.state = automaticSignIn ? .on : .off
        panelToggle?.isEnabled = enabled
        panelAppButtons.forEach { $0.isEnabled = enabled }
        for app in apps {
            let item = menu.addItem(withTitle: app.name, action: #selector(selectApp(_:)), keyEquivalent: "")
            item.target = self
            item.representedObject = app.id
            item.isEnabled = enabled
        }
        menu.addItem(.separator())
        let toggle = menu.addItem(withTitle: "Automatic Sign-In (Demo Apps)", action: #selector(toggleSignIn), keyEquivalent: "")
        toggle.target = self
        toggle.state = automaticSignIn ? .on : .off
        toggle.isEnabled = enabled
        let quit = menu.addItem(withTitle: "Quit Vault Launcher", action: #selector(quitApp), keyEquivalent: "q")
        quit.target = self
        quit.isEnabled = !stopping
    }

    private func startHelper() {
        let bundle = Bundle.main
        guard let bun = bundle.object(forInfoDictionaryKey: "VaultBunExecutable") as? String else {
            helperUnavailable()
            return
        }
        helper.executableURL = URL(fileURLWithPath: bun)
        helper.currentDirectoryURL = checkoutRoot.appendingPathComponent("integrations/agent-access-pilot")
        helper.arguments = ["run", "pilot.ts", "launcher"]
        helper.environment = [
            "HOME": NSHomeDirectory(), "TMPDIR": NSTemporaryDirectory(),
            "PATH": NSHomeDirectory() + "/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin",
            "VAULT_LAUNCHER_PIPE": "1",
            "VAULT_LAUNCHER_AUTO": automaticSignIn ? "1" : "0",
            "VAULT_LAUNCHER_VERIFY": verify ? "1" : "0"
        ]
        helper.standardInput = input
        helper.standardOutput = output
        helper.standardError = FileHandle.nullDevice
        helper.terminationHandler = { [weak self] _ in
            DispatchQueue.main.async {
                guard let self else { return }
                if self.stopping { exit(self.resultCode) }
                self.helperUnavailable()
            }
        }
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
        DispatchQueue.main.asyncAfter(deadline: .now() + 180) { [weak self] in
            guard let self, !stopping else { return }
            if verify { finishVerification(success: false) }
            else if origin == nil { helperUnavailable() }
        }
    }

    private func receive(_ message: Message) {
        guard !stopping, !helperFailed else { return }
        if message.status == "ready", origin == nil, let url = message.origin,
           url.scheme == "http", url.host == "127.0.0.1", url.port != nil, url.path.isEmpty,
           url.user == nil, url.password == nil, url.query == nil, url.fragment == nil,
           message.automaticSignIn == automaticSignIn {
            origin = url
            updateMenu()
            if verify { runVerification() }
        } else if let current = reply, message.requestId == current.id {
            reply = nil
            updateMenu()
            current.handler(message)
        }
    }

    private func send(_ command: String, id: String? = nil, enabled: Bool? = nil,
                      completion: @escaping (Message?) -> Void) {
        guard origin != nil, !stopping, !helperFailed, reply == nil else { completion(nil); return }
        nextRequestId += 1
        let requestId = nextRequestId
        var data: [String: Any] = ["command": command, "requestId": requestId]
        if let id { data["id"] = id }
        if let enabled { data["enabled"] = enabled }
        reply = (requestId, completion)
        updateMenu()
        do {
            var line = try JSONSerialization.data(withJSONObject: data)
            line.append(10)
            try input.fileHandleForWriting.write(contentsOf: line)
        } catch {
            helperUnavailable()
            return
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 45) { [weak self] in
            guard let self, reply?.id == requestId else { return }
            helperUnavailable()
        }
    }

    private func helperUnavailable() {
        helperFailed = true
        let waiting = reply
        reply = nil
        workspaces.values.forEach { $0.window.orderOut(nil) }
        updateMenu()
        try? input.fileHandleForWriting.close()
        waiting?.handler(nil)
        if verify && !stopping { finishVerification(success: false) }
    }

    private func setPolicy(_ enabled: Bool, completion: @escaping (Bool) -> Void) {
        send("set-policy", enabled: enabled) { [weak self] message in
            guard let self else { return }
            guard message?.status == "policy", message?.automaticSignIn == enabled else { completion(false); return }
            automaticSignIn = enabled
            if !verify { UserDefaults.standard.set(enabled, forKey: preferenceKey) }
            updateMenu()
            completion(true)
        }
    }

    @objc private func toggleSignIn() {
        setPolicy(!automaticSignIn) { [weak self] ok in
            if !ok { self?.notice("Automatic Sign-In is unavailable", "Quit and reopen Vault Launcher to try again.") }
        }
    }

    @objc private func selectApp(_ item: NSMenuItem) {
        guard let id = item.representedObject as? String else { return }
        open(id)
    }

    private func open(_ id: String, confirmed: Bool = false) {
        guard let app = apps.first(where: { $0.id == id }) else { return }
        send(confirmed ? "confirm-demo" : "open", id: id) { [weak self] message in
            guard let self else { return }
            if !confirmed, message?.status == "manual-required" || message?.status == "wrong-account" {
                let title = message?.status == "wrong-account" ? "Different account detected" :
                    message?.reason == "expired" ? "Demo session expired" : "Sign-in required"
                if notice(title, "Confirm sign-in to \(app.name) as \(app.identity).", confirm: true) {
                    open(id, confirmed: true)
                }
                return
            }
            guard let message, message.status == "signed-in" else {
                notice("\(app.name) is unavailable", "Try again from the Vault menu.")
                return
            }
            show(message, id: id) { [weak self] ok in
                if !ok { self?.notice("Could not verify \(app.name)", "Open it again from the Vault menu to recheck the session.") }
            }
        }
    }

    private func show(_ message: Message, id: String, completion: @escaping (Bool) -> Void) {
        guard let app = apps.first(where: { $0.id == id }),
              let origin, let url = message.url, let cookie = message.cookie,
              message.id == id, message.identity == app.identity,
              url == origin.appendingPathComponent("app"),
              cookie.count == 43, cookie.allSatisfy({ $0.isASCII && ($0.isLetter || $0.isNumber || $0 == "-" || $0 == "_") }) else {
            completion(false)
            return
        }
        let workspace = workspaces[id] ?? Workspace(id: id, name: app.name, identity: app.identity, url: url)
        workspaces[id] = workspace
        loadingWindow = true
        updateMenu()
        workspace.verified = { [weak self, weak workspace] ok in
            guard let self else { return }
            workspace?.verified = nil
            loadingWindow = false
            updateMenu()
            completion(ok)
        }
        if !workspace.prepare(cookie: cookie, completion: { [weak self, weak workspace] in
            guard self?.stopping == false else { return }
            workspace?.open()
        }) {
            workspace.verified?(false)
        }
    }

    @discardableResult
    private func notice(_ title: String, _ detail: String, confirm: Bool = false) -> Bool {
        let alert = NSAlert()
        alert.messageText = title
        alert.informativeText = detail
        alert.addButton(withTitle: confirm ? "Sign In to Demo" : "OK")
        if confirm { alert.addButton(withTitle: "Cancel") }
        NSApp.activate(ignoringOtherApps: true)
        return alert.runModal() == .alertFirstButtonReturn
    }

    private struct Check {
        let command: String
        var id: String? = nil
        var enabled: Bool? = nil
        let status: String
        var source: String? = nil
        var reason: String? = nil
    }

    private func runVerification() {
        if notionURL != nil {
            guard let entry = menu.item(withTitle: "Open Notion"),
                  entry.isEnabled, entry.action == #selector(openNotion) else {
                finishVerification(success: false)
                return
            }
            print("Verified the approved Notion browser handoff is present in the Vault menu")
        }
        let checks = [
            Check(command: "open", id: "design", status: "manual-required", reason: "signed-out"),
            Check(command: "confirm-demo", id: "design", status: "signed-in", source: "manual"),
            Check(command: "set-policy", enabled: true, status: "policy"),
            Check(command: "open", id: "notes", status: "signed-in", source: "automatic"),
            Check(command: "open", id: "design", status: "signed-in", source: "existing"),
            Check(command: "expire-test", id: "notes", status: "expired-test"),
            Check(command: "open", id: "notes", status: "signed-in", source: "automatic"),
            Check(command: "set-policy", enabled: false, status: "policy"),
            Check(command: "open", id: "design", status: "signed-in", source: "existing"),
            Check(command: "expire-test", id: "notes", status: "expired-test"),
            Check(command: "open", id: "notes", status: "manual-required", reason: "expired"),
        ]
        verifyNext(checks[...])
    }

    private func verifyNext(_ checks: ArraySlice<Check>) {
        guard let check = checks.first else { finishVerification(success: true); return }
        let advance = { [weak self] in
            DispatchQueue.main.async { self?.verifyNext(checks.dropFirst()) }
        }
        if let enabled = check.enabled {
            setPolicy(enabled) { [weak self] ok in
                guard ok else { self?.finishVerification(success: false); return }
                print("Automatic sign-in \(enabled ? "enabled" : "paused")")
                advance()
            }
            return
        }
        send(check.command, id: check.id) { [weak self] message in
            guard let self else { return }
            guard let message, message.status == check.status, message.source == check.source,
                  message.reason == check.reason else { finishVerification(success: false); return }
            guard let id = check.id, message.status == "signed-in" else {
                print("\(check.id ?? "") \(message.status) \(message.reason ?? "")")
                advance()
                return
            }
            show(message, id: id) { [weak self] ok in
                guard let self else { return }
                guard ok else { finishVerification(success: false); return }
                print("Verified \(id) workspace and identity via \(message.source ?? "")")
                workspaces[id]?.window.close()
                advance()
            }
        }
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
