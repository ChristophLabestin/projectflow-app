import SwiftUI

// Planning components: colour swatches for labels/initiatives and the horizontal milestone timeline.

/// Swatches offered for labels and initiative accents (same set as the web label manager).
public enum PlanningPalette {
    public static let swatches: [String] = [
        "#64748b", "#ef4444", "#f97316", "#f59e0b", "#eab308", "#84cc16", "#22c55e", "#10b981", "#14b8a6",
        "#06b6d4", "#0ea5e9", "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#d946ef", "#ec4899", "#f43f5e",
    ]
}

/// Wrapping grid of colour dots; the selected one carries a ring and a check.
public struct PlanningSwatchRow: View {
    @Binding var selection: String?
    let allowsNone: Bool
    let noneLabel: String

    public init(selection: Binding<String?>, allowsNone: Bool = false, noneLabel: String = "") {
        self._selection = selection
        self.allowsNone = allowsNone
        self.noneLabel = noneLabel
    }

    private let columns = [GridItem(.adaptive(minimum: 38, maximum: 44), spacing: 8)]

    public var body: some View {
        LazyVGrid(columns: columns, alignment: .leading, spacing: 8) {
            if allowsNone {
                Button {
                    PFHaptics.selection()
                    selection = nil
                } label: {
                    Image(systemName: "nosign")
                        .font(.system(size: 15, weight: .medium))
                        .foregroundStyle(PFColor.textMuted)
                        .frame(width: 34, height: 34)
                        .background(PFColor.raised, in: .circle)
                        .overlay { Circle().strokeBorder(PFColor.textMain, lineWidth: selection == nil ? 2 : 0).padding(-3) }
                        .frame(width: 40, height: 40)
                        .contentShape(.rect)
                }
                .buttonStyle(.pfPressable)
                .accessibilityLabel(noneLabel)
                .accessibilityAddTraits(selection == nil ? [.isButton, .isSelected] : .isButton)
            }
            ForEach(PlanningPalette.swatches, id: \.self) { hex in
                let isOn = selection?.lowercased() == hex
                Button {
                    PFHaptics.selection()
                    selection = hex
                } label: {
                    Circle()
                        .fill(PFColor.hex(hex) ?? PFColor.textMuted)
                        .frame(width: 34, height: 34)
                        .overlay {
                            if isOn { Image(systemName: "checkmark").font(.system(size: 13, weight: .bold)).foregroundStyle(.white) }
                        }
                        .overlay { Circle().strokeBorder(PFColor.textMain, lineWidth: isOn ? 2 : 0).padding(-3) }
                        .frame(width: 40, height: 40)
                        .contentShape(.rect)
                }
                .buttonStyle(.pfPressable)
                .accessibilityLabel(hex)
                .accessibilityAddTraits(isOn ? [.isButton, .isSelected] : .isButton)
            }
        }
    }
}

// MARK: - Timeline

public struct PlanningTimelineEntry: Identifiable, Hashable, Sendable {
    public enum State: Sendable { case upcoming, soon, overdue, achieved, missed }

    public let id: String
    public var title: String
    public var dateText: String
    public var countdownText: String?
    /// 0…1 share of linked tasks that are done; nil when nothing is linked.
    public var progress: Double?
    public var progressText: String?
    public var state: State

    public init(id: String, title: String, dateText: String, countdownText: String?, progress: Double?, progressText: String?, state: State) {
        self.id = id
        self.title = title
        self.dateText = dateText
        self.countdownText = countdownText
        self.progress = progress
        self.progressText = progressText
        self.state = state
    }
}

/// Milestones on a horizontal line: a node per milestone, a card below with date, countdown and the
/// progress of its linked tasks. Opens scrolled to the next open milestone.
public struct PlanningTimeline: View {
    let entries: [PlanningTimelineEntry]
    let onSelect: (String) -> Void
    let cardWidth: CGFloat = 176

