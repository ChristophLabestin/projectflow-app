import SwiftUI
import PFDesign
import PFModel

// Custom sheets of the task detail: dates, people, reminders, "blocked by" picker, link.

// MARK: - Date

/// Day strip with quick picks and "Kein Datum" (due, start, planned day).
struct DateSheet: View {
    let eyebrow: String
    let title: String?
    let initial: FlexDate?
    let onSave: (FlexDate?) -> Void
    @Environment(PFPresenter.self) private var presenter
    @State private var selection: Date?

    var body: some View {
        VStack(alignment: .leading, spacing: PFSpace.m) {
            PFSheetHeader(eyebrow, title: title)
            PFDateStrip(quick: [PFDateStrip.Quick(id: "none", label: L10n.t("common.noDate"), date: nil)] + Formatting.quickDates.compactMap { quick in
                Formatting.date(quick.value).map { PFDateStrip.Quick(id: quick.id, label: quick.label, date: $0) }
            }, days: 45, calendar: Formatting.calendar, locale: L10n.locale, selection: $selection)
            PFButton(L10n.t("common.save"), fullWidth: true) {
                onSave(selection.map { FlexDate.day(of: $0, in: Formatting.timeZone) })
                presenter.dismiss()
            }
            .padding(.horizontal, PFSpace.page)
        }
        .padding(.bottom, PFSpace.l)
        .onAppear { selection = initial.flatMap { Formatting.date($0) } }
    }
}

// MARK: - People

/// Multi-select of people (assignees). Project members first; search when the list is long.
struct PeopleSheet: View {
    let title: String
    let people: [Person]
    let initial: [String]
    let onSave: ([String]) -> Void
    @Environment(PFPresenter.self) private var presenter
    @State private var selected: [String] = []
    @State private var query = ""

    private var filtered: [Person] {
        query.isEmpty ? people : people.filter { $0.displayName.localizedCaseInsensitiveContains(query) || ($0.email ?? "").localizedCaseInsensitiveContains(query) }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: PFSpace.s) {
            PFSheetHeader(L10n.t("taskDetail.assignees.label"), title: title)
            if people.count > 7 {
                PFTextField(L10n.t("common.search"), text: $query, systemImage: "magnifyingglass")
                    .padding(.horizontal, PFSpace.page)
            }
            ScrollView {
                VStack(spacing: 0) {
                    ForEach(Array(filtered.enumerated()), id: \.element.id) { index, person in
                        if index > 0 { PFRowDivider(leadingInset: 60) }
                        row(person)
                    }
                    if filtered.isEmpty {
                        Text(L10n.t("taskDetail.people.none")).pfText(.meta).foregroundStyle(PFColor.textMuted).padding(PFSpace.l)
                    }
                }
                .background(PFColor.raisedSoft, in: .rect(cornerRadius: PFRadius.card, style: .continuous))
                .padding(.horizontal, PFSpace.m)
            }
            .frame(maxHeight: 360)
            .scrollIndicators(.hidden)
            PFButton(L10n.t("common.save"), fullWidth: true) {
                onSave(selected)
                presenter.dismiss()
            }
            .padding(.horizontal, PFSpace.page)
        }
        .padding(.bottom, PFSpace.l)
        .onAppear { selected = initial }
    }

    private func row(_ person: Person) -> some View {
        let isOn = selected.contains(person.id)
        return Button {
            PFHaptics.selection()
            if isOn { selected.removeAll { $0 == person.id } } else { selected.append(person.id) }
        } label: {
            HStack(spacing: PFSpace.s) {
                PFAvatar(name: person.displayName, seed: person.id, imageURL: person.photoURL, size: 32)
                VStack(alignment: .leading, spacing: 1) {
                    Text(person.displayName).pfText(.rowTitle).foregroundStyle(PFColor.textMain)
                    if let email = person.email { Text(email).pfText(.meta).foregroundStyle(PFColor.textMuted).lineLimit(1) }
                }
                Spacer()
                Image(systemName: isOn ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: 22))
                    .foregroundStyle(isOn ? PFColor.success : PFColor.textSubtle)
                    .accessibilityHidden(true)
            }
            .padding(.horizontal, PFSpace.m)
            .frame(minHeight: 56)
            .contentShape(.rect)
        }
        .buttonStyle(.pfPressable)
        .accessibilityAddTraits(isOn ? [.isButton, .isSelected] : .isButton)
    }
}

