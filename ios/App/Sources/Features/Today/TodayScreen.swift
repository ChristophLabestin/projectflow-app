import SwiftUI
import PFData
import PFDesign
import PFDomain
import PFModel

/// Heute (concept §5.1): the day in one sentence, the plan of at most four stops, who waits on me,
/// the week and what happened overnight. Curated, not complete — "+ N weitere" leads to Arbeit.
struct TodayScreen: View {
    @Environment(AppModel.self) private var model
    @Environment(\.scenePhase) private var scenePhase
    private let waiting = TodayWaitingStore.shared

    @State private var scrollOffset: CGFloat = 0
    @State private var now = Date()

    private var collapse: CGFloat { min(max((scrollOffset - 70) / 60, 0), 1) }

    var body: some View {
        let plan = model.workspace?.isReady == true
            ? TodayPlanner.plan(model: model, otherTasks: waiting.otherTasks, now: now)
            : nil
        ZStack(alignment: .top) {
            PFCanvas(dotted: true)
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    if let plan, let workspace = model.workspace {
                        if workspace.myTasks.isEmpty && workspace.personalTasks.isEmpty {
                            TodayFirstRun(now: now)
                        } else if model.router.todayMode == .dayClose {
                            TodayDayClose(plan: plan, now: now)
                        } else {
                            TodayContent(plan: plan, now: now)
                        }
                    } else {
                        TodaySkeleton(now: now)
                    }
                }
                .padding(.horizontal, PFSpace.page)
                .padding(.bottom, 140)
            }
            .scrollIndicators(.hidden)
            .pfScrollOffset { scrollOffset = $0 }
            .safeAreaInset(edge: .top, spacing: 0) {
                TodayTopBar(collapse: collapse, compact: plan.map(TodayText.compactTitle))
                    .background(alignment: .top) { topFade }
            }
        }
        .task { await tick() }
        .task(id: TodayPlanner.dependencyCandidates(model: model)) { await waiting.refresh(model: model) }
        .onChange(of: scenePhase) { _, phase in
            guard phase == .active else { return }
            now = .now
            Task { await waiting.refresh(model: model, force: true) }
        }
        .onChange(of: model.router.tab) { _, tab in
            guard tab == .today else { return }
            now = .now
            Task { await waiting.refresh(model: model) }
        }
        .onChange(of: snapshotKey(plan)) { _, _ in SnapshotPublisher.publish(model: model) }
    }

    /// Canvas-coloured fade under the chrome (status bar included) once content scrolls beneath it.
    private var topFade: some View {
        LinearGradient(
            stops: [.init(color: PFColor.canvas, location: 0), .init(color: PFColor.canvas, location: 0.74),
                    .init(color: PFColor.canvas.opacity(0), location: 1)],
            startPoint: .top, endPoint: .bottom
        )
        .padding(.bottom, -40)
        .ignoresSafeArea(edges: .top)
        .opacity(Double(min(max(scrollOffset / 24, 0), 1)))
        .allowsHitTesting(false)
    }

    /// Keeps the minute (and with it midnight) current without redrawing on every tick.
    private func tick() async {
        while !Task.isCancelled {
            try? await Task.sleep(for: .seconds(30))
            now = .now
        }
    }

    private func snapshotKey(_ plan: DayPlan?) -> String {
        guard let plan else { return "" }
        return plan.stops.map(\.id).joined(separator: ",") + "|\(plan.counts.overdue)|\(plan.counts.queue)|\(plan.moreCount)"
    }
}

// MARK: - Normal mode

/// Headline, cause, band and the sections below it.
private struct TodayContent: View {
    let plan: DayPlan
    let now: Date
    @Environment(AppModel.self) private var model

    var body: some View {
        let statement = TodayText.statement(plan.statement)
        VStack(alignment: .leading, spacing: 0) {
            PFEyebrow(Formatting.longToday(now)).padding(.top, PFSpace.s).pfAppear(0)

            PFEditorialHeadline(before: statement.before, value: statement.value, after: statement.after)
                .padding(.top, 10)
                .pfAppear(1)

            Text(TodayText.message(plan.cause))
                .pfText(.body)
                .foregroundStyle(PFColor.textMuted)
                .frame(maxWidth: .infinity, alignment: .leading)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, PFSpace.s)
                .pfAppear(2)

            TodayBand(plan: plan).padding(.top, PFSpace.l).pfAppear(3)

            TodayPlanSection(plan: plan, now: now).pfAppear(4)
            TodayWaitingSection(plan: plan).pfAppear(5)
            TodayWeekSection(plan: plan).pfAppear(6)
            TodayNightSection(plan: plan).pfAppear(7)
        }
    }
}

