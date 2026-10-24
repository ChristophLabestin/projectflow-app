import SwiftUI
import PFData
import PFDesign
import PFModel

/// Flows: status, on/off switch, log, "Jetzt ausführen". Creating and editing flows stays on the web (hint at the bottom).
struct FlowsScreen: View {
    let tenantId: String
    @State private var store: FlowsStore
    @Environment(AppModel.self) private var model

    init(tenantId: String) {
        self.tenantId = tenantId
        _store = State(initialValue: FlowsStore(tenantId: tenantId))
    }

    var body: some View {
        SettingsScaffold(title: L10n.t("nav.flows"), subtitle: L10n.t("flows.subtitle")) {
            VStack(alignment: .leading, spacing: PFSpace.m) {
                if !store.isLoaded {
                    PFSkeleton(height: 120)
                } else if store.flows.isEmpty {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(L10n.t("flows.empty.title")).pfText(.rowTitle).foregroundStyle(PFColor.textMain)
                        Text(L10n.t("flows.empty.message")).pfText(.meta).foregroundStyle(PFColor.textMuted).fixedSize(horizontal: false, vertical: true)
                    }
                } else {
                    PFCardList {
                        ForEach(store.flows) { flow in FlowRow(flow: flow, tenantId: tenantId) }
                    }
                }
                Text(L10n.t("flows.mobile.webOnly")).pfText(.meta).foregroundStyle(PFColor.textSubtle).fixedSize(horizontal: false, vertical: true)
            }
            .padding(.top, PFSpace.l)
        }
        .task { store.start() }
        .onDisappear { store.stop() }
    }
}

private struct FlowRow: View {
    let flow: FlowItem
    let tenantId: String
    @Environment(AppModel.self) private var model
    @State private var enabled: Bool
    @State private var busy = false

    init(flow: FlowItem, tenantId: String) {
        self.flow = flow
        self.tenantId = tenantId
        _enabled = State(initialValue: flow.enabled)
    }

    var body: some View {
        HStack(alignment: .top, spacing: PFSpace.s) {
            Button { model.router.push(.flow(tenantId: tenantId, flowId: flow.id)) } label: {
                VStack(alignment: .leading, spacing: 3) {
                    Text(flow.name.isEmpty ? L10n.t("flows.untitled") : flow.name).pfText(.rowTitle).foregroundStyle(PFColor.textMain).lineLimit(1)
                    Text(FlowText.trigger(flow)).pfText(.meta).foregroundStyle(PFColor.textMuted).lineLimit(1)
                    FlowStatusLine(flow: flow)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .contentShape(.rect)
            }
            .buttonStyle(.pfPressable)
            PFSwitch("", isOn: Binding(get: { enabled }, set: { toggle($0) }))
                .frame(width: 52)
                .disabled(busy)
                .accessibilityLabel(L10n.t("flows.enabled"))
        }
        .padding(.horizontal, PFSpace.m)
        .padding(.vertical, 12)
        .onChange(of: flow.enabled) { _, value in enabled = value }
    }

    private func toggle(_ value: Bool) {
        enabled = value
        busy = true
        Task {
            defer { busy = false }
            do { try await FlowsData.setEnabled(tenantId: tenantId, id: flow.id, enabled: value) }
            catch {
                enabled = !value
                model.toasts.show(PFToast(FlowText.error(error, model: model), style: .error))
            }
        }
    }
}

struct FlowStatusLine: View {
    let flow: FlowItem
    var body: some View {
        HStack(spacing: 6) {
            Circle().fill(color).frame(width: 7, height: 7)
            Text(text).pfText(.meta).foregroundStyle(color == PFColor.danger ? PFColor.dangerText : PFColor.textMuted).lineLimit(1)
        }
    }
    private var text: String {
        if flow.pausedReason != nil { return L10n.t("flows.list.paused") }
        if flow.lastStatus == "failed" { return L10n.t("flows.list.lastFailed") }
        guard let last = flow.lastRunAt else { return L10n.t("flows.list.neverRun") }
        return [flow.lastStatus.map { L10n.t("flows.runStatus.\($0)") }, Formatting.relative(last)].compactMap { $0 }.joined(separator: " · ")
    }
    private var color: Color {
        if flow.pausedReason != nil { return PFColor.warning }
        if flow.lastStatus == "failed" { return PFColor.danger }
        return flow.enabled ? PFColor.success : PFColor.textSubtle
    }
}

enum FlowText {
    static func trigger(_ flow: FlowItem) -> String {
        let key = "flows.trigger.\(flow.triggerType)"
        let label = L10n.t(key) == key ? L10n.t("flows.trigger.label") : L10n.t(key)
        let actions = flow.actionTypes.map { L10n.t("flows.action.\($0)") }.joined(separator: ", ")
        return actions.isEmpty ? label : "\(label) → \(actions)"
    }

    static func error(_ error: Error, model: AppModel) -> String {
        if PlanErrorCode.code(in: error) != nil { return model.errorMessage(error) }
        let text = (error as NSError).localizedDescription
        if text.localizedCaseInsensitiveContains("permission") { return L10n.t("flows.mobile.noPermission") }
        return L10n.t("flows.mobile.error")
    }
}

/// One flow: summary, "Jetzt ausführen" (asks for a task when its actions need one), log with retry.
struct FlowDetailScreen: View {
    let tenantId: String
    let flowId: String
    @Environment(AppModel.self) private var model
    @State private var store: FlowsStore
    @State private var runs: [FlowRun]?
    @State private var running = false

