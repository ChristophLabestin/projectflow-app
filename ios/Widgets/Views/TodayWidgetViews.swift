import AppIntents
import SwiftUI
import WidgetKit
import PFDesign
import PFModel
import PFSnapshot

// "Heute" widget: day band, headline and the next stops with ring checks that complete a task in place.

struct TodayEntry: TimelineEntry {
    let date: Date
    let snapshot: TodaySnapshot

    var strings: ExtensionStrings { ExtensionStrings(language: snapshot.language) }

    enum State { case signedOut, stale, empty, content }

    var state: State {
        if !snapshot.signedIn { return .signedOut }
        if snapshot.isStale(at: date) { return .stale }
        return snapshot.stops.isEmpty && snapshot.focus == nil && snapshot.openCount == 0 ? .empty : .content
    }
}

struct TodayWidgetView: View {
    let entry: TodayEntry
    @Environment(\.widgetFamily) private var family

    var body: some View {
        Group {
            switch family {
            case .systemMedium: TodayMediumView(entry: entry)
            case .systemLarge, .systemExtraLarge: TodayLargeView(entry: entry)
            case .accessoryRectangular: TodayAccessoryRectangularView(entry: entry)
            case .accessoryCircular: TodayAccessoryCircularView(entry: entry)
            case .accessoryInline: TodayAccessoryInlineView(entry: entry)
            default: TodaySmallView(entry: entry)
            }
        }
        .widgetURL(PFLink.today)
        .containerBackground(PFColor.card, for: .widget)
    }
}

// MARK: - Shared pieces

/// Plain-language fallback line for the three non-content states.
private struct TodayNotice: View {
    let entry: TodayEntry
    var size: CGFloat = 15

    var body: some View {
        let strings = entry.strings
        Text(entry.state == .signedOut ? strings.t("w.signedOut") : entry.state == .stale ? strings.t("w.stale") : strings.t("w.freeDay"))
            .font(WidgetFont.display(size))
            .foregroundStyle(PFColor.textMain)
            .lineSpacing(1)
            .lineLimit(4)
            .minimumScaleFactor(0.8)
            .fixedSize(horizontal: false, vertical: true)
    }
}

private extension TodayEntry {
    var headlineText: String {
        let text = snapshot.headline.trimmingCharacters(in: .whitespacesAndNewlines)
        return text.isEmpty ? strings.t("w.allClear") : text
    }

    var countsText: String { strings.counts(overdue: snapshot.overdueCount, today: snapshot.dueTodayCount) }
}

/// One stop: ring (completes in place) · title + due text · priority.
struct WidgetStopRow: View {
    let stop: TodaySnapshot.Stop
    let strings: ExtensionStrings
    var linked = true
    var showsPriority = true
    var titleSize: CGFloat = 14

    var body: some View {
        HStack(spacing: 2) {
            Button(intent: TaskDoneButtonIntent(taskId: stop.id, tenantId: stop.tenantId, projectId: stop.projectId, isPersonal: stop.isPersonal)) {
                WidgetRing(severity: stop.severityValue, dashed: stop.severity == "suggested")
                    .padding(9)
                    .contentShape(.rect)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("\(strings.t("w.complete")): \(stop.title)")
            .padding(.leading, -9)
            label
        }
        .frame(minHeight: 40)
    }

    @ViewBuilder private var label: some View {
        if linked {
            Link(destination: stop.deepLink) { content }
        } else {
            content
        }
    }

    private var content: some View {
        HStack(spacing: 8) {
            VStack(alignment: .leading, spacing: 1) {
                Text(stop.title)
                    .font(WidgetFont.row(titleSize))
                    .foregroundStyle(PFColor.textMain)
                    .lineLimit(1)
                if !stop.subtitle.isEmpty {
                    Text(stop.subtitle)
                        .font(WidgetFont.meta(11))
                        .foregroundStyle(subtitleColor)
                        .lineLimit(1)
                }
            }
            Spacer(minLength: 0)
            if showsPriority, let priority = stop.priorityValue { PFPrioritySignal(priority) }
        }
    }

    private var subtitleColor: Color {
        switch stop.severityValue {
        case .overdue: PFColor.dangerText
        case .due: PFColor.warningText
        default: PFColor.textMuted
        }
    }
}

/// Focus strip used by the large Today widget: dot · title · since.
private struct TodayFocusStrip: View {
    let focus: TodaySnapshot.Focus
    let strings: ExtensionStrings

