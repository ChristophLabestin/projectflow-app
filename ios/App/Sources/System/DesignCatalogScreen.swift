import SwiftUI
import WidgetKit
import PFDesign
import PFModel
import PFSnapshot

/// Every PFDesign component and the widget / Live Activity views in one scrollable page, in light or dark.
/// QA surface for visual review and snapshot tests (route `.designCatalog`; `projectflow://catalog` in Debug builds).
/// Labels are developer-facing and intentionally not localised.
struct DesignCatalogScreen: View {
    @Environment(AppModel.self) private var model
    @Environment(\.colorScheme) private var systemScheme
    @State private var appearance = "system"

    private var scheme: ColorScheme {
        switch appearance {
        case "light": .light
        case "dark": .dark
        default: systemScheme
        }
    }

    var body: some View {
        ZStack {
            PFCanvas(dotted: true)
            VStack(alignment: .leading, spacing: 0) {
                if model.router.isDeep { PFTopBar(title: "Design catalog", backLabel: L10n.t("common.back"), onBack: { model.router.pop() }) {} }
                ScrollViewReader { proxy in
                    ScrollView {
                        VStack(alignment: .leading, spacing: 0) {
                            PFSegmented([("system", "System"), ("light", "Light"), ("dark", "Dark")], selection: $appearance)
                                .padding(.top, PFSpace.s)
                            CatalogTypography().id("typography")
                            CatalogColors().id("colour")
                            CatalogButtons().id("buttons")
                            CatalogIndicators().id("indicators")
                            CatalogInputs().id("inputs")
                            CatalogLists().id("lists")
                            CatalogFeedback().id("feedback")
                            CatalogChrome().id("chrome")
                            CatalogSystem().id("system")
                            CatalogShare().id("share")
                        }
                        .padding(.horizontal, PFSpace.page)
                        .padding(.bottom, 120)
                    }
                    .scrollIndicators(.hidden)
                    .task {
                        // QA: `-pfCatalogSection widgets|indicators|…` and `-pfCatalogAppearance dark` for screenshots.
                        let arguments = ProcessInfo.processInfo.arguments
                        if let index = arguments.firstIndex(of: "-pfCatalogAppearance"), arguments.count > index + 1 { appearance = arguments[index + 1] }
                        if let index = arguments.firstIndex(of: "-pfCatalogSection"), arguments.count > index + 1 {
                            try? await Task.sleep(for: .milliseconds(400))
                            proxy.scrollTo(arguments[index + 1] == "widgets" ? "system" : arguments[index + 1], anchor: .top)
                        }
                    }
                }
            }
        }
        .environment(\.colorScheme, scheme)
        .preferredColorScheme(appearance == "system" ? nil : scheme)
    }
}

// MARK: - Layout helpers

private struct CatalogSection<Content: View>: View {
    let title: String
    let content: Content

    init(_ title: String, @ViewBuilder content: () -> Content) {
        self.title = title
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: PFSpace.s) {
            PFSectionHeader(title)
            content
        }
    }
}

private struct CatalogRow<Content: View>: View {
    let label: String
    let content: Content

    init(_ label: String, @ViewBuilder content: () -> Content) {
        self.label = label
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label).pfText(.caption).foregroundStyle(PFColor.textMuted)
            content
        }
    }
}

/// Horizontally scrolling row for demos wider than the screen (keeps the page itself from overflowing).
private struct CatalogScrollRow<Content: View>: View {
    let content: Content
    init(@ViewBuilder content: () -> Content) { self.content = content() }

    var body: some View {
        ScrollView(.horizontal) {
            HStack(alignment: .center, spacing: 12) { content }
                .padding(.vertical, 4)
        }
        .scrollIndicators(.hidden)
    }
}

private struct CatalogCard<Content: View>: View {
    let content: Content
    init(@ViewBuilder content: () -> Content) { self.content = content() }

