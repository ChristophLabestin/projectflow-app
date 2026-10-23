import SwiftUI
import PFData
import PFDesign
import PFModel

extension AppModel {
    /// Planning writes (labels, milestones, sprints, initiatives, groups, personal-task move, scheduling).
    var planning: PlanningActions? {
        guard let workspace, let session else { return nil }
        return PlanningActions(tenantId: workspace.tenantId, uid: session.uid,
                               actorName: session.profile?.displayName ?? auth.displayName ?? "",
                               actorPhotoURL: session.profile?.photoURL)
    }
}

// MARK: - Choice sheet (single select)

/// One option of a choice or multi-select sheet.
struct PlanningOption: Identifiable, Hashable {
    let id: String
    var title: String
    var subtitle: String?
    var tint: Color?
    var symbol: String?
}

/// Pick one entry (sprint, initiative, milestone…) or none. Tapping saves and closes.
struct PlanningChoiceSheet: View {
    let eyebrow: String
    let title: String?
    let options: [PlanningOption]
    let selection: String?
    var noneTitle: String?
    var emptyText: String = ""
    let onSelect: (String?) -> Void
    @Environment(PFPresenter.self) private var presenter

    var body: some View {
        VStack(alignment: .leading, spacing: PFSpace.s) {
            PFSheetHeader(eyebrow, title: title)
            if options.isEmpty && noneTitle == nil {
                Text(emptyText).pfText(.meta).foregroundStyle(PFColor.textMuted).padding(.horizontal, PFSpace.page).padding(.vertical, PFSpace.m)
            } else {
                ScrollView {
                    VStack(spacing: 0) {
                        if let noneTitle {
                            row(PlanningOption(id: "", title: noneTitle, symbol: "nosign"), isOn: selection == nil) { select(nil) }
                            if !options.isEmpty { PFRowDivider(leadingInset: 60) }
                        }
                        ForEach(Array(options.enumerated()), id: \.element.id) { index, option in
                            if index > 0 { PFRowDivider(leadingInset: 60) }
                            row(option, isOn: option.id == selection) { select(option.id) }
                        }
                        if options.isEmpty {
                            Text(emptyText).pfText(.meta).foregroundStyle(PFColor.textMuted).padding(PFSpace.l)
                        }
                    }
                    .background(PFColor.sheetGroup, in: .rect(cornerRadius: PFRadius.card, style: .continuous))
                    .padding(.horizontal, PFSpace.m)
                }
                .frame(maxHeight: 420)
                .scrollIndicators(.hidden)
            }
        }
        .padding(.bottom, PFSpace.l)
    }

    private func select(_ id: String?) {
        PFHaptics.selection()
        onSelect(id)
        presenter.dismiss()
    }

    private func row(_ option: PlanningOption, isOn: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: PFSpace.s) {
                PlanningOptionGlyph(option: option)
                VStack(alignment: .leading, spacing: 1) {
                    Text(option.title).pfText(.rowTitle).foregroundStyle(PFColor.textMain).lineLimit(2)
                    if let subtitle = option.subtitle { Text(subtitle).pfText(.meta).foregroundStyle(PFColor.textMuted).lineLimit(1) }
                }
                Spacer(minLength: 0)
                if isOn { Image(systemName: "checkmark").font(.system(size: 13, weight: .bold)).foregroundStyle(PFColor.textMain).accessibilityHidden(true) }
            }
            .padding(.horizontal, PFSpace.m)
            .frame(minHeight: 54)
            .contentShape(.rect)
        }
        .buttonStyle(.pfPressable)
        .accessibilityAddTraits(isOn ? [.isButton, .isSelected] : .isButton)
    }
}

struct PlanningOptionGlyph: View {
    let option: PlanningOption

    var body: some View {
        Group {
            if let symbol = option.symbol {
                Image(systemName: symbol).font(.system(size: 14, weight: .semibold)).foregroundStyle(PFColor.textMuted)
                    .frame(width: 32, height: 32).background(PFColor.raised, in: .circle)
            } else if let tint = option.tint {
                Circle().fill(tint).frame(width: 14, height: 14).frame(width: 32, height: 32)
            } else {
                Color.clear.frame(width: 0, height: 0)
            }
        }
        .accessibilityHidden(true)
    }
}

// MARK: - Multi select

/// Pick several entries (groups, tasks to link) and save once.
struct PlanningMultiSheet: View {
    let eyebrow: String
    let title: String?
    let options: [PlanningOption]
    let initial: Set<String>
    var emptyText: String = ""
    var searchable = false
    let onSave: ([String]) -> Void
    @Environment(PFPresenter.self) private var presenter
    @State private var selected: Set<String> = []
    @State private var query = ""

