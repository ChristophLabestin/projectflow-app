import AppIntents
import SwiftUI
import WidgetKit
import PFDesign
import PFModel
import PFSnapshot

// "Fokus" widget: what you are working on, how long, with Done and Pause as real buttons.

struct FocusEntry: TimelineEntry {
    let date: Date
    let snapshot: TodaySnapshot

    var strings: ExtensionStrings { ExtensionStrings(language: snapshot.language) }
    var focus: TodaySnapshot.Focus? { snapshot.signedIn ? snapshot.focus : nil }
}

struct FocusWidgetView: View {
    let entry: FocusEntry
    @Environment(\.widgetFamily) private var family

    var body: some View {
        Group {
            switch family {
            case .systemMedium: FocusMediumView(entry: entry)
            case .accessoryRectangular: FocusAccessoryRectangularView(entry: entry)
            case .accessoryInline: FocusAccessoryInlineView(entry: entry)
            default: FocusSmallView(entry: entry)
            }
        }
        .widgetURL(entry.focus?.deepLink ?? PFLink.today)
        .containerBackground(PFColor.card, for: .widget)
    }
}

// MARK: - Shared pieces (also used by the Live Activity)

/// Status dot: solid + halo while running (the web pill pulses; widgets cannot animate), hollow while paused,
/// danger while blocked.
struct FocusStatusDot: View {
    let status: String

    var body: some View {
        switch status {
        case "snoozed":
            Circle().strokeBorder(PFColor.textMuted, lineWidth: 2).frame(width: 9, height: 9).accessibilityHidden(true)
        case "blocked":
            PFDot(PFColor.danger, size: 9).accessibilityHidden(true)
        default:
            PFPulseDot()
        }
    }
}

func focusEyebrow(status: String, strings: ExtensionStrings) -> String {
    switch status {
    case "snoozed": strings.t("w.paused")
    case "blocked": strings.t("w.blocked")
    default: strings.t("w.eyebrow.focus")
    }
}

/// Capsule button label in the app's button language; use inside `Button(intent:)` with `.plain` style.
struct WidgetCapsuleLabel: View {
    enum Kind { case primary, ghost }
    let title: String
    let systemImage: String
    var kind: Kind = .primary
    var compact = false

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: systemImage).font(.system(size: 12, weight: .bold))
            if !compact {
                Text(title).font(WidgetFont.row(13)).lineLimit(1).minimumScaleFactor(0.8)
            }
        }
        .foregroundStyle(kind == .primary ? PFColor.onPrimary : PFColor.textMain)
        .padding(.horizontal, compact ? 0 : 14)
        .frame(width: compact ? 34 : nil, height: 34)
        .frame(maxWidth: compact ? 34 : .infinity)
        .background(kind == .primary ? PFColor.primary : PFColor.raised, in: .capsule)
        .contentShape(.capsule)
    }
}

/// The Done + Pause/Resume pair shared by the widget and the Live Activity.
struct FocusActionButtons: View {
    let status: String
    let strings: ExtensionStrings
    var compact = false