    var body: some View {
        VStack(alignment: .leading, spacing: PFSpace.m) { content }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(PFSpace.m)
            .pfCard()
    }
}

// MARK: - Typography and colour

private struct CatalogTypography: View {
    var body: some View {
        CatalogSection("Typography") {
            CatalogCard {
                ForEach(PFTextStyle.allCases, id: \.self) { style in
                    Text(sample(style)).pfText(style).foregroundStyle(PFColor.textMain).lineLimit(1)
                }
            }
        }
    }

    private func sample(_ style: PFTextStyle) -> String {
        switch style {
        case .displayLarge, .display: "Heute ist in 4 Zügen erledigt"
        case .title: "Website Relaunch"
        case .eyebrow: "Dein Plan für heute"
        case .pill: "In Arbeit"
        default: "\(String(describing: style)) — Handgriffe & Hamburgefonts"
        }
    }
}

private struct CatalogColors: View {
    var body: some View {
        CatalogSection("Colour") {
            CatalogCard {
                swatches([("canvas", PFColor.canvas), ("card", PFColor.card), ("raised", PFColor.raised), ("hairline", PFColor.hairline),
                          ("textMain", PFColor.textMain), ("textMuted", PFColor.textMuted), ("textSubtle", PFColor.textSubtle),
                          ("primary", PFColor.primary), ("onPrimary", PFColor.onPrimary)])
                swatches([("success", PFColor.success), ("warning", PFColor.warning), ("danger", PFColor.danger),
                          ("urgent", PFColor.priority(.urgent)), ("high", PFColor.priority(.high)),
                          ("medium", PFColor.priority(.medium)), ("low", PFColor.priority(.low))])
                swatches(StatusTone.allCases.map { ($0.rawValue, PFColor.statusBase($0)) })
            }
        }
    }

    private func swatches(_ items: [(String, Color)]) -> some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 64), spacing: 8)], alignment: .leading, spacing: 8) {
            ForEach(items, id: \.0) { name, color in
                VStack(spacing: 4) {
                    RoundedRectangle(cornerRadius: PFRadius.control, style: .continuous)
                        .fill(color)
                        .frame(height: 36)
                        .overlay { RoundedRectangle(cornerRadius: PFRadius.control, style: .continuous).strokeBorder(PFColor.hairline, lineWidth: 1) }
                    Text(name).pfText(.caption).foregroundStyle(PFColor.textMuted).lineLimit(1).minimumScaleFactor(0.7)
                }
            }
        }
    }
}

// MARK: - Buttons

private struct CatalogButtons: View {
    var body: some View {
        CatalogSection("Buttons") {
            CatalogCard {
                CatalogRow("PFButton — kinds") {
                    PFChipRow {
                        PFButton("Primary") {}
                        PFButton("Secondary", kind: .secondary) {}
                        PFButton("Ghost", kind: .ghost) {}
                        PFButton("Danger", kind: .danger) {}
                    }
                    .padding(.horizontal, -PFSpace.page)
                }
                CatalogRow("PFButton — sizes, icon, tinted, glass, disabled") {
                    CatalogScrollRow {
                        PFButton("Small", systemImage: "plus", size: .small) {}
                        PFButton("Medium", systemImage: "checkmark") {}
                        PFButton("Tinted", kind: .tinted(PFColor.success), size: .small) {}
                        PFButton("Glass", kind: .glass, size: .small) {}
                        PFButton("Off") {}.disabled(true)
                    }
                }
                PFButton("Large, full width", systemImage: "arrow.right", size: .large, fullWidth: true) {}
                CatalogRow("PFIconButton — glass, raised, primary, plain") {
                    CatalogScrollRow {
                        PFIconButton("xmark", label: "Close", style: .glass) {}
                        PFIconButton("ellipsis", label: "More", style: .raised) {}
                        PFIconButton("plus", label: "Add", style: .primary) {}
                        PFIconButton("chevron.left", label: "Back", style: .plain) {}
                    }
                }
            }
        }
    }
}

