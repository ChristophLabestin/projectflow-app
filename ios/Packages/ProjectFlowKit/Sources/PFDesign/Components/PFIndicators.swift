import SwiftUI
import PFModel

// MARK: - Pills

/// Fully rounded pill. `tone` tints it like the web status/badge tones.
public struct PFPill: View {
    public enum Tone: Sendable { case status(StatusTone), neutral, severity(Severity), custom(Color) }

    let text: String
    let tone: Tone
    let leading: AnyView?
    let compact: Bool

    public init(_ text: String, tone: Tone = .neutral, compact: Bool = false) {
        self.text = text
        self.tone = tone
        self.leading = nil
        self.compact = compact
    }

    public init<Leading: View>(_ text: String, tone: Tone = .neutral, compact: Bool = false, @ViewBuilder leading: () -> Leading) {
        self.text = text
        self.tone = tone
        self.leading = AnyView(leading())
        self.compact = compact
    }

    public var body: some View {
        HStack(spacing: 5) {
            leading
            Text(text).pfText(.pill).lineLimit(1)
        }
        .padding(.horizontal, compact ? 8 : 10)
        .frame(minHeight: compact ? 22 : 26)
        .foregroundStyle(foreground)
        .background(background, in: .capsule)
    }

    private var foreground: Color {
        switch tone {
        case .status(let t): PFColor.statusText(t)
        case .neutral: PFColor.textMain
        case .severity(let s): PFColor.severityText(s)
        case .custom(let c): c
        }
    }

    private var background: Color {
        switch tone {
        case .status(let t): PFColor.statusFill(t)
        case .neutral: PFColor.raised
        case .severity(let s): PFColor.severity(s).opacity(0.12)
        case .custom(let c): c.opacity(0.12)
        }
    }
}

// MARK: - Priority signal

/// Three signal bars (5/8/12 pt) like the web; urgent becomes a violet square with "!".
public struct PFPrioritySignal: View {
    let priority: TaskPriority?
    @ScaledMetric(relativeTo: .footnote) private var scale: CGFloat = 1

    public init(_ priority: TaskPriority?) { self.priority = priority }

    public var body: some View {
        Group {
            if priority == .urgent {
                Text("!")
                    .font(.system(size: 10 * scale, weight: .black))
                    .foregroundStyle(Color.white)
                    .frame(width: 14 * scale, height: 14 * scale)
                    .background(PFColor.priority(.urgent), in: .rect(cornerRadius: 3.5 * scale, style: .continuous))
            } else {
                HStack(alignment: .bottom, spacing: 2 * scale) {
                    ForEach(0..<3) { index in
                        RoundedRectangle(cornerRadius: 1, style: .continuous)
                            .fill(index < level ? color : PFColor.hairlineStrong)
                            .frame(width: 3 * scale, height: [5, 8, 12][index] * scale)
                    }
                }
                .frame(height: 14 * scale, alignment: .bottom)
            }
        }
        .accessibilityHidden(true)
    }

    private var level: Int {
        switch priority { case .low: 1; case .medium: 2; case .high, .urgent: 3; case nil: 0 }
    }

    private var color: Color { priority.map(PFColor.priority) ?? PFColor.textSubtle }
}

// MARK: - Ring check

/// 22 pt ring coloured by urgency; dashed for suggestions; fills green with a drawn check.
public struct PFRingCheck: View {
    let isOn: Bool
    let severity: Severity
    let dashed: Bool
    let label: String
    let action: () -> Void
    @State private var burst = false

    public init(isOn: Bool, severity: Severity = .neutral, dashed: Bool = false, label: String, action: @escaping () -> Void) {
        self.isOn = isOn
        self.severity = severity
        self.dashed = dashed
        self.label = label
        self.action = action
    }

    public var body: some View {
        Button {
            if !isOn {
                PFHaptics.success()
                withAnimation(PFMotion.bouncy) { burst = true }
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.45) { burst = false }
            } else {
                PFHaptics.selection()
            }
            action()
        } label: {
            ZStack {
                Circle()
                    .strokeBorder(isOn ? PFColor.success : ringColor,
                                  style: StrokeStyle(lineWidth: 2, dash: dashed && !isOn ? [3, 3] : []))
                Circle()
                    .fill(PFColor.success)
                    .scaleEffect(isOn ? 1 : 0.2)
                    .opacity(isOn ? 1 : 0)
                CheckShape()
                    .trim(from: 0, to: isOn ? 1 : 0)
                    .stroke(Color.white, style: StrokeStyle(lineWidth: 2.2, lineCap: .round, lineJoin: .round))
                    .padding(6)
                Circle()
                    .stroke(PFColor.success.opacity(0.35), lineWidth: 2)
                    .scaleEffect(burst ? 1.9 : 1)
                    .opacity(burst ? 0 : (isOn ? 0.0001 : 0))
            }
            .frame(width: 22, height: 22)
            .padding(11)
            .contentShape(.rect)
            .animation(PFMotion.respecting(PFMotion.bouncy), value: isOn)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
        .accessibilityValue(isOn ? Text("✓") : Text(""))
        .accessibilityAddTraits(isOn ? [.isButton, .isSelected] : .isButton)
    }

