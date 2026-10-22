import SwiftUI
import PFDesign
import PFModel

/// The capture sheet (concept §5.3): big title field with live token highlights, target row, chip bar
/// above the keyboard (Datum · Projekt · Priorität · Wer) and "Als Fokus starten".
struct CaptureComposerView: View {
    @Bindable var capture: CaptureModel
    @Environment(AppModel.self) private var model

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            header
            CaptureTextField(
                text: Binding(get: { capture.text }, set: { capture.setText($0) }),
                isFocused: $capture.isFocused,
                placeholder: L10n.t("capture.placeholder"),
                highlights: capture.highlights,
                onTapHighlight: { capture.dismissToken(at: $0) },
                onSubmit: { capture.save() }
            )
            .padding(.horizontal, PFSpace.page)
            .padding(.top, PFSpace.xs)

            if capture.text.isEmpty {
                Text(L10n.t("capture.hint"))
                    .pfText(.meta)
                    .foregroundStyle(PFColor.textMuted)
                    .padding(.horizontal, PFSpace.page)
                    .padding(.top, 2)
                    .transition(.opacity)
            }

            targetRow
                .padding(.horizontal, PFSpace.page)
                .padding(.top, PFSpace.s)

            if capture.offersFocus {
                PFSwitch(L10n.t("capture.startFocus"), isOn: $capture.startFocus)
                    .padding(.horizontal, PFSpace.page)
                    .padding(.top, PFSpace.xs)
                    .frame(minHeight: 44)
                    .transition(.opacity)
            }

            Group {
                if let panel = capture.panel {
                    panelView(panel)
                } else if !capture.suggestions.isEmpty {
                    suggestionRow
                }
            }
            .padding(.top, PFSpace.s)

