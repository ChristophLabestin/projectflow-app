import SwiftUI

// Brand motion for the cold start and the sign-in screen: the dotted canvas carries a ripple that lights
// the dots up in the status colours, the glyph floats on a disc with four orbiting status dots, and text
// reveals letter by letter. Everything stands still with Reduce Motion.

/// The four status hues the brand motion cycles through (open, planning, review, done).
public enum PFBrandPalette {
    public static let colors: [Color] = [
        PFColor.statusBase(.open), PFColor.statusBase(.planning), PFColor.statusBase(.review), PFColor.statusBase(.done),
    ]
    /// Text-safe tones of the same hues (for words set in the brand colours).
    public static let textColors: [Color] = [
        PFColor.statusText(.open), PFColor.statusText(.planning), PFColor.statusText(.review), PFColor.statusText(.done),
    ]
}

/// The dotted canvas with ripples running out from `center` (in this view's coordinates). Dots inside a
/// wave front grow and take the colour of their direction from the centre.
public struct PFFlowField: View {
    let center: CGPoint?
    let period: Double
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    /// `center` nil = the middle of the view.
    public init(center: CGPoint? = nil, period: Double = 3.6) {
        self.center = center
        self.period = period
    }

    public var body: some View {
        ZStack {
            PFColor.canvas
            TimelineView(.animation(minimumInterval: 1 / 60, paused: reduceMotion)) { timeline in
                let time = reduceMotion ? 0 : timeline.date.timeIntervalSinceReferenceDate
                Canvas { context, size in draw(in: &context, size: size, time: time) }
            }
        }
        .ignoresSafeArea()
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }

    private func draw(in context: inout GraphicsContext, size: CGSize, time: Double) {
        let spacing: CGFloat = 20
        let origin = center ?? CGPoint(x: size.width / 2, y: size.height / 2)
        let reach = hypot(max(origin.x, size.width - origin.x), max(origin.y, size.height - origin.y)) * 1.05
        let band: CGFloat = 54
        // Two fronts half a period apart, each fading as it travels out.
        let phases = reduceMotion ? [] : [0.0, 0.5].map { (time / period + $0).truncatingRemainder(dividingBy: 1) }
        let palette = PFBrandPalette.colors

        var y = spacing / 2
        while y < size.height {
            var x = spacing / 2
            while x < size.width {
                let dx = x - origin.x, dy = y - origin.y
                let distance = hypot(dx, dy)
                var boost: CGFloat = 0
                for phase in phases {
                    let delta = abs(distance - CGFloat(phase) * reach)
                    if delta < band { boost = max(boost, (1 - delta / band) * CGFloat(1 - phase)) }
                }
                let radius = 0.75 + 1.7 * boost
                let rect = CGRect(x: x - radius, y: y - radius, width: radius * 2, height: radius * 2)
                if boost > 0.04 {
                    let angle = atan2(dy, dx) + .pi // 0…2π
                    let index = Int(angle / (2 * .pi) * CGFloat(palette.count)) % palette.count
                    context.fill(Path(ellipseIn: rect), with: .color(palette[index].opacity(0.18 + 0.62 * boost)))
                } else {
                    context.fill(Path(ellipseIn: rect), with: .color(PFColor.dot))
                }
                x += spacing
            }
            y += spacing
        }
    }
}

/// The glyph on a floating disc, a breathing ring and four status dots on a tilted orbit.
public struct PFBrandMark: View {
    let glyph: Image
    let size: CGFloat
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    /// `size` is the glyph size; the mark is about 2.6 × as wide.
    public init(glyph: Image, size: CGFloat = 44) {
        self.glyph = glyph
        self.size = size
    }

    public var body: some View {
        TimelineView(.animation(paused: reduceMotion)) { timeline in
            let time = reduceMotion ? 0.6 : timeline.date.timeIntervalSinceReferenceDate
            ZStack {
                // Slowly turning aurora of the status hues behind the disc.
                Circle()
                    .fill(AngularGradient(colors: PFBrandPalette.colors + [PFBrandPalette.colors[0]], center: .center))
                    .frame(width: size * 2.2, height: size * 2.2)
                    .rotationEffect(.radians(time * 0.4))
                    .blur(radius: size * 0.55)
                    .opacity(0.32)
                Circle()
                    .stroke(PFColor.hairlineStrong, lineWidth: 1)
                    .frame(width: size * 2.55, height: size * 2.55)
                    .scaleEffect(1 + 0.035 * sin(time * 1.7))
                    .opacity(0.8 - 0.3 * sin(time * 1.7))
                orbit(time: time, front: false)
                Circle()
                    .fill(PFColor.card)
                    .frame(width: size * 1.7, height: size * 1.7)
                    .pfElevation(.overlay, radius: size * 0.85)
                    .offset(y: -2 * sin(time * 1.2))
                glyph
                    .resizable()
                    .renderingMode(.template)
                    .foregroundStyle(PFColor.textMain)
                    .frame(width: size, height: size)
                    .offset(y: -2 * sin(time * 1.2))
                orbit(time: time, front: true)
            }
            .frame(width: size * 2.7, height: size * 2.7)
        }
        .accessibilityHidden(true)
    }