// MARK: - Indicators

private struct CatalogIndicators: View {
    @State private var checks: [Bool] = [false, false, true, false]

    var body: some View {
        CatalogSection("Pills, signals, rings") {
            CatalogCard {
                CatalogRow("PFPill — status") {
                    PFChipRow {
                        ForEach(TaskStatus.workflow, id: \.self) { status in PFPill(status.label, tone: .status(status.tone)) }
                    }
                    .padding(.horizontal, -PFSpace.page)
                }
                CatalogRow("PFPill — severity, neutral, compact, leading, PFCountPill") {
                    CatalogScrollRow {
                        PFPill("Overdue", tone: .severity(.overdue))
                        PFPill("Today", tone: .severity(.due))
                        PFPill("Neutral")
                        PFPill("Compact", tone: .status(.review), compact: true)
                        PFPill("Lead", tone: .status(.inProgress)) { PFDot(PFColor.statusBase(.inProgress), size: 6) }
                        PFCountPill(4)
                        PFCountPill(12, tint: PFColor.danger)
                    }
                }
                CatalogRow("PFPrioritySignal — none, low, medium, high, urgent") {
                    HStack(spacing: 18) {
                        PFPrioritySignal(nil)
                        ForEach(TaskPriority.allCases, id: \.self) { PFPrioritySignal($0) }
                    }
                }
                CatalogRow("PFRingCheck — neutral, overdue, due, done, suggested") {
                    HStack(spacing: 0) {
                        PFRingCheck(isOn: checks[0], severity: .neutral, label: "Check") { checks[0].toggle() }
                        PFRingCheck(isOn: checks[1], severity: .overdue, label: "Check") { checks[1].toggle() }
                        PFRingCheck(isOn: checks[2], severity: .due, label: "Check") { checks[2].toggle() }
                        PFRingCheck(isOn: checks[3], severity: .neutral, dashed: true, label: "Check") { checks[3].toggle() }
                    }
                }
                CatalogRow("PFDayBand") {
                    VStack(spacing: 10) {
                        PFDayBand(segments: segments(["overdue", "overdue", "due", "due", "waiting", "free"]))
                        PFDayBand(segments: segments(["due", "due", "free"]))
                        PFDayBand(segments: segments(["free"]))
                    }
                }
                CatalogRow("PFAvatar — sizes, ring; PFAvatarStack") {
                    CatalogScrollRow {
                        PFAvatar(name: "Anna Weber", size: 24)
                        PFAvatar(name: "Ben Kruse", size: 32)
                        PFAvatar(name: "Cem Yilmaz", size: 40, ring: true)
                        PFAvatarStack(people: [("1", "Anna Weber", nil), ("2", "Ben Kruse", nil), ("3", "Cem Yilmaz", nil),
                                               ("4", "Dana Roth", nil), ("5", "Eli Stein", nil)])
                    }
                }
                CatalogRow("PFHealthRing — none, 20, 55, 90; PFProgressBar") {
                    CatalogScrollRow {
                        PFHealthRing(score: nil)
                        PFHealthRing(score: 20)
                        PFHealthRing(score: 55)
                        PFHealthRing(score: 90, size: 48, lineWidth: 5)
                    }
                    VStack(spacing: 8) {
                        PFProgressBar(value: 0)
                        PFProgressBar(value: 0.35)
                        PFProgressBar(value: 1, height: 10)
                    }
                }
                CatalogRow("PFDot, PFPulseDot") {
                    HStack(spacing: 16) {
                        PFDot(PFColor.success)
                        PFDot(PFColor.warning)
                        PFDot(PFColor.danger)
                        PFPulseDot()
                    }
                }
            }
        }
    }