    private var ringColor: Color { dashed ? PFColor.textSubtle : PFColor.severity(severity) }
}

nonisolated struct CheckShape: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: rect.minX, y: rect.midY + rect.height * 0.05))
        path.addLine(to: CGPoint(x: rect.minX + rect.width * 0.38, y: rect.maxY - rect.height * 0.08))
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.minY + rect.height * 0.12))
        return path
    }
}

// MARK: - Day band

public struct PFBandSegment: Identifiable, Hashable, Sendable {
    public enum Kind: Sendable, Hashable { case overdue, due, waiting, free }
    public let id: String
    public let kind: Kind
    public let weight: CGFloat

    public init(id: String, kind: Kind, weight: CGFloat = 1) {
        self.id = id
        self.kind = kind
        self.weight = weight
    }
}

/// Segmented "shape of the day" bar (13 pt segments, radius 3). Segments slide out when work gets done.
public struct PFDayBand: View {
    let segments: [PFBandSegment]
    let height: CGFloat

    public init(segments: [PFBandSegment], height: CGFloat = 13) {
        self.segments = segments
        self.height = height
    }

    public var body: some View {
        GeometryReader { proxy in
            let spacing: CGFloat = 4
            let total = max(segments.map(\.weight).reduce(0, +), 1)
            let available = proxy.size.width - spacing * CGFloat(max(segments.count - 1, 0))
            HStack(spacing: spacing) {
                ForEach(segments) { segment in
                    segmentView(segment.kind)
                        .frame(width: max(available * segment.weight / total, 0))
                        .transition(.asymmetric(insertion: .opacity, removal: .scale(scale: 0.2, anchor: .leading).combined(with: .opacity)))
                }
            }
            .animation(PFMotion.respecting(PFMotion.snappy), value: segments)
        }
        .frame(height: height)
        .accessibilityHidden(true)
    }

    @ViewBuilder
    private func segmentView(_ kind: PFBandSegment.Kind) -> some View {
        let shape = RoundedRectangle(cornerRadius: PFRadius.bandSegment, style: .continuous)
        switch kind {
        case .overdue: shape.fill(PFColor.danger)
        case .due: shape.fill(PFColor.warning)
        case .waiting: shape.strokeBorder(PFColor.textSubtle, lineWidth: 1.5)
        case .free: shape.fill(PFColor.raised)
        }
    }
}

// MARK: - Avatars

public struct PFAvatar: View {
    let name: String
    let seed: String
    let imageURL: URL?
    let size: CGFloat
    let ring: Bool

    public init(name: String, seed: String? = nil, imageURL: String? = nil, size: CGFloat = 24, ring: Bool = false) {
        self.name = name
        self.seed = seed ?? name
        self.imageURL = imageURL.flatMap(URL.init(string:))
        self.size = size
        self.ring = ring
    }

    public var body: some View {
        ZStack {
            Circle().fill(PFColor.avatar(seed: seed))
            Text(initials)
                .font(.system(size: size * 0.4, weight: .bold, design: .rounded))
                .foregroundStyle(Color.white)
            if let imageURL {
                AsyncImage(url: imageURL) { phase in
                    if let image = phase.image { image.resizable().scaledToFill() } else { Color.clear }
                }
                .clipShape(.circle)
            }
        }
        .frame(width: size, height: size)
        .overlay { if ring { Circle().strokeBorder(PFColor.card, lineWidth: 2) } }
        .accessibilityLabel(name)
    }

    private var initials: String {
        let parts = name.split(separator: " ").prefix(2)
        let letters = parts.compactMap(\.first).map(String.init).joined().uppercased()
        return letters.isEmpty ? "?" : letters
    }
}

public struct PFAvatarStack: View {
    let people: [(id: String, name: String, url: String?)]
    let size: CGFloat
    let limit: Int

    public init(people: [(id: String, name: String, url: String?)], size: CGFloat = 24, limit: Int = 3) {
        self.people = people
        self.size = size
        self.limit = limit
    }