// MARK: - Reminder

/// New reminder (contract C2): note, day and time, "Auch Zuständige erinnern". Recipients default to me.
struct ReminderSheet: View {
    let uid: String
    let onSave: (ProjectReminder) -> Void
    @Environment(PFPresenter.self) private var presenter
    @State private var title = L10n.t("taskDetail.reminders.defaultTitle")
    @State private var day: Date? = Formatting.date(Formatting.day(offset: 1))
    @State private var minutes = 9 * 60
    @State private var notifyAssignees = false

    private let slots = stride(from: 7 * 60, through: 21 * 60, by: 30).map { $0 }

    var body: some View {
        VStack(alignment: .leading, spacing: PFSpace.m) {
            PFSheetHeader(L10n.t("taskDetail.reminders.title"), title: nil)
            PFTextField(L10n.t("taskDetail.reminders.titlePlaceholder"), text: $title)
                .padding(.horizontal, PFSpace.page)
            PFDateStrip(quick: Formatting.quickDates.compactMap { quick in
                Formatting.date(quick.value).map { PFDateStrip.Quick(id: quick.id, label: quick.label, date: $0) }
            }, days: 30, calendar: Formatting.calendar, locale: L10n.locale, selection: $day)
            ScrollViewReader { reader in
                PFChipRow {
                    ForEach(slots, id: \.self) { slot in
                        PFChip(Self.label(slot), isSet: slot == minutes) { minutes = slot }.id(slot)
                    }
                }
                .onAppear { reader.scrollTo(minutes, anchor: .center) }
            }
            PFSwitch(L10n.t("taskDetail.reminders.notifyAssignees"), isOn: $notifyAssignees)
                .padding(.horizontal, PFSpace.page)
            PFButton(L10n.t("taskDetail.reminders.add"), systemImage: "bell", fullWidth: true, action: save)
                .disabled(day == nil)
                .padding(.horizontal, PFSpace.page)
        }
        .padding(.bottom, PFSpace.l)
    }

    private static func label(_ minutes: Int) -> String { String(format: "%02d:%02d", minutes / 60, minutes % 60) }

    private func save() {
        guard let day else { return }
        let calendar = Formatting.calendar
        var parts = calendar.dateComponents([.year, .month, .day], from: day)
        parts.hour = minutes / 60
        parts.minute = minutes % 60
        guard let date = calendar.date(from: parts) else { return }
        let name = title.trimmingCharacters(in: .whitespacesAndNewlines)
        onSave(ProjectReminder(title: name.isEmpty ? L10n.t("taskDetail.reminders.defaultTitle") : name, remindAt: FlexDate(instant: date),
                               createdBy: uid, notifyAssignees: notifyAssignees))
        presenter.dismiss()
    }
}

// MARK: - Task picker ("blockiert durch")

struct TaskPickerSheet: View {
    let title: String
    let tasks: [WorkTask]
    let onPick: (WorkTask) -> Void
    @Environment(PFPresenter.self) private var presenter
    @State private var query = ""

