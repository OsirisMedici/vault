import AppKit
import QuartzCore
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
        configuration.limitsNavigationsToAppBoundDomains =
            Bundle.main.object(forInfoDictionaryKey: "WKAppBoundDomains") != nil
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

private final class VaultAccountWindow: NSObject, WKNavigationDelegate, NSWindowDelegate {
    static let origin: URL? = {
        guard let address = Bundle.main.object(forInfoDictionaryKey: "VaultAccountURL") as? String,
              let url = URL(string: address), url.scheme == "https", url.host != nil,
              url.port == nil, url.user == nil, url.password == nil,
              url.path.isEmpty || url.path == "/", url.query == nil, url.fragment == nil else { return nil }
        return url
    }()

    static func route(_ path: String, parameter: URLQueryItem? = nil) -> URL? {
        guard let origin, var components = URLComponents(url: origin, resolvingAgainstBaseURL: false) else { return nil }
        components.path = "/"
        var query = URLComponents()
        if let parameter { query.queryItems = [parameter] }
        let encoded = query.percentEncodedQuery?.replacingOccurrences(of: "+", with: "%2B")
        components.percentEncodedFragment = path + (encoded.map { "?" + $0 } ?? "")
        return components.url
    }
    private var window: NSWindow?
    private var web: WKWebView?

    func open(_ url: URL) {
        guard Self.allows(url) else { return }
        if window == nil {
            let configuration = WKWebViewConfiguration()
            configuration.limitsNavigationsToAppBoundDomains = true
            configuration.applicationNameForUserAgent = "VaultMacMenu/1"
            configuration.websiteDataStore = .default()
            configuration.preferences.javaScriptCanOpenWindowsAutomatically = false
            let view = WKWebView(frame: .zero, configuration: configuration)
            view.navigationDelegate = self
            let account = NSWindow(
                contentRect: NSRect(x: 0, y: 0, width: 970, height: 690),
                styleMask: [.titled, .closable, .miniaturizable, .resizable],
                backing: .buffered, defer: false
            )
            account.title = "Vault Account"
            account.isReleasedWhenClosed = false
            account.contentView = view
            account.delegate = self
            account.center()
            web = view
            window = account
        }
        if web?.url != url { web?.load(URLRequest(url: url)) }
        NSApp.activate()
        window?.makeKeyAndOrderFront(nil)
    }

    func prepareCopy(url: URL, field: String, itemID: String,
                     completion: @escaping ([String: Any]) -> Void) {
        guard let web, let page = web.url, Self.allows(page) else {
            completion(["status": "locked"])
            return
        }
        web.callAsyncJavaScript(
            "return window.vaultMacCopy ? await window.vaultMacCopy(request) : { status: 'locked' };",
            arguments: ["request": ["url": url.absoluteString, "field": field,
                                    "id": itemID, "allowReprompt": false]],
            in: nil, in: .page
        ) { [weak self, weak web] result in
            guard let self, let web, self.web === web, let page = web.url, Self.allows(page),
                  case .success(let response) = result, let payload = response as? [String: Any] else {
                completion(["status": "unavailable"])
                return
            }
            completion(payload)
        }
    }

    func windowShouldClose(_ sender: NSWindow) -> Bool {
        // Keep the web client available to the menu. Vault still owns its lock timeout.
        sender.orderOut(nil)
        return false
    }

    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        let allowed = action.targetFrame != nil && action.request.url.map(Self.allows) == true
        decisionHandler(allowed ? .allow : .cancel)
    }

    func webView(_ webView: WKWebView, decidePolicyFor response: WKNavigationResponse,
                 decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
        decisionHandler(response.response.url.map(Self.allows) == true ? .allow : .cancel)
    }

    private static func allows(_ url: URL) -> Bool {
        guard let host = origin?.host else { return false }
        return url.scheme == "https" && url.host == host && (url.port == nil || url.port == 443) &&
            url.user == nil && url.password == nil
    }
}

private final class CredentialClipboard {
    private let pasteboard: NSPasteboard
    private var ownedChangeCount: Int?

    init(pasteboard: NSPasteboard = .general) {
        self.pasteboard = pasteboard
    }

    func copy(_ value: String) -> Bool {
        let item = NSPasteboardItem()
        let concealed = NSPasteboard.PasteboardType("org.nspasteboard.ConcealedType")
        guard item.setString(value, forType: .string), item.setData(Data(), forType: concealed) else { return false }
        pasteboard.prepareForNewContents(with: .currentHostOnly)
        guard pasteboard.writeObjects([item]) else { return false }
        let count = pasteboard.changeCount
        ownedChangeCount = count
        DispatchQueue.main.asyncAfter(deadline: .now() + 30) { [weak self] in
            guard let self, ownedChangeCount == count else { return }
            clear()
        }
        return true
    }

    func clear() {
        defer { ownedChangeCount = nil }
        guard let ownedChangeCount, pasteboard.changeCount == ownedChangeCount else { return }
        pasteboard.clearContents()
    }
}

private final class IslandWindow: NSPanel {
    var dismiss: (() -> Void)?

    override var canBecomeKey: Bool { true }

    override func cancelOperation(_ sender: Any?) {
        dismiss?()
    }
}

private final class IslandView: NSView {
    override var isFlipped: Bool { true }
}

private final class IslandTileButton: NSButton {
    var select: (() -> Void)?
    private var hoverArea: NSTrackingArea?
    private var pendingHover: DispatchWorkItem?

    override func updateTrackingAreas() {
        super.updateTrackingAreas()
        if let hoverArea { removeTrackingArea(hoverArea) }
        let area = NSTrackingArea(rect: .zero, options: [.mouseEnteredAndExited, .inVisibleRect, .activeAlways],
                                  owner: self, userInfo: nil)
        addTrackingArea(area)
        hoverArea = area
    }