    var body: some View {
        HStack(spacing: 8) {
            Button(intent: FocusDoneButtonIntent()) {
                WidgetCapsuleLabel(title: strings.t("w.done"), systemImage: "checkmark", kind: .primary, compact: compact)
            }
            .buttonStyle(.plain)
            .accessibilityLabel(strings.t("w.done"))
            if status == "active" {
                Button(intent: FocusPauseButtonIntent()) {
                    WidgetCapsuleLabel(title: strings.t("w.pause"), systemImage: "pause.fill", kind: .ghost, compact: compact)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(strings.t("w.pause"))
            } else {
                Button(intent: FocusResumeButtonIntent()) {
                    WidgetCapsuleLabel(title: strings.t("w.resume"), systemImage: "play.fill", kind: .ghost, compact: compact)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(strings.t("w.resume"))
            }
        }
    }
}

/// Elapsed time (counts up by itself) or the pause end, in the focus number style.
struct FocusClock: View {
    let focus: TodaySnapshot.Focus
    let strings: ExtensionStrings
    var size: CGFloat = 22
    var alignment: Alignment = .leading

    var body: some View {
        Group {
            if focus.isPaused, let until = focus.snoozedUntil {
                Text(strings.t("w.pausedUntil", ["time": strings.time(until)]))
                    .font(WidgetFont.row(size * 0.62))
                    .foregroundStyle(PFColor.textMuted)
            } else if let started = focus.startedAt {
                Text(started, style: .timer)
                    .font(WidgetFont.display(size).monospacedDigit())
                    .foregroundStyle(PFColor.textMain)
            } else {
                EmptyView()
            }
        }
        .lineLimit(1)
        .minimumScaleFactor(0.6)
        .frame(maxWidth: .infinity, alignment: alignment)
    }
}

private struct FocusEmpty: View {
    let entry: FocusEntry
    var size: CGFloat = 16

    var body: some View {
        let strings = entry.strings
        VStack(alignment: .leading, spacing: 5) {
            WidgetEyebrow(text: strings.t("w.eyebrow.focus"))
            Text(entry.snapshot.signedIn ? strings.t("w.noFocus") : strings.t("w.signedOut"))
                .font(WidgetFont.display(size))
                .foregroundStyle(PFColor.textMain)
                .lineLimit(3)
            if entry.snapshot.signedIn {
                Text(strings.t("w.noFocusHint")).font(WidgetFont.meta(12)).foregroundStyle(PFColor.textMuted).lineLimit(3)
            }
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

// MARK: - Small

struct FocusSmallView: View {
    let entry: FocusEntry

    var body: some View {
        if let focus = entry.focus {
            VStack(alignment: .leading, spacing: 5) {
                HStack(spacing: 7) {
                    FocusStatusDot(status: focus.status)
                    WidgetEyebrow(text: focusEyebrow(status: focus.status, strings: entry.strings),
                                  color: focus.isBlocked ? PFColor.dangerText : PFColor.textMuted)
                }
                Text(focus.title)
                    .font(WidgetFont.display(15))
                    .foregroundStyle(PFColor.textMain)
                    .lineLimit(2)
                    .minimumScaleFactor(0.85)
                if let project = focus.projectName {
                    Text(project).font(WidgetFont.meta(11)).foregroundStyle(PFColor.textMuted).lineLimit(1)
                }
                Spacer(minLength: 0)
                HStack(spacing: 6) {
                    FocusClock(focus: focus, strings: entry.strings, size: 18)
                    FocusActionButtons(status: focus.status, strings: entry.strings, compact: true)
                        .fixedSize()
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        } else {
            FocusEmpty(entry: entry)
        }
    }
}

// MARK: - Medium

struct FocusMediumView: View {
    let entry: FocusEntry

    var body: some View {
        if let focus = entry.focus {
            VStack(alignment: .leading, spacing: 6) {
                HStack(alignment: .firstTextBaseline, spacing: 7) {
                    FocusStatusDot(status: focus.status)
                    WidgetEyebrow(text: focusEyebrow(status: focus.status, strings: entry.strings),
                                  color: focus.isBlocked ? PFColor.dangerText : PFColor.textMuted)
                    Spacer(minLength: 8)
                    FocusClock(focus: focus, strings: entry.strings, size: 22, alignment: .trailing)
                        .frame(maxWidth: 140)
                }
                Text(focus.title)
                    .font(WidgetFont.display(20))
                    .foregroundStyle(PFColor.textMain)
                    .lineLimit(2)
                    .minimumScaleFactor(0.85)
                Text(detailLine(focus))
                    .font(WidgetFont.meta(12)).foregroundStyle(PFColor.textMuted).lineLimit(1)
                Spacer(minLength: 0)
                FocusActionButtons(status: focus.status, strings: entry.strings)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        } else {
            FocusEmpty(entry: entry, size: 20)
        }
    }

    private func detailLine(_ focus: TodaySnapshot.Focus) -> String {
        var parts: [String] = []
        if let project = focus.projectName { parts.append(project) }
        if let next = focus.nextStep, !next.isEmpty { parts.append(next) }
        else if focus.status == "active", let started = focus.startedAt { parts.append(entry.strings.t("w.since", ["time": entry.strings.time(started)])) }
        return parts.joined(separator: " · ")
    }
}

// MARK: - Lock screen

struct FocusAccessoryRectangularView: View {
    let entry: FocusEntry

    var body: some View {
        if let focus = entry.focus {
            VStack(alignment: .leading, spacing: 2) {
                Text(focusEyebrow(status: focus.status, strings: entry.strings))
                    .font(.system(size: 11, weight: .heavy)).textCase(.uppercase).tracking(1)
                Text(focus.title).font(.system(size: 14, weight: .bold)).lineLimit(2).widgetAccentable()
                if let started = focus.startedAt, focus.status == "active" {
                    Text(started, style: .timer).font(.system(size: 13, weight: .medium).monospacedDigit())
                } else {
                    Text(focusStatusLine(focus, strings: entry.strings)).font(.system(size: 12, weight: .medium))
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        } else {
            VStack(alignment: .leading, spacing: 2) {
                Text(entry.strings.t("w.eyebrow.focus")).font(.system(size: 11, weight: .heavy)).textCase(.uppercase).tracking(1)
                Text(entry.strings.t("w.noFocus")).font(.system(size: 14, weight: .bold))
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

struct FocusAccessoryInlineView: View {
    let entry: FocusEntry

    var body: some View {
        if let focus = entry.focus {
            Label(focus.title, systemImage: focus.isPaused ? "pause.circle" : "scope")
        } else {
            Label(entry.strings.t("w.noFocus"), systemImage: "scope")
        }
    }
}
