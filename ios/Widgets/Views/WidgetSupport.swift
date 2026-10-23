import SwiftUI
import WidgetKit
import PFDesign
import PFModel
import PFSnapshot

// Building blocks shared by the Today widget, the Focus widget and the Live Activity. These files are also
// compiled into the app target so the design catalog can show the exact widget views.

/// Fonts for compact surfaces: the bundled Jakarta at the weights of the app's text styles, at an explicit size.
enum WidgetFont {
    static func display(_ size: CGFloat) -> Font { Font(PFFont.uiFont(.display).withSize(size)) }
    static func title(_ size: CGFloat) -> Font { Font(PFFont.uiFont(.title).withSize(size)) }
    static func row(_ size: CGFloat) -> Font { Font(PFFont.uiFont(.rowTitle).withSize(size)) }
    static func eyebrow(_ size: CGFloat = 10) -> Font { Font(PFFont.uiFont(.eyebrow).withSize(size)) }
    static func meta(_ size: CGFloat = 12) -> Font { .system(size: size, weight: .medium) }
}

/// "HEUTE", "IM FOKUS": wide-tracked uppercase eyebrow like the web.
struct WidgetEyebrow: View {
    let text: String
    var color: Color = PFColor.textMuted

    var body: some View {
        Text(text)
            .font(WidgetFont.eyebrow())
            .tracking(1.3)
            .textCase(.uppercase)
            .foregroundStyle(color)
            .lineLimit(1)
    }
}

/// The ring of the app's ring check (colour = urgency), without the interaction. Wrap it in a `Button(intent:)`.
struct WidgetRing: View {
    var severity: Severity = .neutral
    var dashed = false
    var size: CGFloat = 22

    var body: some View {
        Circle()
            .strokeBorder(dashed ? PFColor.textSubtle : PFColor.severity(severity),
                          style: StrokeStyle(lineWidth: 2, dash: dashed ? [3, 3] : []))
            .frame(width: size, height: size)
            .accessibilityHidden(true)
    }
}

extension TodaySnapshot {
    var bandSegments: [PFBandSegment] {
        band.prefix(6).enumerated().map { index, raw in
            let kind: PFBandSegment.Kind = switch raw {
            case "overdue": .overdue
            case "due": .due
            case "waiting": .waiting
            default: .free
            }
            return PFBandSegment(id: "w\(index)", kind: kind)
        }
    }
}

extension TodaySnapshot.Stop {
    var severityValue: Severity {
        switch severity {
        case "overdue": .overdue
        case "due": .due
        default: .neutral
        }
    }

    var priorityValue: TaskPriority? { TaskPriority(raw: priority) }

    var deepLink: URL { PFLink.stop(id: id, tenantId: tenantId, projectId: projectId, isPersonal: isPersonal) }
}

extension TodaySnapshot.Focus {
    var deepLink: URL { PFLink.focusItem(itemId: itemId, itemType: itemType, tenantId: tenantId, projectId: projectId) }
    var isPaused: Bool { status == "snoozed" }
    var isBlocked: Bool { status == "blocked" }
}

/// Date-only comparison for "is this snapshot from today?".
extension TodaySnapshot {
    func isStale(at date: Date, calendar: Calendar = .current) -> Bool {
        signedIn && !calendar.isDate(generatedAt, inSameDayAs: date)
    }
}

/// Resolved language for surfaces that have no snapshot in hand (Live Activity, controls).
enum WidgetLanguage {
    static var strings: ExtensionStrings { ExtensionStrings(language: SnapshotStore.load()?.language) }
}

/// Reads the snapshot for timelines; falls back to the signed-out state when the app never wrote one.
enum WidgetSnapshot {
    static func current() -> TodaySnapshot { SnapshotStore.load() ?? .signedOut }
}

/// Live timer text (`Text(date, style: .timer)`) is archived by WidgetKit with its styled-text attachments. A dynamic
/// trait-provider colour (`PFColor.*`) in there can break SwiftUI's archive (dictionary key violates Hashable,
/// widget crash 2026-10-23): resolve it to a static colour for the current environment first.
struct TimerForeground: ViewModifier {
    let color: Color
    @Environment(\.self) private var environment

    func body(content: Content) -> some View {
        content.foregroundStyle(Color(color.resolve(in: environment)))
    }
}

extension View {
    func timerForeground(_ color: Color) -> some View { modifier(TimerForeground(color: color)) }
}