    /// Dots on an ellipse tilted by -18°: the ones on the far side are drawn behind the disc, smaller and paler.
    private func orbit(time: Double, front: Bool) -> some View {
        let tilt = -18.0 * .pi / 180
        return ZStack {
            ForEach(0..<PFBrandPalette.colors.count, id: \.self) { index in
                let angle = time * 0.85 + Double(index) * .pi / 2
                let depth = sin(angle) // > 0 = in front of the disc
                if (depth >= 0) == front {
                    let x = cos(angle) * size * 1.3
                    let y = sin(angle) * size * 0.42
                    Circle()
                        .fill(PFBrandPalette.colors[index])
                        .frame(width: size * 0.16, height: size * 0.16)
                        .scaleEffect(0.75 + 0.35 * (depth + 1) / 2)
                        .opacity(0.55 + 0.45 * (depth + 1) / 2)
                        .offset(x: x * cos(tilt) - y * sin(tilt), y: x * sin(tilt) + y * cos(tilt))
                }
            }
        }
    }
}

/// Text that rises in letter by letter (blur → sharp).
public struct PFStaggeredText: View {
    let text: String
    let style: PFTextStyle
    let delay: Double
    @State private var shown = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    public init(_ text: String, style: PFTextStyle = .displayLarge, delay: Double = 0) {
        self.text = text
        self.style = style
        self.delay = delay
    }

    public var body: some View {
        HStack(spacing: 0) {
            ForEach(Array(text.enumerated()), id: \.offset) { index, character in
                Text(String(character))
                    .pfText(style)
                    .opacity(shown ? 1 : 0)
                    .offset(y: shown || reduceMotion ? 0 : 16)
                    .blur(radius: shown || reduceMotion ? 0 : 6)
                    .animation(.spring(response: 0.6, dampingFraction: 0.8).delay(delay + Double(index) * 0.035), value: shown)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(text)
        .onAppear { shown = true }
    }
}

/// Indeterminate progress: a short segment gliding along a hairline track.
public struct PFLoadingTrack: View {
    let width: CGFloat
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    public init(width: CGFloat = 132) { self.width = width }

    public var body: some View {
        TimelineView(.animation(paused: reduceMotion)) { timeline in
            let time = timeline.date.timeIntervalSinceReferenceDate
            // Ease in and out across the track, then come back.
            let progress = reduceMotion ? 0.5 : (1 - cos(time * 2.2)) / 2
            let segment = width * 0.3
            ZStack(alignment: .leading) {
                Capsule().fill(PFColor.raised)
                Capsule().fill(PFColor.textMain)
                    .frame(width: segment)
                    .offset(x: (width - segment) * progress)
            }
            .frame(width: width, height: 3)
        }
        .accessibilityHidden(true)
    }
}

/// One word out of `words`, changing every `interval` seconds with a vertical push.
public struct PFRotatingWord: View {
    let words: [String]
    let style: PFTextStyle
    let interval: Double
    @State private var index = 0
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    public init(_ words: [String], style: PFTextStyle = .display, interval: Double = 2.4) {
        self.words = words
        self.style = style
        self.interval = interval
    }

    public var body: some View {
        let word = words.isEmpty ? "" : words[index % words.count]
        Text(word)
            .pfText(style)
            .foregroundStyle(PFBrandPalette.textColors[index % PFBrandPalette.textColors.count])
            .id(index)
            .transition(.asymmetric(insertion: .move(edge: .bottom).combined(with: .opacity),
                                    removal: .move(edge: .top).combined(with: .opacity)))
            .frame(maxWidth: .infinity)
            .clipped()
            .accessibilityLabel(words.first ?? "")
            .task(id: words) {
                guard !reduceMotion, words.count > 1 else { return }
                while !Task.isCancelled {
                    try? await Task.sleep(for: .seconds(interval))
                    withAnimation(.spring(response: 0.55, dampingFraction: 0.85)) { index += 1 }
                }
            }
    }
}