    override func mouseEntered(with event: NSEvent) {
        // Keep the current actions while the pointer crosses another tile on its way to the row.
        pendingHover?.cancel()
        let work = DispatchWorkItem { [weak self] in self?.select?() }
        pendingHover = work
        DispatchQueue.main.asyncAfter(deadline: .now() + .milliseconds(120), execute: work)
        super.mouseEntered(with: event)
    }

    override func mouseExited(with event: NSEvent) {
        pendingHover?.cancel()
        super.mouseExited(with: event)
    }

    override func becomeFirstResponder() -> Bool {
        guard super.becomeFirstResponder() else { return false }
        select?()
        return true
    }
}

private final class Launcher: NSObject, NSApplicationDelegate, NSMenuDelegate {
    private struct BrowserApp {
        let name: String
        let url: URL

        var usesGoogleSignIn: Bool { name == "Notion" }
    }

    private static let googleSignInURL = URL(string: "https://accounts.google.com/")!
    private static let googleLoginUnavailable = "Choose a Google login from Gmail first."

    private enum IslandStyle {
        static let width: CGFloat = 352
        static let recentSectionHeight: CGFloat = 97
        static let baseHeight: CGFloat = 314
        static let compact = NSSize(width: 104, height: 31)
        static let copied = NSSize(width: 218, height: 38)
        static let lime = color(0xD9FA5A)
        static let violet = color(0xAD92F8)
        static let ink = color(0xF7F4FF)
        static let muted = color(0xC6BCD9)
        static let divider = color(0x443853)

        static func color(_ rgb: UInt32, alpha: CGFloat = 1) -> NSColor {
            NSColor(srgbRed: CGFloat((rgb >> 16) & 255) / 255,
                    green: CGFloat((rgb >> 8) & 255) / 255,
                    blue: CGFloat(rgb & 255) / 255, alpha: alpha)
        }
    }

    // These entries identify apps and their artwork. Only recorded uses appear in the menu.
    private let appCatalog: [BrowserApp] = [
        ("ChatGPT", "https://chatgpt.com/"),
        ("Claude", "https://claude.ai/"),
        ("Linear", "https://linear.app/"),
        ("GitHub", "https://github.com/"),
        ("Gmail", "https://mail.google.com/"),
        ("HighLevel", "https://app.gohighlevel.com/"),
        ("Vercel", "https://vercel.com/dashboard"),
        ("Notion", "https://app.notion.com/"),
        ("Slack", "https://app.slack.com/"),
        ("Snowflake", "https://app.snowflake.com/"),
        ("Instagram", "https://www.instagram.com/")
    ].map { BrowserApp(name: $0.0, url: URL(string: $0.1)!) }
    private let recentAppsKey = "RecentAppUses"
    private lazy var appIcons: [String: NSImage] = Dictionary(uniqueKeysWithValues: appCatalog.compactMap { app in
        guard let url = Bundle.main.url(forResource: app.name.lowercased(), withExtension: "png",
                                        subdirectory: "AppIcons"),
              let image = NSImage(contentsOf: url) else { return nil }
        image.isTemplate = false
        image.size = NSSize(width: 26, height: 26)
        return (app.name, image)
    })

    private enum BrowserDestination {
        case current(name: String, application: URL)
        case systemDefault(name: String)
        case codex

        var description: String {
            switch self {
            case .current(let name, _): return "Current browser: \(name)"
            case .systemDefault(let name): return "Default browser: \(name)"
            case .codex: return "Codex is active. Copy a link to open it in its browser."
            }
        }

        func title(for app: String) -> String {
            if case .codex = self { return "Copy \(app) link" }
            return "Open \(app)"
        }
    }