    public var body: some View {
        HStack(spacing: -6) {
            ForEach(Array(people.prefix(limit).enumerated()), id: \.offset) { _, person in
                PFAvatar(name: person.name, seed: person.id, imageURL: person.url, size: size, ring: true)
            }
            if people.count > limit {
                Text("+\(people.count - limit)")
                    .font(.system(size: size * 0.38, weight: .bold))
                    .foregroundStyle(PFColor.textMuted)
                    .frame(width: size, height: size)
                    .background(PFColor.raised, in: .circle)
                    .overlay { Circle().strokeBorder(PFColor.card, lineWidth: 2) }
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(people.map(\.name).joined(separator: ", "))
    }
}

// MARK: - Health ring and progress

/// Health score ring (0–100) with the web health bands as colour.
public struct PFHealthRing: View {
    let score: Double?
    let size: CGFloat
    let lineWidth: CGFloat
    let showsValue: Bool

    public init(score: Double?, size: CGFloat = 36, lineWidth: CGFloat = 4, showsValue: Bool = true) {
        self.score = score
        self.size = size
        self.lineWidth = lineWidth
        self.showsValue = showsValue
    }

    public var body: some View {
        ZStack {
            Circle().stroke(PFColor.raised, lineWidth: lineWidth)
            Circle()
                .trim(from: 0, to: CGFloat((score ?? 0) / 100))
                .stroke(color, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .animation(PFMotion.respecting(PFMotion.smooth), value: score)
            if showsValue {
                Text(score.map { "\(Int($0.rounded()))" } ?? "–")
                    .font(.system(size: size * 0.32, weight: .bold, design: .rounded))
                    .monospacedDigit()
                    .foregroundStyle(PFColor.textMain)
            }
        }
        .frame(width: size, height: size)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text("Health"))
        .accessibilityValue(score.map { "\(Int($0.rounded()))" } ?? "–")
    }

    /// Bands from `healthService.ts`: ≥88 excellent, ≥74 healthy, ≥55 normal, ≥35 warning, else critical.
    private var color: Color {
        guard let score else { return PFColor.textSubtle }
        switch score {
        case 74...: return PFColor.success
        case 55..<74: return PFColor.statusBase(.open)
        case 35..<55: return PFColor.warning
        default: return PFColor.danger
        }
    }
}

public struct PFProgressBar: View {
    let value: Double
    let height: CGFloat

    public init(value: Double, height: CGFloat = 6) {
        self.value = value
        self.height = height
    }

    public var body: some View {
        GeometryReader { proxy in
            ZStack(alignment: .leading) {
                Capsule().fill(PFColor.raised)
                Capsule().fill(PFColor.primary)
                    .frame(width: max(proxy.size.width * min(max(value, 0), 1), value > 0 ? height : 0))
                    .animation(PFMotion.respecting(PFMotion.smooth), value: value)
            }
        }
        .frame(height: height)
        .accessibilityElement()
        .accessibilityValue("\(Int(value * 100)) %")
    }
}

/// Small coloured dot (group headers, board columns, status).
public struct PFDot: View {
    let color: Color
    let size: CGFloat

    public init(_ color: Color, size: CGFloat = 8) {
        self.color = color
        self.size = size
    }

    public var body: some View {
        Circle().fill(color).frame(width: size, height: size).accessibilityHidden(true)
    }
}

/// Count pill used in group headers (13/700 label + count).
public struct PFCountPill: View {
    let count: Int
    let tint: Color?

    public init(_ count: Int, tint: Color? = nil) {
        self.count = count
        self.tint = tint
    }

    public var body: some View {
        Text("\(count)")
            .font(.system(size: 12, weight: .bold))
            .monospacedDigit()
            .padding(.horizontal, 7)
            .frame(minWidth: 22, minHeight: 20)
            .foregroundStyle(tint ?? PFColor.textMuted)
            .background((tint ?? PFColor.textMuted).opacity(0.14), in: .capsule)
    }
}

/// Pulsing focus dot (the web focus pill pulses every 1.8 s).
public struct PFPulseDot: View {
    let color: Color
    @State private var on = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    public init(color: Color = PFColor.primary) { self.color = color }

    public var body: some View {
        Circle()
            .fill(color)
            .frame(width: 9, height: 9)
            .background {
                Circle().fill(color.opacity(0.18)).scaleEffect(on ? 2.4 : 1.4)
            }
            .onAppear { if !reduceMotion { withAnimation(PFMotion.pulse) { on = true } } }
            .accessibilityHidden(true)
    }
}