    var body: some View {
        Link(destination: PFLink.focus) {
            HStack(spacing: 10) {
                PFPulseDot(color: focus.isBlocked ? PFColor.danger : PFColor.primary)
                VStack(alignment: .leading, spacing: 1) {
                    Text(focus.title).font(WidgetFont.row(14)).foregroundStyle(PFColor.textMain).lineLimit(1)
                    Text(focusStatusLine(focus, strings: strings)).font(WidgetFont.meta(11)).foregroundStyle(PFColor.textMuted).lineLimit(1)
                }
                Spacer(minLength: 0)
                if let started = focus.startedAt, focus.status == "active" {
                    Text(started, style: .timer)
                        .font(.system(size: 13, weight: .semibold).monospacedDigit())
                        .timerForeground(PFColor.textMain)
                        .multilineTextAlignment(.trailing)
                        .frame(maxWidth: 64, alignment: .trailing)
                }
            }
            .padding(.horizontal, 12)
            .frame(height: 44)
            .background(PFColor.raised, in: .rect(cornerRadius: PFRadius.control, style: .continuous))
        }
    }
}

func focusStatusLine(_ focus: TodaySnapshot.Focus, strings: ExtensionStrings) -> String {
    switch focus.status {
    case "snoozed":
        if let until = focus.snoozedUntil { return strings.t("w.pausedUntil", ["time": strings.time(until)]) }
        return strings.t("w.paused")
    case "blocked":
        return strings.t("w.blocked")
    default:
        if let started = focus.startedAt { return strings.t("w.since", ["time": strings.time(started)]) }
        return focus.projectName ?? strings.t("w.eyebrow.focus")
    }
}

// MARK: - Small

struct TodaySmallView: View {
    let entry: TodayEntry

