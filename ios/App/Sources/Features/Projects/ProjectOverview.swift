import SwiftUI
import PFData
import PFDesign
import PFModel

/// "Überblick" tab: momentum → what burns → next milestone → initiatives → team → what happened.
struct ProjectOverviewView: View {
    let store: ProjectStore
    let pulse: ProjectPulse
    let health: HealthSnapshot?
    let onSelectTab: (ProjectTab) -> Void
    let onShowActivity: () -> Void

    @Environment(AppModel.self) private var model

    var body: some View {
        VStack(alignment: .leading, spacing: PFSpace.xl) {
            momentum
            if !pulse.burning.isEmpty { burning }
            if let milestone = pulse.nextMilestone { milestoneCard(milestone) }
            if !store.initiatives.isEmpty { initiatives }
            workload
            recentActivity
        }
        .padding(.horizontal, PFSpace.page)
        .padding(.top, PFSpace.l)
    }

    // MARK: Momentum

    private var momentum: some View {
        let s = pulse.summary
        return HStack(alignment: .center, spacing: PFSpace.l) {
            VStack(spacing: 8) {
                CockpitRing(value: s.progress)
                Text(L10n.t("projects.pulse.doneOf", ["done": s.done, "total": s.total]))
                    .pfText(.caption).foregroundStyle(PFColor.textMuted).multilineTextAlignment(.center)
                    .frame(width: 104)
            }
            VStack(spacing: 0) {
                HStack(spacing: 0) {
                    stat(L10n.t("projects.stat.open"), s.open, PFColor.textMain)
                    stat(L10n.t("projects.stat.overdue"), s.overdue, s.overdue > 0 ? PFColor.dangerText : PFColor.textMain)
                }
                Rectangle().fill(PFColor.hairline).frame(height: 1).padding(.vertical, 10)
                HStack(spacing: 0) {
                    stat(L10n.t("projects.stat.blocked"), s.blocked, s.blocked > 0 ? PFColor.dangerText : PFColor.textMain)
                    stat(L10n.t("projects.stat.soon"), s.soon, s.soon > 0 ? PFColor.warningText : PFColor.textMain)
                }
            }
        }
        .padding(PFSpace.l)
        .frame(maxWidth: .infinity)
        .pfCard(radius: PFRadius.surface)
        .overlay(alignment: .topTrailing) {
            if health?.score != nil {
                PFHealthRing(score: health?.score, size: 30, lineWidth: 3)
                    .padding(PFSpace.s)
                    .accessibilityLabel(L10n.t("projects.pulse.health"))
            }
        }
    }

