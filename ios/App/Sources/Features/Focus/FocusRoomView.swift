import SwiftUI
import PFData
import PFDesign
import PFDomain
import PFModel

/// Fokusraum (concept §5.2): one item, nothing else. Full screen, follows the theme (optional
/// "Dunkler Fokus"), shows since when the focus runs (no stopwatch — the web keeps `startedAt`
/// across pauses), the editable next step and the subtasks, and offers Blockiert · Pause · Erledigt.
private typealias RoomFocus = PFModel.FocusState

struct FocusRoomView: View {
    @Environment(AppModel.self) private var model
    @AppStorage("pf.darkFocus") private var darkFocus = false

    enum Phase: Equatable {
        case running
        /// Completing: keeps the room open while the focus state clears underneath.
        case finishing
        case finished(title: String, next: DayPlanStop?)
    }

    @State private var phase = Phase.running
    @State private var store: TaskDetailStore?
    @State private var nextStepDraft = ""
    @State private var syncedNextStep = ""
    @State private var newSubtask = ""
    @State private var dragOffset: CGFloat = 0
    @State private var isAtTop = true

    private var focus: RoomFocus? { model.profile?.focus }
    private var controller: FocusController { FocusController(model: model) }

    var body: some View {
        ZStack {
            PFCanvas(dotted: true)
            switch phase {
            case .finished(let title, let next):
                FocusFinishedView(title: title, next: next, onStart: startNext, onClose: close)
                    .transition(.opacity)
            default:
                if let focus {
                    running(focus)
                        .transition(.opacity)
                }
            }
        }
        .preferredColorScheme(darkFocus ? .dark : nil)
        .offset(y: dragOffset)
        .opacity(1 - min(dragOffset / 700, 0.35))
        .simultaneousGesture(dismissDrag)
        .animation(PFMotion.respecting(PFMotion.smooth), value: phase)
        .onChange(of: focus == nil) { _, gone in
            // Cleared elsewhere (web, Live Activity, notification action): nothing left to show.
            if gone, phase == .running { close() }
        }
        .onAppear { if focus == nil, phase == .running { close() } }
        .task(id: focus?.itemId) { await loadStore() }
        .onChange(of: store?.task?.nextStep) { _, value in syncNextStep(value) }
        .onDisappear { store?.stop() }
    }

    // MARK: Running