            chipBar
                .padding(.top, PFSpace.xs)
        }
        .padding(.bottom, PFSpace.xs)
        .animation(PFMotion.respecting(PFMotion.snappy), value: capture.panel)
        .animation(PFMotion.respecting(PFMotion.fast), value: capture.text.isEmpty)
        .animation(PFMotion.respecting(PFMotion.fast), value: capture.offersFocus)
        .animation(PFMotion.respecting(PFMotion.fast), value: capture.suggestions)
    }

    // MARK: Header and target

    private var header: some View {
        HStack {
            PFEyebrow(L10n.t("capture.title"))
            Spacer()
            PFButton(L10n.t("common.save"), size: .small) { capture.save() }
                .disabled(!capture.canSave)
        }
        .padding(.horizontal, PFSpace.page)
    }

    private var targetRow: some View {
        HStack(spacing: PFSpace.xs) {
            Text(L10n.t("capture.target")).pfText(.meta).foregroundStyle(PFColor.textMuted)
            Button { capture.toggle(.project) } label: {
                HStack(spacing: 6) {
                    Image(systemName: capture.isPersonal ? "lock.fill" : "square.stack.3d.up")
                        .font(.system(size: 12, weight: .semibold))
                    Text(capture.project?.title ?? L10n.t("common.personal")).pfText(.metaStrong).lineLimit(1)
                    Image(systemName: "chevron.down").font(.system(size: 9, weight: .bold)).opacity(0.6)
                }
                .foregroundStyle(PFColor.textMain)
                .padding(.horizontal, 10)
                .frame(minHeight: 32)
                .background(PFColor.raised, in: .capsule)
                .contentShape(.capsule)
            }
            .buttonStyle(.pfPressable)
            .accessibilityLabel("\(L10n.t("capture.target")): \(capture.project?.title ?? L10n.t("common.personal"))")
            Spacer(minLength: 0)
        }
    }

    // MARK: Chip bar

    private var chipBar: some View {
        PFChipRow {
            CaptureChip(capture.dueDate.map(dateLabel) ?? L10n.t("common.date"), systemImage: "calendar",
                        isSet: capture.dueDate != nil, isActive: capture.panel == .date) { capture.toggle(.date) }
            CaptureChip(capture.project?.title ?? L10n.t("common.project"), systemImage: "square.stack.3d.up",
                        isSet: !capture.isPersonal, isActive: capture.panel == .project) { capture.toggle(.project) }
            CaptureChip(capture.priority?.label ?? L10n.t("common.priority"), isSet: capture.priority != nil,
                        isActive: capture.panel == .priority, action: { capture.toggle(.priority) }) {
                PFPrioritySignal(capture.priority)
            }
            if !capture.isPersonal {
                CaptureChip(assigneeLabel, isSet: !capture.assigneeIsMe, isActive: capture.panel == .assignee,
                            action: { capture.toggle(.assignee) }) {
                    PFAvatar(name: capture.assignee?.displayName ?? model.profile?.displayName ?? "?", seed: capture.assigneeId,
                             imageURL: capture.assignee?.photoURL, size: 20)
                }
            }
        }
    }

    private var assigneeLabel: String {
        if capture.assigneeIsMe { return L10n.t("capture.me") }
        return capture.assignee?.displayName.split(separator: " ").first.map(String.init) ?? L10n.t("common.assignee")
    }

    private func dateLabel(_ day: FlexDate) -> String {
        switch Formatting.dayOffset(day) {
        case 0: L10n.t("common.today")
        case 1: L10n.t("common.tomorrow")
        case 2...6: Formatting.weekday(day)
        default: Formatting.shortDate(day)
        }
    }

    // MARK: Suggestions (while typing # or @)

    private var suggestionRow: some View {
        PFChipRow {
            ForEach(capture.suggestions) { suggestion in
                CaptureChip(suggestion.label, isActive: false, action: { capture.apply(suggestion) }) {
                    if suggestion.isPerson {
                        PFAvatar(name: suggestion.label, seed: suggestion.id, imageURL: suggestion.photoURL, size: 20)
                    } else {
                        Image(systemName: "number").font(.system(size: 12, weight: .bold))
                    }
                }
            }
        }
    }

    // MARK: Panels

    @ViewBuilder
    private func panelView(_ panel: CaptureModel.Panel) -> some View {
        switch panel {
        case .date: datePanel
        case .project: projectPanel
        case .priority: priorityPanel
        case .assignee: assigneePanel
        }
    }

    private func closePanel(after delay: Double = 0.18) {
        DispatchQueue.main.asyncAfter(deadline: .now() + delay) {
            withAnimation(PFMotion.respecting(PFMotion.snappy)) { capture.panel = nil }
        }
    }

    private var datePanel: some View {
        let quick = Formatting.quickDates.compactMap { item in
            Formatting.date(item.value).map { PFDateStrip.Quick(id: item.id, label: item.label, date: $0) }
        } + [PFDateStrip.Quick(id: "none", label: L10n.t("common.noDate"), date: nil)]
        let selection = Binding<Date?>(
            get: { capture.dueDate.flatMap { Formatting.date($0) } },
            set: { day in
                capture.setDue(day.map { FlexDate.day(of: $0, in: Formatting.timeZone) })
                closePanel(after: 0.25)
            }
        )
        return CapturePanel(L10n.t("common.date")) {
            PFDateStrip(quick: quick, calendar: Formatting.calendar, locale: L10n.locale, selection: selection)
        }
    }

    private var projectPanel: some View {
        CapturePanel(L10n.t("common.project")) {
            PFChipRow {
                PFChip(L10n.t("common.personal"), systemImage: "lock.fill", isSet: capture.isPersonal) {
                    capture.setProject(nil)
                    closePanel()
                }
                ForEach(capture.projects) { project in
                    PFChip(project.title, isSet: capture.projectId == project.id) {
                        capture.setProject(project.id)
                        closePanel()
                    }
                }
            }
        }
    }

    private var priorityPanel: some View {
        CapturePanel(L10n.t("common.priority"), clearTitle: capture.priority == nil ? nil : L10n.t("common.remove"),
                     onClear: { capture.priority = nil; closePanel(after: 0.05) }) {
            PFChipRow {
                ForEach([TaskPriority.urgent, .high, .medium, .low], id: \.self) { priority in
                    CaptureChip(priority.label, isSet: capture.priority == priority, action: {
                        capture.priority = priority
                        closePanel()
                    }) {
                        PFPrioritySignal(priority)
                    }
                }
            }
        }
    }

    private var assigneePanel: some View {
        CapturePanel(L10n.t("common.assignee")) {
            PFChipRow {
                CaptureChip(L10n.t("capture.me"), isSet: capture.assigneeIsMe, action: {
                    capture.setAssignee(nil)
                    closePanel()
                }) {
                    PFAvatar(name: model.profile?.displayName ?? "?", seed: model.uid, imageURL: model.profile?.photoURL, size: 20)
                }
                ForEach(capture.members(of: capture.projectId).filter { $0.id != model.uid }) { person in
                    CaptureChip(person.displayName, isSet: capture.assigneeId == person.id, action: {
                        capture.setAssignee(person.id)
                        closePanel()
                    }) {
                        PFAvatar(name: person.displayName, seed: person.id, imageURL: person.photoURL, size: 20)
                    }
                }
            }
        }
    }
}