    private var filtered: [PlanningOption] {
        query.isEmpty ? options : options.filter { $0.title.localizedCaseInsensitiveContains(query) }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: PFSpace.s) {
            PFSheetHeader(eyebrow, title: title)
            if searchable || options.count > 8 {
                PFTextField(L10n.t("common.search"), text: $query, systemImage: "magnifyingglass").padding(.horizontal, PFSpace.page)
            }
            ScrollView {
                VStack(spacing: 0) {
                    ForEach(Array(filtered.enumerated()), id: \.element.id) { index, option in
                        if index > 0 { PFRowDivider(leadingInset: 60) }
                        row(option)
                    }
                    if filtered.isEmpty {
                        Text(emptyText).pfText(.meta).foregroundStyle(PFColor.textMuted).padding(PFSpace.l)
                    }
                }
                .background(PFColor.sheetGroup, in: .rect(cornerRadius: PFRadius.card, style: .continuous))
                .padding(.horizontal, PFSpace.m)
            }
            .frame(maxHeight: 400)
            .scrollIndicators(.hidden)
            PFButton(L10n.t("common.save"), fullWidth: true) {
                onSave(options.map(\.id).filter(selected.contains))
                presenter.dismiss()
            }
            .padding(.horizontal, PFSpace.page)
        }
        .padding(.bottom, PFSpace.l)
        .onAppear { selected = initial }
    }

    private func row(_ option: PlanningOption) -> some View {
        let isOn = selected.contains(option.id)
        return Button {
            PFHaptics.selection()
            if isOn { selected.remove(option.id) } else { selected.insert(option.id) }
        } label: {
            HStack(spacing: PFSpace.s) {
                PlanningOptionGlyph(option: option)
                VStack(alignment: .leading, spacing: 1) {
                    Text(option.title).pfText(.rowTitle).foregroundStyle(PFColor.textMain).lineLimit(2)
                    if let subtitle = option.subtitle { Text(subtitle).pfText(.meta).foregroundStyle(PFColor.textMuted).lineLimit(1) }
                }
                Spacer(minLength: 0)
                Image(systemName: isOn ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: 22))
                    .foregroundStyle(isOn ? PFColor.success : PFColor.textSubtle)
                    .accessibilityHidden(true)
            }
            .padding(.horizontal, PFSpace.m)
            .frame(minHeight: 54)
            .contentShape(.rect)
        }
        .buttonStyle(.pfPressable)
        .accessibilityAddTraits(isOn ? [.isButton, .isSelected] : .isButton)
    }
}

// MARK: - Editor scaffold

/// Header, scrolling form and save/delete footer shared by the initiative, milestone and sprint editors.
struct PlanningEditorScaffold<Content: View>: View {
    let eyebrow: String
    let title: String
    let saveTitle: String
    let canSave: Bool
    var deleteTitle: String?
    var onDelete: (() -> Void)?
    let onSave: () -> Void
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: PFSpace.s) {
            PFSheetHeader(eyebrow, title: title)
            // The sheet itself scrolls (and avoids the keyboard), so the form is plain content.
            VStack(alignment: .leading, spacing: PFSpace.m) { content }
                .padding(.horizontal, PFSpace.page)
                .padding(.bottom, PFSpace.s)
            HStack(spacing: PFSpace.s) {
                if let deleteTitle, let onDelete {
                    PFButton(deleteTitle, systemImage: "trash", kind: .ghost, action: onDelete)
                }
                PFButton(saveTitle, fullWidth: true, action: onSave)
                    .disabled(!canSave)
                    .opacity(canSave ? 1 : 0.45)
            }
            .padding(.horizontal, PFSpace.page)
        }
        .padding(.bottom, PFSpace.l)
    }
}

/// Eyebrow label above a form control.
struct PlanningField<Content: View>: View {
    let label: String
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            PFEyebrow(label)
            content
        }
    }
}

/// Wrapping chips for a small enumeration (status, priority, health).
struct PlanningChips<Value: Hashable>: View {
    let options: [(value: Value, label: String)]
    @Binding var selection: Value

    var body: some View {
        FlowLayout(spacing: 8) {
            ForEach(Array(options.enumerated()), id: \.offset) { _, option in
                PFChip(option.label, isSet: option.value == selection) {
                    withAnimation(PFMotion.fast) { selection = option.value }
                }
            }
        }
    }
}

/// Form row that shows a date and opens the day sheet on tap.
struct PlanningDateRow: View {
    let label: String
    @Binding var date: FlexDate?
    @Environment(PFPresenter.self) private var presenter

    var body: some View {
        PFDetailRow(label, showsChevron: true, action: {
            let binding = $date
            presenter.present(detents: [.fit]) {
                DateSheet(eyebrow: label, title: nil, initial: binding.wrappedValue) { binding.wrappedValue = $0 }
            }
        }) {
            if let date { Text(Formatting.shortDate(date)) } else { Text("—").foregroundStyle(PFColor.textSubtle) }
        }
    }
}