    private var filtered: [WorkTask] {
        let open = tasks.sorted { ($0.isCompleted ? 1 : 0, $0.title.lowercased()) < ($1.isCompleted ? 1 : 0, $1.title.lowercased()) }
        return query.isEmpty ? open : open.filter { $0.title.localizedCaseInsensitiveContains(query) }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: PFSpace.s) {
            PFSheetHeader(L10n.t("taskDetail.relationships.title"), title: title)
            PFTextField(L10n.t("taskDetail.relationships.blockedBySearch"), text: $query, systemImage: "magnifyingglass")
                .padding(.horizontal, PFSpace.page)
            ScrollView {
                VStack(spacing: 0) {
                    ForEach(Array(filtered.prefix(60).enumerated()), id: \.element.id) { index, task in
                        if index > 0 { PFRowDivider() }
                        Button {
                            presenter.dismiss()
                            onPick(task)
                        } label: {
                            HStack(spacing: PFSpace.s) {
                                Text(task.title).pfText(.rowTitle).foregroundStyle(task.isCompleted ? PFColor.textMuted : PFColor.textMain)
                                    .lineLimit(2).multilineTextAlignment(.leading)
                                Spacer(minLength: 0)
                                PFPill(task.status.label, tone: .status(task.status.tone), compact: true)
                            }
                            .padding(.horizontal, PFSpace.m)
                            .frame(minHeight: 52)
                            .contentShape(.rect)
                        }
                        .buttonStyle(.pfPressable)
                    }
                    if filtered.isEmpty {
                        Text(L10n.t("taskDetail.relationships.noMatches")).pfText(.meta).foregroundStyle(PFColor.textMuted).padding(PFSpace.l)
                    }
                }
                .background(PFColor.raisedSoft, in: .rect(cornerRadius: PFRadius.card, style: .continuous))
                .padding(.horizontal, PFSpace.m)
            }
            .frame(maxHeight: 380)
            .scrollIndicators(.hidden)
        }
        .padding(.bottom, PFSpace.l)
    }
}

// MARK: - Link

struct LinkSheet: View {
    let initial: URL?
    let onApply: (URL?) -> Void
    @Environment(PFPresenter.self) private var presenter
    @State private var text = ""

    var body: some View {
        VStack(alignment: .leading, spacing: PFSpace.m) {
            PFSheetHeader(L10n.t("taskDetail.link.title"))
            PFTextField("https://", text: $text, systemImage: "link", onSubmit: apply)
                .textInputAutocapitalization(.never)
                .keyboardType(.URL)
                .autocorrectionDisabled()
                .padding(.horizontal, PFSpace.page)
            HStack(spacing: PFSpace.s) {
                if initial != nil {
                    PFButton(L10n.t("common.remove"), kind: .ghost, fullWidth: true) {
                        onApply(nil)
                        presenter.dismiss()
                    }
                }
                PFButton(L10n.t("common.save"), fullWidth: true, action: apply)
                    .disabled(url == nil)
            }
            .padding(.horizontal, PFSpace.page)
        }
        .padding(.bottom, PFSpace.l)
        .onAppear { text = initial?.absoluteString ?? "" }
    }

    private var url: URL? {
        var value = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !value.isEmpty else { return nil }
        if !value.contains("://"), !value.hasPrefix("mailto:") { value = "https://" + value }
        guard let url = URL(string: value), let scheme = url.scheme?.lowercased(), ["http", "https", "mailto"].contains(scheme), url.host() != nil || scheme == "mailto" else { return nil }
        return url
    }

    private func apply() {
        guard let url else { return }
        onApply(url)
        presenter.dismiss()
    }
}

// MARK: - Flow layout

/// Wrapping row layout (pills, labels).
struct FlowLayout: Layout {
    var spacing: CGFloat = 6

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        arrange(proposal: proposal, subviews: subviews).size
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let result = arrange(proposal: ProposedViewSize(width: bounds.width, height: nil), subviews: subviews)
        for (index, origin) in result.origins.enumerated() {
            subviews[index].place(at: CGPoint(x: bounds.minX + origin.x, y: bounds.minY + origin.y), proposal: .unspecified)
        }
    }

    private func arrange(proposal: ProposedViewSize, subviews: Subviews) -> (origins: [CGPoint], size: CGSize) {
        let maxWidth = proposal.width ?? .infinity
        var origins: [CGPoint] = []
        var x: CGFloat = 0, y: CGFloat = 0, rowHeight: CGFloat = 0, usedWidth: CGFloat = 0
        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x > 0, x + size.width > maxWidth {
                x = 0
                y += rowHeight + spacing
                rowHeight = 0
            }
            origins.append(CGPoint(x: x, y: y))
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
            usedWidth = max(usedWidth, x - spacing)
        }
        return (origins, CGSize(width: usedWidth, height: y + rowHeight))
    }
}