    private func segments(_ kinds: [String]) -> [PFBandSegment] {
        kinds.enumerated().map { index, raw in
            let kind: PFBandSegment.Kind = switch raw { case "overdue": .overdue; case "due": .due; case "waiting": .waiting; default: .free }
            return PFBandSegment(id: "c\(index)", kind: kind)
        }
    }
}

// MARK: - Inputs

private struct CatalogInputs: View {
    @State private var segment = "a"
    @State private var chip = "open"
    @State private var isOn = true
    @State private var text = ""
    @State private var notes = ""
    @State private var date: Date?

    var body: some View {
        CatalogSection("Inputs") {
            CatalogCard {
                CatalogRow("PFSegmented") {
                    PFSegmented([("a", "Heute"), ("b", "Woche"), ("c", "Alle")], selection: $segment)
                }
                CatalogRow("PFChip / PFChipRow — set, unset, icon, chevron") {
                    PFChipRow {
                        PFChip("Offen", isSet: chip == "open") { chip = "open" }
                        PFChip("Erledigt", isSet: chip == "done") { chip = "done" }
                        PFChip("Datum", systemImage: "calendar", showsChevron: true) {}
                        PFChip("Priorität", systemImage: "flag") {}
                    }
                    .padding(.horizontal, -PFSpace.page)
                }
                CatalogRow("PFSwitch") {
                    PFSwitch("Erinnerung", isOn: $isOn)
                }
                CatalogRow("PFTextField — single line, multi-line") {
                    VStack(spacing: 10) {
                        PFTextField("Aufgabe suchen", text: $text, systemImage: "magnifyingglass")
                        PFTextField("Notiz", text: $notes, axis: .vertical)
                    }
                }
                CatalogRow("PFDateStrip") {
                    PFDateStrip(quick: Formatting.quickDates.map { PFDateStrip.Quick(id: $0.id, label: $0.label, date: Formatting.date($0.value)) },
                                days: 14, calendar: Formatting.calendar, locale: L10n.locale, selection: $date)
                        .padding(.horizontal, -PFSpace.page)
                }
            }
        }
    }
}

// MARK: - Lists

private struct CatalogLists: View {
    @Environment(AppModel.self) private var model
    @State private var done = false

    var body: some View {
        CatalogSection("Lists") {
            CatalogRow("PFCardList with PFSwipeRow (swipe right: done, left: actions; long-press: peek)") {
                PFCardList {
                    row("Set up 301 redirects", due: "Seit 3 Tagen überfällig", severity: .overdue, priority: .urgent)
                    row("Finalize hero copy", due: "Heute fällig", severity: .due, priority: .high)
                    row("Onboarding screens", due: "Freitag", severity: .neutral, priority: .medium)
                }
            }
            CatalogRow("PFEmptyState") {
                PFEmptyState(systemImage: "checkmark.circle", title: "Alles erledigt", message: "Für heute ist nichts offen.",
                             actionTitle: "Erfassen") {}
                    .frame(maxWidth: .infinity)
                    .pfCard(padding: PFSpace.m)
            }
            CatalogRow("PFSkeleton") {
                VStack(spacing: 10) {
                    PFSkeleton(height: 18)
                    PFSkeleton(height: 12).frame(maxWidth: 220)
                    PFSkeleton(height: 56, radius: PFRadius.card)
                }
            }
        }
    }