    private let status = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
    private let menu = NSMenu()
    private var quickAccess: IslandWindow?
    private var islandRoot: IslandView?
    private var islandMenu: IslandView?
    private var islandRecentHeading: NSTextField?
    private var islandActions: IslandView?
    private var islandLoginChoice: IslandView?
    private var loginChoices: [String] = []
    private var loginChoiceCompletion: ((String?) -> Void)?
    private var islandControls: IslandView?
    private var islandCopied: NSButton?
    private var islandLogin: NSButton?
    private var islandPassword: NSButton?
    private var islandCopyLink: NSButton?
    private var tileButtons: [NSButton] = []
    private var recentApps: [BrowserApp] = []
    private var selectedTile = 0
    private let vaultAccount = VaultAccountWindow()
    private let credentialClipboard = CredentialClipboard()
    private let preferredLoginKey = "PreferredVaultLogins"
    private var credentialRequest: UUID?
    private var credentialCopyPending: Bool { credentialRequest != nil }
    private var selectedApp: BrowserApp? {
        recentApps.indices.contains(selectedTile) ? recentApps[selectedTile] : nil
    }
    private var islandRevision = 0
    private var islandIsCopied = false
    private var islandOutsideClick: Any?
    private let loginSearch = NSSearchField()
    private var quickAccessBrowserNote: NSTextField?
    private let workspace = NSWorkspace.shared
    private let browserProbeURL = URL(string: "https://example.com/")!
    private let defaultBrowserPreference = "AlwaysUseDefaultBrowser"
    private var previousApp: NSRunningApplication?
    private var panelBrowserButtons: [NSButton] = []
    private var panelBrowserNote: NSTextField?
    private let helper = Process()
    private let input = Pipe()
    private let output = Pipe()
    private let apps = [
        (id: "design", name: "Design Library", identity: "design@fixture.invalid"),
        (id: "notes", name: "Project Notes", identity: "notes@fixture.invalid")
    ]
    private let verify = CommandLine.arguments.contains("--verify-launches")
    private var showDemoApps: Bool { verify || CommandLine.arguments.contains("--demo-apps") }
    private let preferenceKey = "AutomaticSignIn"
    private var workspaces: [String: Workspace] = [:]
    private var origin: URL?
    private var browserApps: [BrowserApp] = []
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
        if showDemoApps {
            status.menu = menu
        } else {
            status.button?.image = NSImage(systemSymbolName: "key.fill",
                                           accessibilityDescription: nil)?.withSymbolConfiguration(
                .init(pointSize: 12, weight: .semibold)
            )
            status.button?.target = self
            status.button?.action = #selector(toggleQuickAccess)
        }
        menu.delegate = self
        menu.autoenablesItems = false
        previousApp = workspace.frontmostApplication
        workspace.notificationCenter.addObserver(self, selector: #selector(applicationActivated(_:)),
                                                 name: NSWorkspace.didActivateApplicationNotification, object: nil)
        automaticSignIn = !verify && UserDefaults.standard.bool(forKey: preferenceKey)
        browserApps = [
            BrowserApp(name: "GitHub", url: URL(string: "https://github.com/login")!),
            BrowserApp(name: "Gmail", url: URL(string: "https://mail.google.com/")!)
        ]
        if let notionURL = loadNotionURL() {
            browserApps.insert(BrowserApp(name: "Notion", url: notionURL), at: 0)
        }
        if let vaultURL = VaultAccountWindow.route("/vault") {
            browserApps.insert(BrowserApp(name: "Vault", url: vaultURL), at: 0)
        }
        updateMenu()
        if showDemoApps { startHelper() }
        if !verify && !CommandLine.arguments.contains("--background") { showLauncher() }
    }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        if !verify { showLauncher() }
        return false
    }

    func menuWillOpen(_ menu: NSMenu) {
        updateMenu()
    }

    @objc private func toggleQuickAccess() {
        if quickAccess?.isVisible == true && !islandIsCopied {
            dismissQuickAccess()
        } else {
            showQuickAccess()
        }
    }

    private func showQuickAccess() {
        if quickAccess == nil { buildQuickAccess() }
        guard let panel = quickAccess else { return }
        let size = refreshRecentApps()
        guard let target = islandFrame(size) else { return }
        islandIsCopied = false
        islandCopied?.isHidden = true
        islandMenu?.isHidden = false
        refreshIslandLabels()
        if !panel.isVisible, let start = islandFrame(IslandStyle.compact) {
            islandRoot?.layer?.cornerRadius = start.height / 2
            panel.setFrame(start, display: true)
            panel.makeKeyAndOrderFront(nil)
        }
        // Button labels and search are already available as the shell expands.
        animateIsland(to: target, radius: 19) { [weak self] in
            self?.quickAccess?.makeFirstResponder(self?.loginSearch)
        }
        monitorIslandDismissal()
    }

    private func buildQuickAccess() {
        let bounds = NSRect(x: 0, y: 0, width: IslandStyle.width, height: IslandStyle.baseHeight)
        let panel = IslandWindow(contentRect: bounds,
                                 styleMask: [.borderless, .nonactivatingPanel],
                                 backing: .buffered, defer: false)
        panel.title = "Vault"
        panel.appearance = NSAppearance(named: .darkAqua)
        panel.isOpaque = false
        panel.backgroundColor = .clear
        panel.hasShadow = true
        panel.hidesOnDeactivate = false
        panel.isReleasedWhenClosed = false
        panel.level = .popUpMenu
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        panel.dismiss = { [weak self] in self?.dismissQuickAccess() }

        let root = IslandView(frame: bounds)
        root.wantsLayer = true
        root.layer?.masksToBounds = true
        root.layer?.borderWidth = 1
        root.layer?.borderColor = IslandStyle.color(0x8571AB).cgColor
        root.layer?.cornerRadius = 19
        let glass = NSVisualEffectView(frame: root.bounds)
        glass.material = .hudWindow
        glass.blendingMode = .behindWindow
        glass.state = .active
        glass.autoresizingMask = [.width, .height]
        root.addSubview(glass)
        let tint = NSView(frame: root.bounds)
        tint.autoresizingMask = [.width, .height]
        tint.wantsLayer = true
        tint.layer?.backgroundColor = IslandStyle.color(0x181323, alpha: 0.88).cgColor
        root.addSubview(tint)

        let view = IslandView(frame: bounds)
        root.addSubview(view)
        panel.contentView = root
        quickAccess = panel
        islandRoot = root
        islandMenu = view

        let key = NSImageView(frame: NSRect(x: 17, y: 17, width: 18, height: 18))
        key.image = NSImage(systemSymbolName: "key", accessibilityDescription: nil)
        key.contentTintColor = IslandStyle.lime
        view.addSubview(key)
        islandLabel("Vault", at: NSRect(x: 43, y: 13, width: 110, height: 26),
                    size: 20, weight: .semibold, color: IslandStyle.ink, in: view)
        let options = islandButton("", symbol: "gearshape", label: "Options",
                                   frame: NSRect(x: 279, y: 14, width: 25, height: 24),
                                   action: #selector(showQuickAccessOptions(_:)), in: view)
        options.contentTintColor = IslandStyle.muted
        _ = islandButton("esc", label: "Close Vault menu",
                         frame: NSRect(x: 306, y: 14, width: 31, height: 24),
                         action: #selector(closeIslandFromButton), in: view)
        islandDivider(at: 48, in: view)
        islandRecentHeading = islandLabel("", at: NSRect(x: 18, y: 58, width: 204, height: 20),
                                          size: 13, weight: .semibold, color: IslandStyle.ink, in: view)
        let favorite = islandButton("Favorites", symbol: "star", label: "Favorites",
                                    frame: NSRect(x: 238, y: 55, width: 97, height: 24),
                                    action: #selector(openFavorites), in: view)
        favorite.contentTintColor = IslandStyle.violet

        buildAppActions(in: view)

        let controls = IslandView(frame: NSRect(x: 0, y: 86, width: IslandStyle.width,
                                                height: IslandStyle.baseHeight - 86))
        islandControls = controls
        view.addSubview(controls)
        loginSearch.frame = NSRect(x: 18, y: 0, width: 316, height: 28)
        loginSearch.placeholderString = "Search logins"
        loginSearch.setAccessibilityLabel("Search saved logins")
        loginSearch.sendsWholeSearchString = true
        loginSearch.target = self
        loginSearch.action = #selector(submitLoginSearch)
        controls.addSubview(loginSearch)
        _ = islandButton("All Apps", symbol: "arrow.up.right", label: "All Apps in Vault",
                         frame: NSRect(x: 16, y: 33, width: 90, height: 25),
                         action: #selector(openVaultHome), in: controls)
        islandDivider(at: 65, in: controls)
        islandLabel("Automatic sign-in", at: NSRect(x: 18, y: 75, width: 238, height: 17),
                    size: 13, weight: .semibold, color: IslandStyle.ink, in: controls)
        islandLabel("Off · Planned", at: NSRect(x: 18, y: 94, width: 238, height: 16),
                    size: 11, weight: .medium, color: IslandStyle.muted, in: controls)
        let autoSignIn = NSSwitch(frame: NSRect(x: 292, y: 78, width: 42, height: 24))
        autoSignIn.state = .off
        autoSignIn.isEnabled = false
        autoSignIn.setAccessibilityLabel("Automatic sign-in, planned")
        controls.addSubview(autoSignIn)
        islandDivider(at: 117, in: controls)
        let menuRows: [(String, Selector)] = [
            ("Settings…", #selector(openVaultSettings)),
            ("Check for Updates…", #selector(openVaultReleases)),
            ("About Vault", #selector(openVaultRepository))
        ]
        for (index, entry) in menuRows.enumerated() {
            let button = islandButton(entry.0, label: entry.0,
                                      frame: NSRect(x: 18, y: 124 + index * 24, width: 316, height: 24),
                                      action: entry.1, in: controls)
            button.alignment = .left
        }
        quickAccessBrowserNote = islandLabel("", at: NSRect(x: 18, y: 201, width: 316, height: 17),
                                            size: 11, weight: .medium, color: IslandStyle.muted, in: controls)

        let confirmation = islandButton("", symbol: "checkmark.circle.fill", label: "Link copied",
                                        frame: NSRect(origin: .zero, size: IslandStyle.copied),
                                        action: #selector(reopenIslandFromConfirmation), in: root)
        confirmation.imagePosition = .imageLeading
        confirmation.wantsLayer = true
        confirmation.layer?.backgroundColor = IslandStyle.lime.cgColor
        confirmation.contentTintColor = IslandStyle.color(0x1A210D)
        confirmation.isHidden = true
        islandCopied = confirmation
    }

    private func refreshRecentApps() -> NSSize {
        let uses = recentAppUses()
        let apps = appCatalog.filter { uses[$0.name] != nil }
            .sorted { uses[$0.name, default: .distantPast] > uses[$1.name, default: .distantPast] }
        let latest = Array(apps.prefix(7))
        if let view = islandMenu, latest.map(\.name) != recentApps.map(\.name) {
            tileButtons.forEach { $0.removeFromSuperview() }
            recentApps = latest
            selectedTile = 0
            tileButtons = recentApps.enumerated().map { index, app in
                let rect = NSRect(x: 18 + index * 46, y: 84, width: 39, height: 39)
                let button = IslandTileButton(frame: .zero)
                configureIslandButton(button, title: "", symbol: nil, label: "Show \(app.name) actions",
                                      frame: rect, action: #selector(selectAppTile(_:)), in: view)
                button.tag = index
                button.select = { [weak self] in self?.selectTile(at: index) }
                button.toolTip = app.name
                if let icon = appIcons[app.name] {
                    button.image = icon
                    button.imagePosition = .imageOnly
                } else {
                    button.title = String(app.name.prefix(1))
                    button.contentTintColor = IslandStyle.color(0x1A210D)
                }
                button.wantsLayer = true
                button.layer?.cornerRadius = 10
                button.layer?.backgroundColor = IslandStyle.color(0xF7F4FF).cgColor
                return button
            }
        }
        let empty = recentApps.isEmpty
        islandRecentHeading?.stringValue = empty ? "No recent apps yet" : "Recent apps"
        islandRecentHeading?.textColor = empty ? IslandStyle.muted : IslandStyle.ink
        islandActions?.isHidden = empty || islandLoginChoice != nil
        let offset = empty ? 0 : IslandStyle.recentSectionHeight
        islandControls?.setFrameOrigin(NSPoint(x: 0, y: 86 + offset))
        let size = NSSize(width: IslandStyle.width, height: IslandStyle.baseHeight + offset)
        islandMenu?.setFrameSize(size)
        return size
    }

    private func buildAppActions(in view: NSView) {
        let row = IslandView(frame: NSRect(x: 18, y: 132, width: 316, height: 39))
        row.wantsLayer = true
        row.layer?.cornerRadius = 11
        row.layer?.backgroundColor = IslandStyle.color(0x2C233D).cgColor
        view.addSubview(row)
        islandActions = row

        let marker = NSView(frame: NSRect(x: 4, y: 7, width: 3, height: 25))
        marker.wantsLayer = true
        marker.layer?.cornerRadius = 1.5
        marker.layer?.backgroundColor = IslandStyle.lime.cgColor
        row.addSubview(marker)

        let iconPlate = NSView(frame: NSRect(x: 11, y: 7, width: 26, height: 26))
        iconPlate.wantsLayer = true
        iconPlate.layer?.cornerRadius = 6
        iconPlate.layer?.backgroundColor = IslandStyle.color(0xF7F4FF).cgColor
        row.addSubview(iconPlate)

        let login = islandButton("", label: "Copy username and password", frame: NSRect(x: 11, y: 3, width: 219, height: 33),
                                 action: #selector(copySelectedLogin), in: row)
        login.alignment = .left
        login.imagePosition = .imageLeading
        login.imageHugsTitle = true
        login.imageScaling = .scaleProportionallyDown
        islandLogin = login

        let separator = NSView(frame: NSRect(x: 233, y: 9, width: 1, height: 21))
        separator.wantsLayer = true
        separator.layer?.backgroundColor = IslandStyle.divider.cgColor
        row.addSubview(separator)
        let password = islandButton("", symbol: "key", label: "Copy password",
                                    frame: NSRect(x: 239, y: 3, width: 34, height: 33),
                                    action: #selector(copySelectedPassword), in: row)
        let link = islandButton("", symbol: "link", label: "Copy app link",
                                frame: NSRect(x: 277, y: 3, width: 34, height: 33),
                                action: #selector(copySelectedAppLink), in: row)
        for button in [password, link] {
            button.image = button.image?.withSymbolConfiguration(.init(pointSize: 17, weight: .semibold))
            button.contentTintColor = IslandStyle.lime
        }
        islandPassword = password
        islandCopyLink = link
    }

    @discardableResult
    private func islandLabel(_ text: String, at frame: NSRect, size: CGFloat, weight: NSFont.Weight,
                             color: NSColor, in view: NSView) -> NSTextField {
        let label = NSTextField(labelWithString: text)
        label.frame = frame
        label.font = .systemFont(ofSize: size, weight: weight)
        label.textColor = color
        label.lineBreakMode = .byTruncatingTail
        view.addSubview(label)
        return label
    }

    private func islandButton(_ title: String, symbol: String? = nil, label: String, frame: NSRect,
                              action: Selector, in view: NSView) -> NSButton {
        let button = NSButton(frame: .zero)
        configureIslandButton(button, title: title, symbol: symbol, label: label, frame: frame,
                              action: action, in: view)
        return button
    }

    private func configureIslandButton(_ button: NSButton, title: String, symbol: String?, label: String,
                                       frame: NSRect, action: Selector, in view: NSView) {
        button.title = title
        button.target = self
        button.action = action
        button.frame = frame
        button.isBordered = false
        button.setButtonType(.momentaryLight)
        button.font = .systemFont(ofSize: 12, weight: .semibold)
        button.contentTintColor = IslandStyle.ink
        if let symbol {
            button.image = NSImage(systemSymbolName: symbol, accessibilityDescription: nil)
                ?? NSImage(systemSymbolName: "globe", accessibilityDescription: nil)
            button.imagePosition = title.isEmpty ? .imageOnly : .imageLeading
        }
        button.setAccessibilityLabel(label)
        view.addSubview(button)
    }

    private func islandDivider(at y: CGFloat, in view: NSView) {
        let line = NSView(frame: NSRect(x: 18, y: y, width: 316, height: 1))
        line.wantsLayer = true
        line.layer?.backgroundColor = IslandStyle.divider.cgColor
        view.addSubview(line)
    }

    private func islandFrame(_ size: NSSize) -> NSRect? {
        guard let button = status.button, let window = button.window, let screen = window.screen else { return nil }
        let anchor = window.convertToScreen(button.convert(button.bounds, to: nil))
        let visible = screen.visibleFrame
        // Use the expanded width for clamping so the center stays fixed while resizing.
        let half = IslandStyle.width / 2
        let center = min(max(anchor.midX, visible.minX + half + 8), visible.maxX - half - 8)
        return NSRect(x: center - size.width / 2, y: anchor.minY - 4 - size.height,
                      width: size.width, height: size.height)
    }

    private func animateIsland(to frame: NSRect, radius: CGFloat, completion: (() -> Void)? = nil) {
        guard let panel = quickAccess else { return }
        islandRevision += 1
        let revision = islandRevision
        let reduceMotion = workspace.accessibilityDisplayShouldReduceMotion
        islandRoot?.layer?.cornerRadius = radius
        if reduceMotion || panel.frame == frame {
            panel.setFrame(frame, display: true)
            completion?()
            return
        }
        NSAnimationContext.runAnimationGroup { context in
            context.duration = 0.25
            context.timingFunction = CAMediaTimingFunction(controlPoints: 0.22, 0.85, 0.25, 1)
            panel.animator().setFrame(frame, display: true)
        } completionHandler: { [weak self] in
            guard self?.islandRevision == revision else { return }
            completion?()
        }
    }

    private func monitorIslandDismissal() {
        guard islandOutsideClick == nil else { return }
        islandOutsideClick = NSEvent.addGlobalMonitorForEvents(matching: [.leftMouseDown, .rightMouseDown]) {
            [weak self] _ in self?.dismissQuickAccess()
        }
    }

    private func dismissQuickAccess() {
        credentialRequest = nil
        finishLoginChoice(nil)
        islandRevision += 1
        islandIsCopied = false
        quickAccess?.orderOut(nil)
        if let islandOutsideClick {
            NSEvent.removeMonitor(islandOutsideClick)
            self.islandOutsideClick = nil
        }
    }

    private func refreshIslandLabels() {
        let destination = browserDestination()
        switch destination {
        case .codex: quickAccessBrowserNote?.stringValue = "Codex browser"
        case .current(let name, _), .systemDefault(let name): quickAccessBrowserNote?.stringValue = name
        }
        refreshAppActions()
    }

    private func refreshAppActions() {
        for (index, button) in tileButtons.enumerated() {
            button.layer?.borderWidth = index == selectedTile ? 2 : 0
            button.layer?.borderColor = IslandStyle.lime.cgColor
        }
        guard let app = selectedApp else { return }
        let name = app.name
        let credentialName = app.usesGoogleSignIn ? "Google" : name
        islandLogin?.image = appIcons[name]
        islandLogin?.attributedTitle = NSAttributedString(
            string: name, attributes: [.foregroundColor: IslandStyle.ink,
                                       .font: NSFont.systemFont(ofSize: 15, weight: .semibold)]
        )
        islandLogin?.setAccessibilityLabel("Copy \(credentialName) username and password")
        islandLogin?.toolTip = "Copy \(credentialName) username and password"
        islandPassword?.setAccessibilityLabel("Copy \(credentialName) password")
        islandPassword?.toolTip = "Copy \(credentialName) password"
        islandCopyLink?.setAccessibilityLabel("Copy \(name) link")
        islandCopyLink?.toolTip = "Copy \(name) link"
    }

    @objc private func closeIslandFromButton() { dismissQuickAccess() }

    @objc private func reopenIslandFromConfirmation() { showQuickAccess() }

    @objc private func selectAppTile(_ sender: NSButton) {
        selectTile(at: sender.tag)
    }

    private func selectTile(at index: Int) {
        guard !stopping, quickAccess?.isVisible == true, !islandIsCopied, islandLoginChoice == nil,
              recentApps.indices.contains(index),
              index != selectedTile else { return }
        selectedTile = index
        credentialRequest = nil
        refreshAppActions()
    }

    @objc private func copySelectedLogin() { startCredentialCopy(field: "login") }

    @objc private func copySelectedPassword() { startCredentialCopy(field: "password") }

    @objc private func chooseSelectedLogin() { startCredentialCopy(field: "login", choose: true) }

    private func startCredentialCopy(field: String, choose: Bool = false) {
        guard let app = selectedApp, !credentialCopyPending else { return }
        let preferred = UserDefaults.standard.dictionary(forKey: preferredLoginKey) as? [String: String] ?? [:]
        let id = preferred[app.usesGoogleSignIn ? "Gmail" : app.name] ?? ""
        if app.usesGoogleSignIn && UUID(uuidString: id) == nil {
            showMenuStatus(Self.googleLoginUnavailable)
            return
        }
        let request = UUID()
        credentialRequest = request
        let lookupURL = app.usesGoogleSignIn ? Self.googleSignInURL : app.url
        copyCredential(app, lookupURL: lookupURL, field: field,
                       id: choose && !app.usesGoogleSignIn ? "" : id, request: request)
    }

    private func copyCredential(_ app: BrowserApp, lookupURL: URL, field: String, id: String, request: UUID) {
        vaultAccount.prepareCopy(url: lookupURL, field: field, itemID: id) { [weak self] response in
            guard let self, credentialRequest == request else { return }
            switch response["status"] as? String {
            case "choose" where app.usesGoogleSignIn, "noMatch" where app.usesGoogleSignIn:
                showMenuStatus(Self.googleLoginUnavailable)
            case "choose":
                guard let choices = response["choices"] as? [[String: String]] else { break }
                chooseLogin(for: app.name, choices: choices) { [weak self] choice in
                    guard let self, credentialRequest == request else { return }
                    if let choice {
                        copyCredential(app, lookupURL: lookupURL, field: field, id: choice, request: request)
                    } else {
                        credentialRequest = nil
                    }
                }
                return
            case "reprompt":
                showMenuStatus("Approval required. Copy this login in Vault.")
            case "ready":
                guard let selected = response["id"] as? String, let selectedID = UUID(uuidString: selected),
                      let value = response["value"] as? String, !value.isEmpty else { break }
                if app.usesGoogleSignIn && selectedID != UUID(uuidString: id) {
                    showMenuStatus(Self.googleLoginUnavailable)
                    break
                }
                if credentialClipboard.copy(value) {
                    if !app.usesGoogleSignIn {
                        var preferred = UserDefaults.standard.dictionary(forKey: preferredLoginKey) as? [String: String] ?? [:]
                        preferred[app.name] = selected
                        UserDefaults.standard.set(preferred, forKey: preferredLoginKey)
                    }
                    recordRecentApp(app.name)
                    let copied = field == "password" ? "password" : "login"
                    let credentialName = app.usesGoogleSignIn ? "Google" : app.name
                    showCopyConfirmation("\(credentialName) \(copied) copied")
                } else {
                    showMenuStatus("Could not copy \(app.name). Try again.")
                }
            case "locked":
                showMenuStatus("Open All Apps and unlock Vault to copy.")
            case "noMatch":
                // Gmail logins may be saved against the Google sign-in page.
                if lookupURL == app.url && app.url.host == "mail.google.com" {
                    copyCredential(app, lookupURL: Self.googleSignInURL, field: field, id: id, request: request)
                    return
                }
                showMenuStatus("No eligible \(app.name) login to copy.")
            case "cancelled":
                break
            default:
                showMenuStatus("Could not copy \(app.name). Try again.")
            }
            credentialRequest = nil
        }
    }

    private func chooseLogin(for name: String, choices: [[String: String]], completion: @escaping (String?) -> Void) {
        let items = choices.compactMap { choice -> (id: String, label: String)? in
            guard let id = choice["id"], UUID(uuidString: id) != nil, let label = choice["label"] else { return nil }
            return (id, label)
        }
        guard !items.isEmpty, quickAccess?.isVisible == true,
              let islandMenu, let islandActions else {
            completion(nil)
            return
        }
        let chooser = IslandView(frame: islandActions.frame)
        let picker = NSPopUpButton(frame: NSRect(x: 0, y: 5, width: 243, height: 29))
        picker.menu?.autoenablesItems = false
        picker.addItem(withTitle: "Choose a \(name) login")
        picker.item(at: 0)?.isEnabled = false
        for item in items {
            // Add menu items individually so two saved entries with the same title remain selectable.
            picker.menu?.addItem(NSMenuItem(title: item.label, action: nil, keyEquivalent: ""))
        }
        picker.selectItem(at: 0)
        picker.target = self
        picker.action = #selector(selectLoginChoice(_:))
        picker.setAccessibilityLabel("Choose a \(name) login")
        chooser.addSubview(picker)
        _ = islandButton("Cancel", label: "Cancel login choice",
                         frame: NSRect(x: 249, y: 5, width: 67, height: 29),
                         action: #selector(cancelLoginChoice), in: chooser)
        islandMenu.addSubview(chooser)
        islandActions.isHidden = true
        islandLoginChoice = chooser
        loginChoices = items.map(\.id)
        loginChoiceCompletion = completion
        quickAccess?.makeFirstResponder(picker)
        showMenuStatus("Choose a login to copy and remember it.")
    }

    @objc private func selectLoginChoice(_ sender: NSPopUpButton) {
        let index = sender.indexOfSelectedItem - 1
        if loginChoices.indices.contains(index) { finishLoginChoice(loginChoices[index]) }
    }

    @objc private func cancelLoginChoice() {
        finishLoginChoice(nil)
        refreshIslandLabels()
    }

    private func finishLoginChoice(_ id: String?) {
        guard let chooser = islandLoginChoice else { return }
        let completion = loginChoiceCompletion
        islandLoginChoice = nil
        loginChoices = []
        loginChoiceCompletion = nil
        chooser.removeFromSuperview()
        islandActions?.isHidden = recentApps.isEmpty
        completion?(id)
    }

    private func showMenuStatus(_ message: String) {
        quickAccessBrowserNote?.stringValue = message
    }

    @objc private func copySelectedAppLink() {
        guard let app = selectedApp, !credentialCopyPending else { return }
        let url = app.name == "Notion" ? loadNotionURL() ?? app.url : app.url
        copyBrowserLink(BrowserApp(name: app.name, url: url), recording: app.name)
    }

    @objc private func openVaultHome() {
        openVaultAccount(path: "/vault")
    }

    @objc private func openVaultSettings() {
        openVaultAccount(path: "/settings")
    }

    @objc private func openVaultReleases() {
        openProjectPage("https://github.com/OsirisMedici/vault/releases")
    }

    @objc private func openVaultRepository() {
        openProjectPage("https://github.com/OsirisMedici/vault")
    }

    private func openProjectPage(_ address: String) {
        dismissQuickAccess()
        if let url = URL(string: address), !workspace.open(url) {
            notice("Could not open GitHub", "Check the default browser in System Settings.")
        }
    }

    private func recentAppUses() -> [String: Date] {
        let cutoff = Date().addingTimeInterval(-30 * 24 * 60 * 60)
        let uses = UserDefaults.standard.dictionary(forKey: recentAppsKey) as? [String: Date] ?? [:]
        return uses.filter { $0.value >= cutoff }
    }

    private func recordRecentApp(_ name: String?) {
        guard let name, appCatalog.contains(where: { $0.name == name }) else { return }
        var uses = recentAppUses()
        uses[name] = Date()
        UserDefaults.standard.set(uses, forKey: recentAppsKey)
    }

    private func copyBrowserLink(_ app: BrowserApp, recording name: String? = nil) {
        NSPasteboard.general.clearContents()
        guard NSPasteboard.general.setString(app.url.absoluteString, forType: .string) else {
            showMenuStatus("Could not copy the link. Try again.")
            return
        }
        recordRecentApp(name)
        panelBrowserNote?.stringValue = "\(app.name) link copied. Paste it into the Codex browser."
        showCopyConfirmation("\(app.name) link copied")
    }

    private func showCopyConfirmation(_ message: String) {
        guard quickAccess?.isVisible == true,
              let frame = islandFrame(IslandStyle.copied) else { return }
        islandIsCopied = true
        islandMenu?.isHidden = true
        islandCopied?.attributedTitle = NSAttributedString(
            string: message,
            attributes: [.foregroundColor: IslandStyle.color(0x1A210D),
                         .font: NSFont.systemFont(ofSize: 12, weight: .semibold)]
        )
        islandCopied?.setAccessibilityLabel("\(message). Reopen Vault")
        islandCopied?.isHidden = false
        animateIsland(to: frame, radius: frame.height / 2)
        let revision = islandRevision
        DispatchQueue.main.asyncAfter(deadline: .now() + 3) { [weak self] in
            guard let self, islandRevision == revision, islandIsCopied else { return }
            dismissQuickAccess()
        }
    }

    @objc private func showQuickAccessOptions(_ sender: NSButton) {
        updateMenu()
        menu.popUp(positioning: nil, at: NSPoint(x: 0, y: sender.bounds.height), in: sender)
    }

    @objc private func submitLoginSearch() {
        let query = loginSearch.stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !query.isEmpty else { return }
        let normalized = query.lowercased()
        let host = URL(string: normalized)?.host ?? normalized
        let app = appCatalog.first {
            normalized == $0.name.lowercased() || host == $0.url.host
        }
        let name = app?.name ?? (normalized == "gohighlevel" ? "HighLevel" : nil)
        openVaultAccount(path: "/vault", parameter: URLQueryItem(name: "search", value: query), recording: name)
    }

    @objc private func openFavorites() {
        openVaultAccount(path: "/vault", parameter: URLQueryItem(name: "type", value: "favorites"))
    }

    private func openVaultAccount(path: String, parameter: URLQueryItem? = nil, recording name: String? = nil) {
        guard let url = VaultAccountWindow.route(path, parameter: parameter) else {
            showMenuStatus("Build with VAULT_LAUNCHER_URL to connect your vault.")
            return
        }
        loginSearch.stringValue = ""
        dismissQuickAccess()
        vaultAccount.open(url)
        recordRecentApp(name)
    }

    @objc private func applicationActivated(_ notification: Notification) {
        guard let app = notification.userInfo?[NSWorkspace.applicationUserInfoKey] as? NSRunningApplication,
              app.processIdentifier != ProcessInfo.processInfo.processIdentifier else { return }
        previousApp = app
        if quickAccess?.isVisible == true && !islandIsCopied { refreshIslandLabels() }
        updateBrowserPanel()
    }

    private func browserDestination() -> BrowserDestination {
        let foreground = workspace.frontmostApplication
        let active = foreground?.processIdentifier == ProcessInfo.processInfo.processIdentifier ? previousApp : foreground
        if !UserDefaults.standard.bool(forKey: defaultBrowserPreference), let active {
            if active.bundleIdentifier == "com.openai.codex" { return .codex }
            if let bundleID = active.bundleIdentifier,
               let application = workspace.urlsForApplications(toOpen: browserProbeURL).first(where: {
                   Bundle(url: $0)?.bundleIdentifier == bundleID
               }) {
                return .current(name: active.localizedName ?? application.deletingPathExtension().lastPathComponent,
                                application: application)
            }
        }
        let application = workspace.urlForApplication(toOpen: browserProbeURL)
        let name = application?.deletingPathExtension().lastPathComponent ?? "System default"
        return .systemDefault(name: name)
    }

    @objc private func toggleDefaultBrowser() {
        let defaults = UserDefaults.standard
        defaults.set(!defaults.bool(forKey: defaultBrowserPreference), forKey: defaultBrowserPreference)
        updateMenu()
        refreshIslandLabels()
    }

    private func updateBrowserPanel() {
        guard let panelBrowserNote else { return }
        let destination = browserDestination()
        panelBrowserNote.stringValue = destination.description
        for (button, app) in zip(panelBrowserButtons, browserApps) {
            button.title = destination.title(for: app.name)
        }
    }

    @objc private func showLauncher() {
        if !showDemoApps {
            showQuickAccess()
            return
        }
        if launcherWindow == nil {
            let window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 350, height: showDemoApps ? 320 : 190),
                                  styleMask: [.titled, .closable], backing: .buffered, defer: false)
            window.title = "Vault Launcher"
            window.isReleasedWhenClosed = false
            window.center()
            panelBrowserButtons = browserApps.enumerated().map { index, app in
                let button = NSButton(title: "Open \(app.name)", target: self,
                                      action: #selector(selectBrowserButton(_:)))
                button.tag = index
                return button
            }
            let browserNote = NSTextField(wrappingLabelWithString: "")
            panelBrowserNote = browserNote
            let stack = NSStackView(views: [browserNote] + panelBrowserButtons)
            if showDemoApps {
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
                for view in [divider, toggle] + panelAppButtons {
                    stack.addArrangedSubview(view)
                }
            }
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

    @objc private func selectBrowserButton(_ sender: NSButton) {
        openBrowserApp(at: sender.tag)
    }

    @objc private func selectBrowserMenuItem(_ sender: NSMenuItem) {
        openBrowserApp(at: sender.tag)
    }

    private func openBrowserApp(at index: Int) {
        guard !stopping, browserApps.indices.contains(index) else { return }
        let app = browserApps[index]
        openBrowserLink(app, recording: app.name)
    }

    private func openBrowserLink(_ app: BrowserApp, recording name: String? = nil) {
        let destination = browserDestination()
        switch destination {
        case .current(_, let application):
            dismissQuickAccess()
            workspace.open([app.url], withApplicationAt: application, configuration: .init()) { [weak self] _, error in
                DispatchQueue.main.async {
                    if error == nil {
                        self?.recordRecentApp(name)
                    } else {
                        self?.notice("Could not open \(app.name)", "Choose Always Use Default Browser in the Vault menu and try again.")
                    }
                }
            }
        case .systemDefault:
            dismissQuickAccess()
            if workspace.open(app.url) {
                recordRecentApp(name)
            } else {
                notice("Could not open \(app.name)", "Check the default browser in System Settings.")
            }
        case .codex:
            copyBrowserLink(app, recording: name)
        }
    }

    private func updateMenu() {
        menu.removeAllItems()
        let destination = browserDestination()
        menu.addItem(withTitle: destination.description, action: nil, keyEquivalent: "").isEnabled = false
        for (index, app) in browserApps.enumerated() {
            let item = menu.addItem(withTitle: destination.title(for: app.name), action: #selector(selectBrowserMenuItem(_:)),
                                    keyEquivalent: "")
            item.target = self
            item.tag = index
            item.toolTip = destination.description
            item.isEnabled = !stopping
        }
        let show = menu.addItem(withTitle: "Show Launcher", action: #selector(showLauncher), keyEquivalent: "")
        show.target = self
        show.isEnabled = !stopping
        if !showDemoApps, let app = selectedApp, !app.usesGoogleSignIn {
            let choose = menu.addItem(withTitle: "Choose and Copy \(app.name) Login…", action: #selector(chooseSelectedLogin),
                                      keyEquivalent: "")
            choose.target = self
            choose.isEnabled = !stopping && !credentialCopyPending
        }
        let useDefault = menu.addItem(withTitle: "Always Use Default Browser", action: #selector(toggleDefaultBrowser),
                                      keyEquivalent: "")
        useDefault.target = self
        useDefault.state = UserDefaults.standard.bool(forKey: defaultBrowserPreference) ? .on : .off
        useDefault.isEnabled = !stopping
        updateBrowserPanel()
        menu.addItem(.separator())
        if showDemoApps { addDemoMenuItems() }
        let quit = menu.addItem(withTitle: "Quit Vault Launcher", action: #selector(quitApp), keyEquivalent: "q")
        quit.target = self
        quit.isEnabled = !stopping
    }

    private func addDemoMenuItems() {
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
        menu.addItem(.separator())
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
        for (index, app) in browserApps.enumerated() {
            guard let entry = menu.item(withTitle: browserDestination().title(for: app.name)), entry.tag == index,
                  entry.isEnabled, entry.action == #selector(selectBrowserMenuItem(_:)) else {
                finishVerification(success: false)
                return
            }
            print("Verified the \(app.name) browser handoff is present in the Vault menu")
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
        credentialRequest = nil
        credentialClipboard.clear()
        updateMenu()
        guard helper.isRunning else { exit(resultCode) }
        try? input.fileHandleForWriting.close()
    }
}

private let launcher = Launcher()
NSApplication.shared.delegate = launcher
NSApplication.shared.run()