    private func running(_ focus: RoomFocus) -> some View {
        let isTask = focus.itemType == .task && controller.taskRef(focus) != nil
        return ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                header(focus).pfAppear(0)
                if isTask {
                    nextStep(focus).padding(.top, PFSpace.xxl).pfAppear(1)
                    subtasks(focus).padding(.top, PFSpace.xl).pfAppear(2)
                }
            }
            .padding(.horizontal, PFSpace.page)
            .padding(.top, 8)
            .padding(.bottom, 40)
        }
        .scrollBounceBehavior(.basedOnSize)
        .scrollDismissesKeyboard(.interactively)
        .pfScrollOffset { isAtTop = $0 <= 2 }
        .safeAreaInset(edge: .top, spacing: 0) { topBar(focus) }
        .safeAreaInset(edge: .bottom, spacing: 0) { actions(focus, isTask: isTask) }
    }

    private func topBar(_ focus: RoomFocus) -> some View {
        HStack(spacing: PFSpace.xs) {
            PFIconButton("chevron.down", label: L10n.t("focus.room.close")) { close() }
            Spacer(minLength: PFSpace.s)
            HStack(spacing: 6) {
                if focus.itemType == .personalTask {
                    Image(systemName: "lock.fill").font(.system(size: 11, weight: .semibold))
                    Text(L10n.t("common.personal"))
                } else if let project = model.workspace?.project(focus.projectId) {
                    Text(project.title)
                }
            }
            .pfText(.metaStrong)
            .foregroundStyle(PFColor.textMuted)
            .lineLimit(1)
        }
        .padding(.horizontal, PFSpace.page)
        .padding(.vertical, 6)
    }

    /// Status line, title and (blocked) the blocker — the red rail marks a blocked focus like the web banner.
    private func header(_ focus: RoomFocus) -> some View {
        let blocked = focus.status == .blocked
        return VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 10) {
                statusDot(focus)
                Text(statusText(focus))
                    .pfText(.eyebrow)
                    .foregroundStyle(blocked ? PFColor.dangerText : PFColor.textMuted)
            }
            Text(store?.task?.title ?? focus.title)
                .pfText(.displayLarge)
                .foregroundStyle(PFColor.textMain)
                .multilineTextAlignment(.leading)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityAddTraits(.isHeader)
            if blocked {
                VStack(alignment: .leading, spacing: 4) {
                    PFEyebrow(L10n.t("focus.blocker.eyebrow"), color: PFColor.dangerText)
                    Text(store?.task?.blockerNote ?? L10n.t("focus.blocker.none"))
                        .pfText(.body)
                        .foregroundStyle(PFColor.dangerText)
                }
            }
        }
        .padding(.leading, blocked ? 16 : 0)
        .overlay(alignment: .leading) {
            if blocked { Capsule().fill(PFColor.danger).frame(width: 3) }
        }
        .animation(PFMotion.respecting(PFMotion.snappy), value: blocked)
    }

    @ViewBuilder private func statusDot(_ focus: RoomFocus) -> some View {
        switch focus.status {
        case .active: PFPulseDot().frame(width: 16, height: 16)
        case .blocked: PFPulseDot(color: PFColor.danger).frame(width: 16, height: 16)
        case .snoozed: PFDot(PFColor.textMuted, size: 9).frame(width: 16, height: 16)
        }
    }

    private func statusText(_ focus: RoomFocus) -> String {
        switch focus.status {
        case .active:
            guard let started = focus.startedAt?.instant else { return L10n.t("focus.room.runningNoTime") }
            return L10n.t("focus.room.running", ["time": Formatting.time(started)])
        case .snoozed:
            guard let until = focus.snoozedUntil?.instant else { return L10n.t("focus.paused") }
            return L10n.t("focus.room.paused", ["time": Formatting.time(until)])
        case .blocked:
            return L10n.t("focus.room.blocked")
        }
    }

    // MARK: Next step

    private func nextStep(_ focus: RoomFocus) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            PFEyebrow(L10n.t("task.nextStep"))
            PFInlineTextField(L10n.t("focus.nextStep.placeholder"), text: $nextStepDraft, style: .title, lineLimit: 1...6) {
                commitNextStep(focus)
            }
        }
    }

    private func syncNextStep(_ value: String?) {
        let incoming = value ?? ""
        // Take over remote changes unless the user has typed something different meanwhile.
        if nextStepDraft == syncedNextStep { nextStepDraft = incoming }
        syncedNextStep = incoming
    }

    private func commitNextStep(_ focus: RoomFocus) {
        let text = nextStepDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard text != syncedNextStep, let ref = controller.taskRef(focus), let actions = model.actions else { return }
        syncedNextStep = text
        nextStepDraft = text
        PFHaptics.selection()
        Task { await model.perform { try await actions.setNextStep(ref, text) } }
    }

    // MARK: Subtasks

    private func subtasks(_ focus: RoomFocus) -> some View {
        let items = store?.subtasks ?? []
        let done = items.filter(\.isCompleted).count
        return VStack(alignment: .leading, spacing: 4) {
            HStack {
                PFEyebrow(L10n.t("focus.subtasks"))
                Spacer()
                if !items.isEmpty {
                    Text("\(done) / \(items.count)").pfText(.metaStrong).foregroundStyle(PFColor.textMuted)
                }
            }
            if !items.isEmpty {
                PFProgressBar(value: Double(done) / Double(items.count), height: 4).padding(.vertical, 6)
            }
            ForEach(items) { item in
                HStack(spacing: 2) {
                    PFRingCheck(isOn: item.isCompleted, label: item.isCompleted ? L10n.t("common.reopen") : L10n.t("common.complete")) {
                        toggle(item, focus: focus)
                    }
                    Text(item.title)
                        .pfText(.rowTitle)
                        .foregroundStyle(item.isCompleted ? PFColor.textMuted : PFColor.textMain)
                        .strikethrough(item.isCompleted, color: PFColor.textMuted)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.vertical, 10)
                }
                .frame(minHeight: 44)
                .transition(.opacity)
            }
            HStack(spacing: 2) {
                Image(systemName: "plus")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(PFColor.textMuted)
                    .frame(width: 44, height: 44)
                PFInlineTextField(L10n.t("focus.subtasks.add"), text: $newSubtask, style: .rowTitle, lineLimit: 1...3) {
                    addSubtask(focus)
                }
            }
        }
        .animation(PFMotion.respecting(PFMotion.snappy), value: items.map(\.id))
    }

    private func toggle(_ item: SubTask, focus: RoomFocus) {
        guard let ref = controller.taskRef(focus), let actions = model.actions else { return }
        Task { await model.perform { try await actions.setSubtask(ref, subtaskId: item.id, completed: !item.isCompleted) } }
    }

    private func addSubtask(_ focus: RoomFocus) {
        let title = newSubtask.trimmingCharacters(in: .whitespacesAndNewlines)
        newSubtask = ""
        guard !title.isEmpty, let ref = controller.taskRef(focus), let actions = model.actions else { return }
        PFHaptics.tap()
        Task { await model.perform { try await actions.addSubtask(ref, title: title) } }
    }

    // MARK: Actions

    private func actions(_ focus: RoomFocus, isTask: Bool) -> some View {
        HStack(spacing: PFSpace.xs) {
            switch focus.status {
            case .active:
                PFButton(L10n.t("focus.action.block"), kind: .secondary, size: .large, fullWidth: true) {
                    presentBlockerSheet()
                }
                .disabled(!isTask)
                PFButton(L10n.t("focus.action.pause"), kind: .secondary, size: .large, fullWidth: true) { pause() }
            case .snoozed:
                PFButton(L10n.t("focus.action.resume"), kind: .secondary, size: .large, fullWidth: true) {
                    Task { await controller.resume() }
                }
            case .blocked:
                PFButton(L10n.t("focus.action.unblock"), kind: .secondary, size: .large, fullWidth: true) {
                    unblock(focus)
                }
                PFButton(L10n.t("focus.action.pause"), kind: .secondary, size: .large, fullWidth: true) { pause() }
            }
            PFButton(L10n.t("focus.action.done"), systemImage: "checkmark", kind: .primary, size: .large, fullWidth: true) { complete() }
        }
        .padding(.horizontal, PFSpace.page)
        .padding(.top, PFSpace.s)
        .padding(.bottom, PFSpace.xs)
        .background {
            LinearGradient(colors: [PFColor.canvas.opacity(0), PFColor.canvas], startPoint: .top, endPoint: .init(x: 0.5, y: 0.35))
                .padding(.top, -24)
                .allowsHitTesting(false)
        }
    }

    private func presentBlockerSheet() {
        let model = model
        model.presenter.present(detents: [.fit]) {
            FocusBlockerSheet { note in
                Task { await FocusController(model: model).block(note: note) }
            }
        }
    }

    private func unblock(_ focus: RoomFocus) {
        Task {
            if let ref = controller.taskRef(focus), let actions = model.actions {
                await model.perform { try await actions.clearBlocker(ref) }
            }
            await controller.resume()
        }
    }

    /// Pause (60 min), then the first meaningful moment to ask for notification permission.
    private func pause() {
        let model = model
        Task {
            await FocusController(model: model).snooze()
            if let until = model.profile?.focus?.snoozedUntil?.instant {
                model.toasts.show(PFToast(L10n.t("focus.pausedToast", ["time": Formatting.time(until)])))
            }
            close()
            await PushRegistrar.shared.requestPermissionIfNeeded()
        }
    }

    private func complete() {
        guard let focus else { return }
        let completedId = focus.itemId
        withAnimation(PFMotion.smooth) { phase = .finishing }
        Task {
            guard let title = await controller.complete() else {
                phase = .running
                return
            }
            PFHaptics.success()
            let next = nextStop(excluding: completedId)
            withAnimation(PFMotion.smooth) { phase = .finished(title: title, next: next) }
        }
    }

    /// The next stop of today's plan after the one just finished.
    private func nextStop(excluding id: String) -> DayPlanStop? {
        guard let workspace = model.workspace,
              let plan = TodayPlanner.plan(model: model, otherTasks: TodayWaitingStore.shared.tasks(for: workspace.tenantId)) else { return nil }
        return plan.stops.first { stop in
            stop.taskId != id && stop.kind != .focus && stop.kind != .followUp && TodayPlanner.item(for: stop, workspace: workspace) != nil
        }
    }

    private func startNext(_ stop: DayPlanStop) {
        guard let workspace = model.workspace, let item = TodayPlanner.item(for: stop, workspace: workspace) else { return }
        PFHaptics.soft()
        Task {
            await WorkItemActions(model: model).startFocus(item)
            withAnimation(PFMotion.smooth) { phase = .running }
        }
    }

    // MARK: Store, closing

    private func loadStore() async {
        store?.stop()
        store = nil
        nextStepDraft = ""
        syncedNextStep = ""
        guard let focus, focus.itemType == .task, let ref = controller.taskRef(focus) else { return }
        let detail = TaskDetailStore(ref: ref)
        detail.start()
        store = detail
    }

    private func close() {
        model.router.isFocusRoomOpen = false
        dragOffset = 0
    }

    /// Swipe down to return to the focus bar (only from the top of the content).
    private var dismissDrag: some Gesture {
        DragGesture(minimumDistance: 24)
            .onChanged { value in
                guard isAtTop, value.translation.height > 0, abs(value.translation.width) < value.translation.height else { return }
                dragOffset = value.translation.height
            }
            .onEnded { value in
                if dragOffset > 120 || value.predictedEndTranslation.height > 420, dragOffset > 0 {
                    close()
                } else {
                    withAnimation(PFMotion.respecting(PFMotion.snappy)) { dragOffset = 0 }
                }
            }
    }
}