    public init(entries: [PlanningTimelineEntry], onSelect: @escaping (String) -> Void) {
        self.entries = entries
        self.onSelect = onSelect
    }

    private var focusId: String? {
        entries.first { $0.state == .overdue || $0.state == .soon || $0.state == .upcoming }?.id ?? entries.last?.id
    }

    public var body: some View {
        ScrollViewReader { proxy in
            ScrollView(.horizontal) {
                HStack(alignment: .top, spacing: 0) {
                    ForEach(Array(entries.enumerated()), id: \.element.id) { index, entry in
                        column(entry, isFirst: index == 0, isLast: index == entries.count - 1)
                            .id(entry.id)
                    }
                }
                .padding(.horizontal, PFSpace.page - 6)
            }
            .scrollIndicators(.hidden)
            .task(id: entries.map(\.id)) {
                if let focusId { proxy.scrollTo(focusId, anchor: .leading) }
            }
        }
    }

    private func column(_ entry: PlanningTimelineEntry, isFirst: Bool, isLast: Bool) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            ZStack(alignment: .leading) {
                Rectangle()
                    .fill(PFColor.hairlineStrong)
                    .frame(height: 2)
                    .padding(.leading, isFirst ? 19 : 0)
                    .padding(.trailing, isLast ? cardWidth - 19 : 0)
                node(entry.state).padding(.leading, 6)
            }
            .frame(width: cardWidth, height: 26)
            Button {
                PFHaptics.selection()
                onSelect(entry.id)
            } label: {
                card(entry)
            }
            .buttonStyle(.pfPressable)
            .padding(.horizontal, 6)
            .frame(width: cardWidth)
        }
    }

    private func node(_ state: PlanningTimelineEntry.State) -> some View {
        ZStack {
            Circle().fill(PFColor.canvas).frame(width: 26, height: 26)
            Circle().fill(tint(state)).frame(width: 20, height: 20)
            Image(systemName: symbol(state)).font(.system(size: 10, weight: .heavy)).foregroundStyle(.white)
        }
        .accessibilityHidden(true)
    }

    private func card(_ entry: PlanningTimelineEntry) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(entry.dateText).pfText(.eyebrow).foregroundStyle(PFColor.textMuted)
            Text(entry.title)
                .pfText(.rowTitle)
                .foregroundStyle(PFColor.textMain)
                .multilineTextAlignment(.leading)
                .lineLimit(2)
                .frame(maxWidth: .infinity, minHeight: 40, alignment: .topLeading)
            if let progress = entry.progress {
                VStack(alignment: .leading, spacing: 5) {
                    PFProgressBar(value: progress, height: 5)
                    if let text = entry.progressText { Text(text).pfText(.caption).foregroundStyle(PFColor.textMuted) }
                }
            }
            if let countdown = entry.countdownText {
                Text(countdown).pfText(.metaStrong).foregroundStyle(text(entry.state)).lineLimit(1)
            }
        }
        .padding(PFSpace.s)
        .frame(maxWidth: .infinity, alignment: .leading)
        .pfCard()
        .accessibilityElement(children: .combine)
    }

    private func tint(_ state: PlanningTimelineEntry.State) -> Color {
        switch state {
        case .achieved: PFColor.success
        case .missed, .overdue: PFColor.danger
        case .soon: PFColor.warning
        case .upcoming: PFColor.textSubtle
        }
    }

    private func text(_ state: PlanningTimelineEntry.State) -> Color {
        switch state {
        case .achieved: PFColor.successText
        case .missed, .overdue: PFColor.dangerText
        case .soon: PFColor.warningText
        case .upcoming: PFColor.textMuted
        }
    }

    private func symbol(_ state: PlanningTimelineEntry.State) -> String {
        switch state {
        case .achieved: "checkmark"
        case .missed: "xmark"
        case .overdue: "exclamationmark"
        case .soon: "flag.fill"
        case .upcoming: "flag.fill"
        }
    }
}