/// The segmented shape of the day plus its caption ("2 überfällig · 2 heute · der Rest des Tages ist frei").
struct TodayBand: View {
    let plan: DayPlan

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            PFDayBand(segments: plan.band.segments.map { segment in
                PFBandSegment(id: segment.key, kind: kind(segment.type), weight: CGFloat(segment.flex))
            })
            caption
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(L10n.t("today.band.label", ["summary": TodayText.summary(plan)]))
    }

    private var caption: some View {
        let parts = TodayText.caption(plan)
        return HStack(spacing: 6) {
            ForEach(Array(parts.enumerated()), id: \.element.id) { index, part in
                if index > 0 { Text("·").foregroundStyle(PFColor.textMuted) }
                Text(part.text).foregroundStyle(color(part.tone))
            }
        }
        .pfText(.metaStrong)
        .lineLimit(2)
        .animation(PFMotion.respecting(PFMotion.snappy), value: parts.map(\.text))
    }

    private func kind(_ type: DayPlanBandSegment.Kind) -> PFBandSegment.Kind {
        switch type {
        case .overdue: .overdue
        case .due: .due
        case .waiting: .waiting
        case .rest: .free
        }
    }

    private func color(_ tone: DayPlanTone) -> Color {
        switch tone {
        case .danger: PFColor.dangerText
        case .warning: PFColor.warningText
        case .success: PFColor.successText
        default: PFColor.textMuted
        }
    }
}

// MARK: - First run and loading

/// A brand-new account: nothing to plan yet.
private struct TodayFirstRun: View {
    let now: Date
    @Environment(AppModel.self) private var model

    var body: some View {
        VStack(alignment: .leading, spacing: PFSpace.l) {
            PFEyebrow(Formatting.longToday(now)).padding(.top, PFSpace.s)
            PFEmptyState(
                systemImage: "sun.horizon", title: L10n.t("today.empty.title"), message: L10n.t("today.empty.message"),
                actionTitle: L10n.t("today.empty.capture")
            ) { CaptureLauncher.present(model: model) }
            PFButton(L10n.t("today.empty.project"), systemImage: "square.stack.3d.up", kind: .ghost, fullWidth: true) {
                model.router.select(.projects)
            }
        }
        .pfAppear(0)
    }
}

/// Placeholder layout while the workspace loads.
private struct TodaySkeleton: View {
    let now: Date

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            PFEyebrow(Formatting.longToday(now)).padding(.top, PFSpace.s)
            VStack(alignment: .leading, spacing: 10) {
                PFSkeleton(height: 30, radius: 8)
                PFSkeleton(height: 30, radius: 8).padding(.trailing, 60)
                PFSkeleton(height: 16, radius: 6).padding(.trailing, 120).padding(.top, 4)
            }
            .padding(.top, 14)
            PFSkeleton(height: 13, radius: PFRadius.bandSegment).padding(.top, PFSpace.l)
            PFSkeleton(height: 12, radius: 6).padding(.trailing, 160).padding(.top, 10)
            PFSkeleton(height: 12, radius: 6).frame(width: 140).padding(.top, PFSpace.xl)
            VStack(spacing: 0) {
                ForEach(0..<4, id: \.self) { index in
                    if index > 0 { PFRowDivider() }
                    HStack(spacing: PFSpace.s) {
                        PFSkeleton(height: 22, radius: 11).frame(width: 22)
                        VStack(alignment: .leading, spacing: 6) {
                            PFSkeleton(height: 15, radius: 6).padding(.trailing, CGFloat(index) * 20)
                            PFSkeleton(height: 11, radius: 5).padding(.trailing, 90)
                        }
                    }
                    .padding(PFSpace.m)
                }
            }
            .pfCard()
            .padding(.top, PFSpace.s)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(L10n.t("today.loading"))
    }
}
