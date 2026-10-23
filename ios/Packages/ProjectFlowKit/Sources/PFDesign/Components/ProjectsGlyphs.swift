import SwiftUI

// Generic building blocks of the Projects / Task detail features: project glyph, trend arrow,
// hero cover, small check circle. Colours only via `PFColor`.

// MARK: - Project glyph

/// Square project icon (continuous radius) with the web monogram fallback. Neutral on purpose:
/// colour is reserved for meaning, so the monogram sits on `raised`.
public struct PFProjectGlyph: View {
    let title: String
    let imageURL: URL?
    let size: CGFloat

    public init(title: String, imageURL: String? = nil, size: CGFloat = 40) {
        self.title = title
        self.imageURL = imageURL.flatMap(URL.init(string:))
        self.size = size
    }

    public var body: some View {
        let shape = RoundedRectangle(cornerRadius: size * 0.28, style: .continuous)
        ZStack {
            shape.fill(PFColor.raised)
            Text(String(title.trimmingCharacters(in: .whitespaces).first.map(String.init) ?? "P").uppercased())
                .font(.system(size: size * 0.42, weight: .heavy, design: .rounded))
                .foregroundStyle(PFColor.textMuted)
            if let imageURL {
                AsyncImage(url: imageURL) { phase in
                    if let image = phase.image { image.resizable().scaledToFill() } else { Color.clear }
                }
                .clipShape(shape)
            }
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}

// MARK: - Trend

public enum PFTrend: Sendable, Hashable {
    case improving, stable, declining

    public init?(raw: String?) {
        switch raw {
        case "improving": self = .improving
        case "stable": self = .stable
        case "declining": self = .declining
        default: return nil
        }
    }
}

/// Tiny trend arrow next to a health score (green up, red down, muted flat).
public struct PFTrendArrow: View {
    let trend: PFTrend
    let size: CGFloat

    public init(_ trend: PFTrend, size: CGFloat = 13) {
        self.trend = trend
        self.size = size
    }

    public var body: some View {
        Image(systemName: symbol)
            .font(.system(size: size, weight: .bold))
            .foregroundStyle(color)
            .accessibilityHidden(true)
    }

    private var symbol: String {
        switch trend {
        case .improving: "arrow.up.right"
        case .stable: "arrow.right"
        case .declining: "arrow.down.right"
        }
    }

    private var color: Color {
        switch trend {
        case .improving: PFColor.successText
        case .stable: PFColor.textMuted
        case .declining: PFColor.dangerText
        }
    }
}

// MARK: - Hero

/// Top of the project screen: a cover image with a scrim that dissolves into the canvas (the web
/// overview hero), or just a bit of air when the project has no cover.
public struct PFHeroCover: View {
    let coverURL: URL?
    let height: CGFloat

    public init(coverURL: String?, height: CGFloat = 220) {
        self.coverURL = coverURL.flatMap(URL.init(string:))
        self.height = height
    }

    public var body: some View {
        if let coverURL {
            Color.clear
                .frame(height: height)
                .overlay {
                    AsyncImage(url: coverURL) { phase in
                        if let image = phase.image {
                            image.resizable().scaledToFill().transition(.opacity)
                        } else {
                            PFColor.raised
                        }
                    }
                }
                .clipped()
                .overlay {
                    LinearGradient(colors: [PFColor.scrim.opacity(0.55), .clear, PFColor.canvas.opacity(0.85), PFColor.canvas],
                                   startPoint: .top, endPoint: .bottom)
                }
                .accessibilityHidden(true)
        }
    }
}

// MARK: - Check circle

/// Compact circular check for subtasks and checklists (18 pt, fills green when done).
public struct PFCheckCircle: View {
    let isOn: Bool
    let label: String
    let action: () -> Void

    public init(isOn: Bool, label: String, action: @escaping () -> Void) {
        self.isOn = isOn
        self.label = label
        self.action = action
    }

    public var body: some View {
        Button {
            if isOn { PFHaptics.selection() } else { PFHaptics.success() }
            action()
        } label: {
            ZStack {
                Circle().strokeBorder(isOn ? PFColor.success : PFColor.textSubtle, lineWidth: 2)
                Circle().fill(PFColor.success).scaleEffect(isOn ? 1 : 0.2).opacity(isOn ? 1 : 0)
                CheckShape()
                    .trim(from: 0, to: isOn ? 1 : 0)
                    .stroke(Color.white, style: StrokeStyle(lineWidth: 2, lineCap: .round, lineJoin: .round))
                    .padding(5)
            }
            .frame(width: 20, height: 20)
            .padding(12)
            .contentShape(.rect)
            .animation(PFMotion.respecting(PFMotion.bouncy), value: isOn)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
        .accessibilityAddTraits(isOn ? [.isButton, .isSelected] : .isButton)
    }
}