    private func row(_ title: String, due: String, severity: Severity, priority: TaskPriority) -> some View {
        PFSwipeRow(leading: PFSwipeAction("Erledigt", systemImage: "checkmark", tint: PFColor.success) { done.toggle() },
                   trailing: [PFSwipeAction("Später", systemImage: "clock", tint: PFColor.primary, foreground: PFColor.onPrimary) {}]) {
            HStack(spacing: 2) {
                PFRingCheck(isOn: false, severity: severity, label: "Check") {}.padding(.leading, 3)
                VStack(alignment: .leading, spacing: 3) {
                    Text(title).pfText(.rowTitle).foregroundStyle(PFColor.textMain).lineLimit(1)
                    Text(due).pfText(.meta).foregroundStyle(PFColor.severityText(severity))
                }
                Spacer(minLength: 0)
                PFPrioritySignal(priority).padding(.trailing, PFSpace.m)
            }
            .frame(minHeight: 56)
            .pfPeek(model.presenter, actions: {
                [PFPeekAction("Erledigt", systemImage: "checkmark") {}, PFPeekAction("Löschen", systemImage: "trash", role: .destructive) {}]
            }, preview: {
                VStack(alignment: .leading, spacing: 8) {
                    PFEyebrow("Website Relaunch")
                    Text(title).pfText(.title).foregroundStyle(PFColor.textMain)
                    PFPill(due, tone: .severity(severity))
                }
                .padding(PFSpace.l)
                .frame(maxWidth: .infinity, alignment: .leading)
            })
        }
    }
}

// MARK: - Feedback and overlays