    private func stat(_ label: String, _ value: Int, _ color: Color) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text("\(value)")
                .font(.system(size: 26, weight: .heavy, design: .rounded))
                .monospacedDigit()
                .foregroundStyle(color)
                .contentTransition(.numericText())
            Text(label).pfText(.caption).foregroundStyle(PFColor.textMuted).lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }

    // MARK: Burning

    private var burning: some View {
        let shown = Array(pulse.burning.prefix(3))
        let more = pulse.burning.count - shown.count
        return VStack(alignment: .leading, spacing: PFSpace.xs) {
            sectionHeader(L10n.t("projects.overview.burning"), dot: PFColor.danger, count: pulse.burning.count)
            VStack(spacing: 0) {
                ForEach(Array(shown.enumerated()), id: \.element.id) { index, task in
                    if index > 0 { PFRowDivider(leadingInset: 46) }
                    WorkItemRow(item: .task(task), showsProject: false)
                }
                if more > 0 {
                    PFRowDivider()
                    Button { onSelectTab(.list) } label: {
                        HStack {
                            Text(L10n.plural("projects.overview.burning.more", more)).pfText(.metaStrong).foregroundStyle(PFColor.textMuted)
                            Spacer()
                            Image(systemName: "chevron.right").font(.system(size: 11, weight: .bold)).foregroundStyle(PFColor.textSubtle)
                        }
                        .padding(.horizontal, PFSpace.m)
                        .frame(minHeight: 46)
                        .contentShape(.rect)
                    }
                    .buttonStyle(.pfPressable)
                }
            }
            .clipShape(.rect(cornerRadius: PFRadius.card, style: .continuous))
            .pfCard()
        }
    }

    // MARK: Milestone

    private func milestoneCard(_ milestone: Milestone) -> some View {
        let linked = store.tasks.filter { milestone.linkedTaskIds.contains($0.id) }
        let done = linked.filter(\.isCompleted).count
        let days = milestone.dueDate.map { Formatting.dayOffset($0) }
        return VStack(alignment: .leading, spacing: PFSpace.xs) {
            sectionHeader(L10n.t("projects.overview.milestone"), dot: nil, count: nil)
            Button { onSelectTab(.plan) } label: {
                HStack(alignment: .center, spacing: PFSpace.m) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(milestone.title).pfText(.rowTitle).foregroundStyle(PFColor.textMain).lineLimit(2).multilineTextAlignment(.leading)
                        if let due = milestone.dueDate {
                            Text(Formatting.weekday(due) + ", " + Formatting.shortDate(due)).pfText(.meta).foregroundStyle(PFColor.textMuted)
                        }
                        if !linked.isEmpty {
                            Text(L10n.t("projects.overview.milestone.linked", ["done": done, "total": linked.count]))
                                .pfText(.meta).foregroundStyle(PFColor.textMuted)
                            PFProgressBar(value: Double(done) / Double(linked.count), height: 4).padding(.top, 2)
                        }
                    }
                    Spacer(minLength: 0)
                    if let days { countdown(days) }
                }
                .padding(PFSpace.m)
                .frame(maxWidth: .infinity, alignment: .leading)
                .pfCard()
                .contentShape(.rect)
            }
            .buttonStyle(.pfPressable)
            .accessibilityElement(children: .combine)
        }
    }

    private func countdown(_ days: Int) -> some View {
        let tint: Color = days < 0 ? PFColor.dangerText : (days <= 7 ? PFColor.warningText : PFColor.textMain)
        return VStack(spacing: 0) {
            Text(days == 0 ? "0" : "\(abs(days))")
                .font(.system(size: 34, weight: .heavy, design: .rounded))
                .monospacedDigit()
                .foregroundStyle(tint)
            Text(days < 0 ? L10n.t("projects.overview.milestone.late") : L10n.plural("projects.overview.milestone.days", abs(days)))
                .pfText(.caption).foregroundStyle(PFColor.textMuted)
        }
        .frame(minWidth: 64)
    }

    // MARK: Initiatives

    private var initiatives: some View {
        VStack(alignment: .leading, spacing: PFSpace.xs) {
            sectionHeader(L10n.t("projects.initiatives.title"), dot: nil, count: store.initiatives.count)
            VStack(spacing: 0) {
                ForEach(Array(store.initiatives.enumerated()), id: \.element.id) { index, initiative in
                    if index > 0 { PFRowDivider() }
                    initiativeRow(initiative)
                }
            }
            .clipShape(.rect(cornerRadius: PFRadius.card, style: .continuous))
            .pfCard()
        }
    }

    private func initiativeRow(_ initiative: Initiative) -> some View {
        let tasks = store.tasks.filter { $0.initiativeId == initiative.id }
        let done = tasks.filter(\.isCompleted).count
        let progress = tasks.isEmpty ? 0 : Double(done) / Double(tasks.count)
        return Button {
            PFHaptics.soft()
            model.router.push(.initiative(tenantId: store.tenantId, projectId: store.projectId, initiativeId: initiative.id))
        } label: {
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: PFSpace.xs) {
                    PFDot(initiative.health?.dot ?? PFColor.textSubtle)
                    Text(initiative.title).pfText(.rowTitle).foregroundStyle(PFColor.textMain).lineLimit(1)
                    Spacer(minLength: 0)
                    Text(initiative.health?.label ?? initiative.statusLabel).pfText(.metaStrong).foregroundStyle(initiative.health?.tintText ?? PFColor.textMuted)
                }
                if !tasks.isEmpty {
                    HStack(spacing: PFSpace.s) {
                        PFProgressBar(value: progress, height: 4)
                        Text(L10n.t("projects.overview.initiative.count", ["done": done, "total": tasks.count]))
                            .pfText(.caption).monospacedDigit().foregroundStyle(PFColor.textMuted).fixedSize()
                    }
                }
            }
            .padding(.horizontal, PFSpace.m)
            .padding(.vertical, PFSpace.s)
            .frame(minHeight: 60)
            .contentShape(.rect)
        }
        .buttonStyle(.pfPressable)
        .accessibilityElement(children: .combine)
    }

    // MARK: Workload

    private struct Load: Identifiable {
        let id: String
        let name: String
        let photo: String?
        let open: Int
    }

    private var loads: [Load] {
        var counts: [String: Int] = [:]
        for task in store.tasks where !task.isCompleted {
            for id in task.assigneeIds { counts[id, default: 0] += 1 }
        }
        let people = model.workspace?.people ?? [:]
        let members = Set(store.project?.memberIds ?? []).union(store.project?.members.map(\.userId) ?? [])
        var ids = Set(counts.keys).union(members)
        ids = ids.filter { people[$0] != nil }
        return ids.map { id in
            Load(id: id, name: people[id]?.displayName ?? "—", photo: people[id]?.photoURL, open: counts[id] ?? 0)
        }
        .sorted { ($0.open, $1.name) > ($1.open, $0.name) }
    }

    @ViewBuilder
    private var workload: some View {
        let loads = loads
        if !loads.isEmpty {
            VStack(alignment: .leading, spacing: PFSpace.xs) {
                sectionHeader(L10n.t("projects.overview.team"), dot: nil, count: nil, action: (L10n.t("projects.overview.team.all"), { onSelectTab(.team) }))
                ScrollView(.horizontal) {
                    HStack(spacing: PFSpace.s) {
                        ForEach(loads.prefix(10)) { load in
                            VStack(spacing: 6) {
                                PFAvatar(name: load.name, seed: load.id, imageURL: load.photo, size: 46)
                                    .overlay(alignment: .topTrailing) {
                                        if load.open > 0 {
                                            Text("\(load.open)")
                                                .pfText(.caption).fontWeight(.bold).foregroundStyle(PFColor.onPrimary)
                                                .padding(.horizontal, 5).frame(minWidth: 18, minHeight: 18)
                                                .background(PFColor.primary, in: .capsule)
                                                .overlay { Capsule().strokeBorder(PFColor.card, lineWidth: 2) }
                                                .offset(x: 6, y: -4)
                                        }
                                    }
                                Text(load.name.split(separator: " ").first.map(String.init) ?? load.name)
                                    .pfText(.caption).foregroundStyle(PFColor.textMuted).lineLimit(1)
                            }
                            .frame(width: 62)
                            .accessibilityElement(children: .ignore)
                            .accessibilityLabel(Text("\(load.name), " + L10n.plural("projects.summary.open", load.open)))
                        }
                    }
                    .padding(.horizontal, PFSpace.m)
                    .padding(.vertical, PFSpace.s)
                }
                .scrollIndicators(.hidden)
                .frame(maxWidth: .infinity, alignment: .leading)
                .pfCard()
            }
        }
    }

    // MARK: Activity

    @ViewBuilder
    private var recentActivity: some View {
        if !store.activity.isEmpty {
            VStack(alignment: .leading, spacing: PFSpace.xs) {
                sectionHeader(L10n.t("projects.overview.activity"), dot: nil, count: nil, action: (L10n.t("projects.overview.activity.all"), onShowActivity))
                VStack(spacing: 0) {
                    ForEach(Array(store.activity.prefix(3).enumerated()), id: \.element.id) { index, entry in
                        if index > 0 { PFRowDivider(leadingInset: 56) }
                        ActivityRow(entry: entry)
                    }
                }
                .clipShape(.rect(cornerRadius: PFRadius.card, style: .continuous))
                .pfCard()
            }
        }
    }

    // MARK: Pieces

    private func sectionHeader(_ title: String, dot: Color?, count: Int?, action: (String, () -> Void)? = nil) -> some View {
        HStack(spacing: 6) {
            if let dot { PFDot(dot, size: 7) }
            PFEyebrow(title)
            if let count { PFCountPill(count) }
            Spacer(minLength: 0)
            if let action {
                Button(action: action.1) {
                    Text(action.0).pfText(.metaStrong).foregroundStyle(PFColor.textMuted).frame(minHeight: 28)
                }
                .buttonStyle(.pfPressable)
            }
        }
        .padding(.horizontal, 2)
    }
}

private extension InitiativeHealth {
    var tintText: Color {
        switch self {
        case .onTrack: PFColor.successText
        case .atRisk: PFColor.warningText
        default: PFColor.dangerText
        }
    }
}