// MARK: - Finished

/// Shown after "Erledigt": a settled check, the title, and the next stop of the plan — one tap starts it.
private struct FocusFinishedView: View {
    let title: String
    let next: DayPlanStop?
    let onStart: (DayPlanStop) -> Void
    let onClose: () -> Void

    @State private var settled = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                PFIconButton("chevron.down", label: L10n.t("focus.room.close")) { onClose() }
                Spacer()
            }
            .padding(.horizontal, PFSpace.page)
            .padding(.vertical, 6)

            Spacer(minLength: PFSpace.xl)
            VStack(alignment: .leading, spacing: PFSpace.m) {
                ZStack {
                    Circle().fill(PFColor.success).frame(width: 64, height: 64).scaleEffect(settled ? 1 : 0.4)
                    CheckMark().trim(from: 0, to: settled ? 1 : 0)
                        .stroke(Color.white, style: StrokeStyle(lineWidth: 5, lineCap: .round, lineJoin: .round))
                        .frame(width: 28, height: 22)
                }
                .opacity(settled ? 1 : 0)
                PFEyebrow(L10n.t("focus.done.eyebrow"), color: PFColor.successText)
                Text(title).pfText(.displayLarge).foregroundStyle(PFColor.textMain).fixedSize(horizontal: false, vertical: true)
            }
            .padding(.horizontal, PFSpace.page)

            Spacer(minLength: PFSpace.xl)
            if let next {
                VStack(alignment: .leading, spacing: PFSpace.s) {
                    PFEyebrow(L10n.t("focus.next.eyebrow"))
                    Text(next.title).pfText(.title).foregroundStyle(PFColor.textMain).lineLimit(3)
                    Text(TodayText.subtitle(next)).pfText(.meta).foregroundStyle(PFColor.textMuted).lineLimit(2)
                    PFButton(L10n.t("focus.next.start"), systemImage: "scope", kind: .primary, size: .large, fullWidth: true) { onStart(next) }
                        .padding(.top, PFSpace.xs)
                }
                .padding(PFSpace.l)
                .frame(maxWidth: .infinity, alignment: .leading)
                .pfCard(radius: PFRadius.surface)
                .padding(.horizontal, PFSpace.page)
            } else {
                Text(L10n.t("focus.next.allClear")).pfText(.body).foregroundStyle(PFColor.textMuted).padding(.horizontal, PFSpace.page)
            }
            PFButton(L10n.t("common.done"), kind: .ghost, size: .large, fullWidth: true) { onClose() }
                .padding(.horizontal, PFSpace.page)
                .padding(.top, PFSpace.xs)
                .padding(.bottom, PFSpace.xs)
        }
        .onAppear { withAnimation(PFMotion.bouncy.delay(0.1)) { settled = true } }
    }
}