    init(tenantId: String, flowId: String) {
        self.tenantId = tenantId
        self.flowId = flowId
        _store = State(initialValue: FlowsStore(tenantId: tenantId))
    }

    private var flow: FlowItem? { store.flows.first { $0.id == flowId } }

    var body: some View {
        SettingsScaffold(title: flow?.name ?? "", subtitle: flow.map(FlowText.trigger)) {
            VStack(alignment: .leading, spacing: PFSpace.l) {
                if let flow {
                    FlowStatusLine(flow: flow)
                    PFButton(L10n.t("flows.run.now"), systemImage: "play.fill", kind: .primary, size: .large, fullWidth: true) { runNow(flow) }
                        .disabled(running)
                }
                VStack(alignment: .leading, spacing: PFSpace.xs) {
                    PFEyebrow(L10n.t("flows.log.title"))
                    Text(L10n.t("flows.log.hint")).pfText(.meta).foregroundStyle(PFColor.textMuted)
                    if let runs {
                        if runs.isEmpty {
                            Text(L10n.t("flows.log.empty")).pfText(.body).foregroundStyle(PFColor.textMuted)
                        } else {
                            PFCardList { ForEach(runs) { run in runRow(run) } }
                        }
                    } else {
                        PFSkeleton(height: 100)
                    }
                }
            }
            .padding(.top, PFSpace.l)
        }
        .task {
            store.start()
            await loadRuns()
        }
        .onDisappear { store.stop() }
    }

    private func runRow(_ run: FlowRun) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(L10n.t("flows.runStatus.\(run.status)")).pfText(.rowTitle)
                    .foregroundStyle(run.status == "failed" ? PFColor.dangerText : run.status == "succeeded" ? PFColor.successText : PFColor.textMain)
                Spacer()
                if let started = run.startedAt { Text(Formatting.relative(started)).pfText(.meta).foregroundStyle(PFColor.textMuted) }
            }
            if let error = run.error, !error.isEmpty {
                Text(error).pfText(.meta).foregroundStyle(PFColor.dangerText).fixedSize(horizontal: false, vertical: true)
            }
            if let skip = run.skipReason {
                Text(L10n.t("flows.log.skip.\(skip)")).pfText(.meta).foregroundStyle(PFColor.textMuted).fixedSize(horizontal: false, vertical: true)
            }
            ForEach(Array(run.steps.enumerated()), id: \.offset) { _, step in
                HStack(alignment: .top, spacing: 6) {
                    Text("•").foregroundStyle(PFColor.textMuted)
                    Text([L10n.t("flows.log.step.\(step.status)"), step.error].compactMap { $0 }.joined(separator: ": "))
                        .pfText(.meta).foregroundStyle(step.status == "failed" ? PFColor.dangerText : PFColor.textMuted)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            HStack(spacing: PFSpace.xs) {
                if let taskId = run.taskId, let projectId = run.projectId {
                    PFButton(L10n.t("flows.log.openTask"), kind: .ghost, size: .small) {
                        model.router.push(.task(TaskRef(tenantId: tenantId, projectId: projectId, taskId: taskId)))
                    }
                }
                if run.status == "failed" {
                    PFButton(L10n.t("flows.log.retry"), kind: .secondary, size: .small) { retry(run) }
                }
            }
        }
        .padding(.horizontal, PFSpace.m)
        .padding(.vertical, 12)
    }

    private func loadRuns() async { runs = await FlowsData.runs(tenantId: tenantId, flowId: flowId) ?? [] }

    private func runNow(_ flow: FlowItem) {
        guard flow.needsTask else { execute(flow, projectId: flow.projectId, taskId: nil); return }
        // Task actions need a task: pick one (project flows: that project; workspace flows: my tasks).
        let tasks = (model.workspace?.myTasks ?? []).filter { flow.projectId == nil || $0.projectId == flow.projectId }.filter { !$0.isCompleted }
        let model = model
        model.presenter.present(detents: [.fit, .large]) {
            OptionSheet(title: L10n.t("flows.run.onTask"), options: tasks.prefix(40).map { task in
                .init(id: "\(task.projectId)/\(task.id)", label: task.title, isSelected: false) { Image(systemName: "checklist") }
            }) { id in
                let parts = id.split(separator: "/").map(String.init)
                guard parts.count == 2 else { return }
                execute(flow, projectId: parts[0], taskId: parts[1])
            }
        }
    }

    private func execute(_ flow: FlowItem, projectId: String?, taskId: String?) {
        running = true
        Task {
            defer { running = false }
            do {
                let status = try await FlowsData.run(tenantId: tenantId, id: flow.id, projectId: projectId, taskId: taskId)
                model.toasts.show(PFToast(L10n.t(status == "failed" ? "flows.run.failed" : "flows.run.done"), style: status == "failed" ? .error : .success))
            } catch {
                model.toasts.show(PFToast(FlowText.error(error, model: model), style: .error))
            }
            await loadRuns()
        }
    }

    private func retry(_ run: FlowRun) {
        Task {
            do { try await FlowsData.retry(tenantId: tenantId, runId: run.id) }
            catch { model.toasts.show(PFToast(L10n.t("flows.log.retryFailed"), style: .error)) }
            await loadRuns()
        }
    }
}