private struct CatalogFeedback: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        CatalogSection("Feedback and overlays") {
            CatalogCard {
                PFStatusBanner(L10n.t("common.offline"))
                CatalogRow("PFToast — neutral, success, warning, error; PFPresenter sheet") {
                    PFChipRow {
                        PFChip("Toast") { model.toasts.show(PFToast("Gespeichert")) }
                        PFChip("Success") { model.toasts.show(PFToast("Aufgabe erledigt", style: .success, actionTitle: "Rückgängig") {}) }
                        PFChip("Warning") { model.toasts.show(PFToast("Offline", style: .warning)) }
                        PFChip("Error") { model.toasts.show(PFToast("Das hat nicht geklappt.", style: .error)) }
                        PFChip("Sheet", systemImage: "rectangle.bottomthird.inset.filled") { presentSheet() }
                    }
                    .padding(.horizontal, -PFSpace.page)
                }
            }
        }
    }

    private func presentSheet() {
        let presenter = model.presenter
        presenter.present(detents: [.fraction(0.4), .large]) {
            VStack(alignment: .leading, spacing: PFSpace.m) {
                PFEyebrow("Sheet")
                Text("Eigene Sheets mit Rastpunkten").pfText(.title).foregroundStyle(PFColor.textMain)
                Text("Ziehen zum Wechseln des Rastpunkts, nach unten wischen zum Schließen.").pfText(.body).foregroundStyle(PFColor.textMuted)
                PFButton("Schließen", kind: .ghost, fullWidth: true) { presenter.dismiss() }
            }
            .padding(PFSpace.l)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

// MARK: - Chrome

private struct CatalogChrome: View {
    @State private var tab = "today"

    var body: some View {
        CatalogSection("Chrome") {
            CatalogRow("PFTopBar") {
                PFTopBar(title: "Website Relaunch", backLabel: "Back", onBack: {}) {
                    PFIconButton("ellipsis", label: "More", style: .glass) {}
                }
            }
            CatalogRow("PFFocusBar — running, blocked") {
                VStack(spacing: 10) {
                    PFFocusBar(title: "Set up 301 redirects", subtitle: "seit 14:20", completeLabel: "Erledigt", onOpen: {}, onComplete: {})
                    PFFocusBar(title: "Onboarding screens", subtitle: "Blockiert", completeLabel: "Erledigt", isBlocked: true, onOpen: {}, onComplete: {})
                }
            }
            CatalogRow("PFDock") {
                PFDock(items: [PFDockItem(id: "today", title: "Heute", systemImage: "sun.horizon"),
                               PFDockItem(id: "work", title: "Arbeit", systemImage: "checklist"),
                               PFDockItem(id: "projects", title: "Projekte", systemImage: "square.stack.3d.up"),
                               PFDockItem(id: "inbox", title: "Eingang", systemImage: "tray", badge: 3)],
                       selection: $tab, searchLabel: "Suche", isSearchSelected: false, onSearch: {}, onReselect: { _ in })
            }
            CatalogRow("Elevation — card, lifted, overlay") {
                HStack(spacing: 14) {
                    ForEach([PFElevation.card, .lifted, .overlay], id: \.self) { level in
                        RoundedRectangle(cornerRadius: PFRadius.card, style: .continuous)
                            .fill(PFColor.card)
                            .frame(height: 64)
                            .pfElevation(level)
                    }
                }
            }
        }
    }
}

// MARK: - Widgets, Live Activity, Share

/// The real widget and Live Activity views at their system sizes (non-interactive here).
private struct CatalogSystem: View {
    private let snapshot = TodaySnapshot.preview
    private var entry: TodayEntry { TodayEntry(date: .now, snapshot: snapshot) }
    private var focusEntry: FocusEntry { FocusEntry(date: .now, snapshot: snapshot) }
    private var strings: ExtensionStrings { ExtensionStrings(language: snapshot.language) }

    var body: some View {
        CatalogSection("Widgets") {
            CatalogRow("Heute — small 158×158, medium 338×158, large 338×354") {
                VStack(alignment: .leading, spacing: 14) {
                    tile(TodaySmallView(entry: entry), width: 158, height: 158)
                    tile(TodayMediumView(entry: entry), width: 338, height: 158)
                    tile(TodayLargeView(entry: entry), width: 338, height: 354)
                }
            }
            CatalogRow("Heute — Zustände: signed out, new day, empty") {
                CatalogScrollRow {
                    tile(TodaySmallView(entry: TodayEntry(date: .now, snapshot: .signedOut)), width: 158, height: 158)
                    tile(TodaySmallView(entry: TodayEntry(date: .now.addingTimeInterval(172_800), snapshot: snapshot)), width: 158, height: 158)
                    tile(TodaySmallView(entry: TodayEntry(date: .now, snapshot: TodaySnapshot(workspaceName: "Demo", headline: "Alles erledigt. Gönn dir die Pause.", summary: "", band: ["free"], overdueCount: 0, dueTodayCount: 0, stops: [], moreCount: 0, focus: nil, language: "de"))), width: 158, height: 158)
                }
            }
            CatalogRow("Fokus — small, medium, paused, empty") {
                VStack(alignment: .leading, spacing: 14) {
                    CatalogScrollRow {
                        tile(FocusSmallView(entry: focusEntry), width: 158, height: 158)
                        tile(FocusSmallView(entry: FocusEntry(date: .now, snapshot: TodaySnapshot(workspaceName: "", headline: "", summary: "", band: [], overdueCount: 0, dueTodayCount: 0, stops: [], moreCount: 0, focus: nil, language: "de"))), width: 158, height: 158)
                    }
                    tile(FocusMediumView(entry: focusEntry), width: 338, height: 158)
                    tile(FocusMediumView(entry: FocusEntry(date: .now, snapshot: paused)), width: 338, height: 158)
                }
            }
            CatalogRow("Lock screen — rectangular, circular, inline") {
                CatalogScrollRow {
                    accessory(TodayAccessoryRectangularView(entry: entry), width: 170, height: 72)
                    accessory(TodayAccessoryCircularView(entry: entry), width: 72, height: 72)
                    accessory(FocusAccessoryRectangularView(entry: focusEntry), width: 170, height: 72)
                }
                accessory(TodayAccessoryInlineView(entry: entry), width: 220, height: 24)
                accessory(FocusAccessoryInlineView(entry: focusEntry), width: 260, height: 24)
            }
        }
        CatalogSection("Live Activity") {
            CatalogRow("Lock screen — running, paused, blocked") {
                VStack(spacing: 12) {
                    lockScreen(status: "active")
                    lockScreen(status: "snoozed")
                    lockScreen(status: "blocked")
                }
            }
            CatalogRow("Dynamic Island — expanded, compact, minimal") {
                VStack(alignment: .leading, spacing: 12) {
                    island
                    CatalogScrollRow {
                        let state = contentState(status: "active")
                        HStack {
                            FocusIslandCompactLeading(state: state)
                            Spacer(minLength: 40)
                            FocusIslandCompactTrailing(state: state, strings: strings)
                        }
                        .padding(.horizontal, 10)
                        .frame(width: 190, height: 36)
                        .background(PFColor.canvas, in: .capsule)
                        FocusStatusDot(status: "active")
                            .frame(width: 36, height: 36)
                            .background(PFColor.canvas, in: .capsule)
                    }
                }
                .environment(\.colorScheme, .dark)
            }
        }
    }

    private var paused: TodaySnapshot { snapshot.settingFocusPause(until: .now.addingTimeInterval(3000)) }

    private func contentState(status: String) -> FocusActivityAttributes.ContentState {
        FocusActivityAttributes.ContentState(title: "Set up 301 redirects", projectName: "Website Relaunch",
                                             nextStep: "Mapping-Tabelle exportieren", status: status,
                                             startedAt: Date.now.addingTimeInterval(-2540).timeIntervalSince1970,
                                             snoozedUntil: status == "snoozed" ? Date.now.addingTimeInterval(1800).timeIntervalSince1970 : nil)
    }

    private func lockScreen(status: String) -> some View {
        FocusActivityLockScreenView(state: contentState(status: status), strings: strings)
            .background(PFColor.card, in: .rect(cornerRadius: 24, style: .continuous))
            .pfElevation(.card, radius: 24)
            .allowsHitTesting(false)
    }

    private var island: some View {
        let state = contentState(status: "active")
        return VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .center) {
                HStack(spacing: 7) {
                    FocusStatusDot(status: state.status)
                    WidgetEyebrow(text: focusEyebrow(status: state.status, strings: strings))
                }
                Spacer()
                FocusActivityClock(state: state, strings: strings, size: 20).frame(width: 96)
            }
            FocusIslandTitle(state: state)
            FocusActionButtons(status: state.status, strings: strings)
        }
        .padding(18)
        .frame(width: 360)
        .background(PFColor.canvas, in: .rect(cornerRadius: 44, style: .continuous))
        .allowsHitTesting(false)
    }

    private func tile(_ view: some View, width: CGFloat, height: CGFloat) -> some View {
        view
            .padding(16)
            .frame(width: width, height: height, alignment: .topLeading)
            .background(PFColor.card, in: .rect(cornerRadius: 22, style: .continuous))
            .pfElevation(.card, radius: 22)
            .allowsHitTesting(false)
    }

    private func accessory(_ view: some View, width: CGFloat, height: CGFloat) -> some View {
        view
            .padding(8)
            .frame(width: width, height: height)
            .background(PFColor.raised, in: .rect(cornerRadius: 14, style: .continuous))
            .allowsHitTesting(false)
    }
}

// MARK: - Share extension

/// The share composer inside a PFDesign sheet, with a sample link. Reads the real shared session and snapshot, so it
/// also proves that the keychain hand-over works. Saving writes a real task.
private struct CatalogShare: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        CatalogSection("Share extension") {
            CatalogRow("ShareComposerView (writes a real personal task or project task)") {
                PFChipRow {
                    PFChip("Link", systemImage: "link") { present(link: true) }
                    PFChip("Text", systemImage: "text.alignleft") { present(link: false) }
                }
                .padding(.horizontal, -PFSpace.page)
            }
        }
    }

    private func present(link: Bool) {
        let share = ShareModel(context: nil)
        if link {
            share.title = "Apple Newsroom"
            share.url = URL(string: "https://www.apple.com/newsroom/")
        } else {
            share.title = "Angebot für Studio Nord nachfassen"
            share.details = "Rückruf bis Freitag, Ansprechpartnerin Lena."
        }
        model.presenter.present(detents: [.large]) {
            ShareComposerView(model: share).frame(maxWidth: .infinity, minHeight: 520)
        }
    }
}