private nonisolated struct CheckMark: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: rect.minX, y: rect.midY + rect.height * 0.05))
        path.addLine(to: CGPoint(x: rect.minX + rect.width * 0.38, y: rect.maxY))
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.minY))
        return path
    }
}

// MARK: - Blocker sheet

/// Asks for the blocker note before the focus (and the task) is marked blocked.
private struct FocusBlockerSheet: View {
    let onSave: (String?) -> Void
    @Environment(PFPresenter.self) private var presenter
    @State private var note = ""

    var body: some View {
        VStack(alignment: .leading, spacing: PFSpace.m) {
            VStack(alignment: .leading, spacing: 4) {
                Text(L10n.t("focus.blockerSheet.title")).pfText(.section).foregroundStyle(PFColor.textMain)
                Text(L10n.t("focus.blockerSheet.hint")).pfText(.meta).foregroundStyle(PFColor.textMuted)
            }
            PFTextField(L10n.t("focus.blockerSheet.placeholder"), text: $note, systemImage: "exclamationmark.octagon", axis: .vertical, submitLabel: .done) { save() }
            HStack(spacing: PFSpace.s) {
                PFButton(L10n.t("common.cancel"), kind: .ghost, fullWidth: true) { presenter.dismiss() }
                PFButton(L10n.t("focus.blockerSheet.save"), kind: .danger, fullWidth: true) { save() }
            }
        }
        .padding(.horizontal, PFSpace.page)
        .padding(.bottom, PFSpace.l)
    }

    private func save() {
        let text = note.trimmingCharacters(in: .whitespacesAndNewlines)
        presenter.dismiss()
        onSave(text.isEmpty ? nil : text)
    }
}