    var body: some View {
        let snapshot = entry.snapshot
        VStack(alignment: .leading, spacing: 7) {
            WidgetEyebrow(text: entry.strings.t("w.eyebrow.today"))
            if entry.state == .content {
                Text(entry.headlineText)
                    .font(WidgetFont.display(15))
                    .foregroundStyle(PFColor.textMain)
                    .lineLimit(3)
                    .minimumScaleFactor(0.85)
                    .fixedSize(horizontal: false, vertical: true)
                Spacer(minLength: 0)
                PFDayBand(segments: snapshot.bandSegments, height: 9)
                if let stop = snapshot.stops.first {
                    WidgetStopRow(stop: stop, strings: entry.strings, linked: false, showsPriority: false, titleSize: 13)
                        .frame(minHeight: 30)
                        .padding(.vertical, -4)
                }
            } else {
                TodayNotice(entry: entry)
                Spacer(minLength: 0)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

// MARK: - Medium

struct TodayMediumView: View {
    let entry: TodayEntry

    var body: some View {
        let snapshot = entry.snapshot
        HStack(alignment: .top, spacing: 16) {
            VStack(alignment: .leading, spacing: 7) {
                WidgetEyebrow(text: entry.strings.t("w.eyebrow.today"))
                if entry.state == .content {
                    Text(entry.headlineText)
                        .font(WidgetFont.display(16))
                        .foregroundStyle(PFColor.textMain)
                        .lineLimit(4)
                        .minimumScaleFactor(0.85)
                        .fixedSize(horizontal: false, vertical: true)
                    Spacer(minLength: 0)
                    PFDayBand(segments: snapshot.bandSegments, height: 9)
                    if !entry.countsText.isEmpty {
                        Text(entry.countsText).font(WidgetFont.meta(11)).foregroundStyle(PFColor.textMuted).lineLimit(1)
                    }
                } else {
                    TodayNotice(entry: entry, size: 16)
                    Spacer(minLength: 0)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            if entry.state == .content {
                VStack(spacing: 0) {
                    let stops = Array(snapshot.stops.prefix(3))
                    ForEach(Array(stops.enumerated()), id: \.element.id) { index, stop in
                        if index > 0 { PFRowDivider(leadingInset: 0) }
                        WidgetStopRow(stop: stop, strings: entry.strings, showsPriority: false, titleSize: 13)
                    }
                    if stops.isEmpty {
                        Text(entry.strings.t("w.noStops")).font(WidgetFont.meta()).foregroundStyle(PFColor.textMuted)
                    }
                    Spacer(minLength: 0)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                .padding(.top, -4)
            }
        }
    }
}

// MARK: - Large

struct TodayLargeView: View {
    let entry: TodayEntry

    var body: some View {
        let snapshot = entry.snapshot
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline) {
                WidgetEyebrow(text: entry.strings.t("w.eyebrow.today"))
                Spacer()
                if entry.state == .content, !entry.countsText.isEmpty {
                    Text(entry.countsText).font(WidgetFont.meta(11)).foregroundStyle(PFColor.textMuted)
                }
            }
            if entry.state == .content {
                Text(entry.headlineText)
                    .font(WidgetFont.display(21))
                    .foregroundStyle(PFColor.textMain)
                    .lineLimit(3)
                    .minimumScaleFactor(0.85)
                    .fixedSize(horizontal: false, vertical: true)
                PFDayBand(segments: snapshot.bandSegments, height: 11)
                    .padding(.top, 2)
                let limit = snapshot.focus == nil ? 5 : 3
                let stops = Array(snapshot.stops.prefix(limit))
                VStack(spacing: 0) {
                    ForEach(Array(stops.enumerated()), id: \.element.id) { index, stop in
                        if index > 0 { PFRowDivider(leadingInset: 28) }
                        WidgetStopRow(stop: stop, strings: entry.strings, titleSize: 15)
                    }
                }
                .padding(.top, 2)
                Spacer(minLength: 0)
                if snapshot.moreCount > 0 {
                    Text(entry.strings.t("w.more", ["count": String(snapshot.moreCount)]))
                        .font(WidgetFont.meta(11)).foregroundStyle(PFColor.textMuted)
                }
                if let focus = snapshot.focus { TodayFocusStrip(focus: focus, strings: entry.strings) }
            } else {
                TodayNotice(entry: entry, size: 21)
                Spacer(minLength: 0)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

// MARK: - Lock screen

/// Lock-screen band: vibrant rendering drops hue, so urgency is carried by weight (full, dimmed, outline, faint).
private struct AccessoryBand: View {
    let band: [String]
    var height: CGFloat = 7

    var body: some View {
        HStack(spacing: 3) {
            ForEach(Array(band.prefix(6).enumerated()), id: \.offset) { _, kind in
                let shape = RoundedRectangle(cornerRadius: 2, style: .continuous)
                switch kind {
                case "overdue": shape.fill(.primary).widgetAccentable()
                case "due": shape.fill(.primary.opacity(0.6))
                case "waiting": shape.strokeBorder(.primary.opacity(0.6), lineWidth: 1)
                default: shape.fill(.primary.opacity(0.2))
                }
            }
        }
        .frame(height: height)
        .accessibilityHidden(true)
    }
}

struct TodayAccessoryRectangularView: View {
    let entry: TodayEntry

    var body: some View {
        let snapshot = entry.snapshot
        VStack(alignment: .leading, spacing: 3) {
            if entry.state == .content {
                Text(entry.countsText.isEmpty ? entry.strings.t("w.allClear") : entry.countsText)
                    .font(.system(size: 15, weight: .bold))
                    .widgetAccentable()
                    .lineLimit(1)
                AccessoryBand(band: snapshot.band)
                if let stop = snapshot.stops.first {
                    Text(stop.title).font(.system(size: 12, weight: .medium)).lineLimit(1)
                }
            } else {
                Text(entry.state == .signedOut ? entry.strings.t("w.signedOut") : entry.strings.t("w.stale"))
                    .font(.system(size: 12, weight: .semibold))
                    .lineLimit(3)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct TodayAccessoryCircularView: View {
    let entry: TodayEntry

    var body: some View {
        let band = Array(entry.snapshot.band.prefix(6))
        ZStack {
            AccessoryWidgetBackground()
            if entry.state == .content, !band.isEmpty {
                let count = CGFloat(band.count)
                let gap: CGFloat = 0.03
                ForEach(Array(band.enumerated()), id: \.offset) { index, kind in
                    let start = CGFloat(index) / count + gap / 2
                    let end = CGFloat(index + 1) / count - gap / 2
                    Circle()
                        .trim(from: start, to: end)
                        .stroke(arcStyle(kind), style: StrokeStyle(lineWidth: 4, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                        .padding(5)
                }
                Text("\(entry.snapshot.openCount)")
                    .font(.system(size: 18, weight: .heavy).monospacedDigit())
                    .widgetAccentable()
            } else {
                Image(systemName: "sun.max").font(.system(size: 18, weight: .semibold))
            }
        }
    }

    private func arcStyle(_ kind: String) -> AnyShapeStyle {
        switch kind {
        case "overdue": AnyShapeStyle(.primary)
        case "due": AnyShapeStyle(.primary.opacity(0.65))
        case "waiting": AnyShapeStyle(.primary.opacity(0.35))
        default: AnyShapeStyle(.primary.opacity(0.15))
        }
    }
}

struct TodayAccessoryInlineView: View {
    let entry: TodayEntry

    var body: some View {
        if entry.state == .content, !entry.countsText.isEmpty {
            Label(entry.countsText, systemImage: "sun.max")
        } else if entry.state == .content || entry.state == .empty {
            Label(entry.strings.t("w.allClear"), systemImage: "checkmark.circle")
        } else {
            Label("ProjectFlow", systemImage: "sun.max")
        }
    }
}
