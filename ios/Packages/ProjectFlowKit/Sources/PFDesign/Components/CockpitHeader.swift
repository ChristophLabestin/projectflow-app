import SwiftUI
import PFModel

/// One part of the cockpit eyebrow ("● Aktiv · Hoch · fällig Fr, 13. Nov").
public struct CockpitEyebrowItem: Identifiable, Hashable {
    public let id: String
    public let text: String
    public var dot: Color?
    public var tint: Color?
    public var priority: TaskPriority?

    public init(id: String, text: String, dot: Color? = nil, tint: Color? = nil, priority: TaskPriority? = nil) {
        self.id = id; self.text = text; self.dot = dot; self.tint = tint; self.priority = priority
    }
}

/// Light, theme-following header of the project cockpit. It sits on the dotted canvas: a soft cover
/// image (dissolving into the canvas) or a large monogram watermark, then eyebrow, display title and
/// the one-line situation sentence. The top bar buttons float above it (drawn by the screen).
public struct CockpitHeader: View {
    let title: String
    let monogram: String
    let iconURL: String?
    let coverURL: String?
    let eyebrow: [CockpitEyebrowItem]
    let situation: Text?
    let topInset: CGFloat

    public init(title: String, monogram: String, iconURL: String?, coverURL: String?, eyebrow: [CockpitEyebrowItem], situation: Text?, topInset: CGFloat) {
        self.title = title
        self.monogram = monogram
        self.iconURL = iconURL
        self.coverURL = coverURL.flatMap { $0.isEmpty ? nil : $0 }
        self.eyebrow = eyebrow
        self.situation = situation
        self.topInset = topInset
    }

    public var body: some View {
        let hasCover = coverURL != nil
        VStack(alignment: .leading, spacing: 0) {
            VStack(alignment: .leading, spacing: 12) {
                    Color.clear.frame(height: topInset + (hasCover ? 150 : 58))
                    if !hasCover {
                        PFProjectGlyph(title: title, imageURL: iconURL, size: 56)
                    }
                    eyebrowRow
                    Text(title)
                        .pfText(.display)
                        .foregroundStyle(PFColor.textMain)
                        .fixedSize(horizontal: false, vertical: true)
                        .accessibilityAddTraits(.isHeader)
                    if let situation {
                        situation
                            .pfText(.body)
                            .foregroundStyle(PFColor.textMuted)
                            .lineSpacing(3)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                .padding(.horizontal, PFSpace.page)
                .frame(maxWidth: .infinity, alignment: .leading)
                // The monogram / cover is decoration only: as a background it never adds height.
                .background(alignment: .topLeading) { art(hasCover: hasCover) }
        }
    }

    @ViewBuilder
    private func art(hasCover: Bool) -> some View {
        if let coverURL {
            PFHeroCover(coverURL: coverURL, height: topInset + 250)
        } else {
            Text(monogram)
                .font(.system(size: 250, weight: .black, design: .rounded))
                .foregroundStyle(PFColor.textMain.opacity(0.045))
                .lineLimit(1)
                .minimumScaleFactor(0.5)
                .offset(x: 120, y: topInset - 10)
                .frame(maxWidth: .infinity, alignment: .topLeading)
                .clipped()
                .accessibilityHidden(true)
                .allowsHitTesting(false)
        }
    }

    private var eyebrowRow: some View {
        HStack(spacing: 6) {
            ForEach(Array(eyebrow.enumerated()), id: \.element.id) { index, item in
                if index > 0 { Text("·").pfText(.eyebrow).foregroundStyle(PFColor.textSubtle) }
                if let dot = item.dot { PFDot(dot, size: 7) }
                if let priority = item.priority { PFPrioritySignal(priority) }
                PFEyebrow(item.text, color: item.tint ?? PFColor.textMuted)
            }
        }
        .lineLimit(1)
        .minimumScaleFactor(0.8)
    }
}

/// Underline tab bar of the cockpit (Überblick · Aufgaben · Board · Plan · Team). Meant to be shown twice:
/// in the flow and as a pinned copy under the top bar once the flow copy has scrolled away.
public struct CockpitTabBar<Value: Hashable>: View {
    public struct Option {
        public let value: Value
        public let label: String
        public let badge: Int?
        public init(_ value: Value, _ label: String, badge: Int? = nil) { self.value = value; self.label = label; self.badge = badge }
    }

    let options: [Option]
    @Binding var selection: Value
    let namespace: Namespace.ID

    public init(_ options: [Option], selection: Binding<Value>, namespace: Namespace.ID) {
        self.options = options
        self._selection = selection
        self.namespace = namespace
    }

    public var body: some View {
        ScrollViewReader { reader in
            ScrollView(.horizontal) {
                HStack(spacing: 24) {
                    ForEach(options, id: \.value) { option in
                        tab(option)
                    }
                }
                .padding(.horizontal, PFSpace.page)
            }
            .scrollIndicators(.hidden)
            .onChange(of: selection) { _, value in
                withAnimation(PFMotion.respecting(PFMotion.snappy)) { reader.scrollTo(value, anchor: .center) }
            }
        }
        .frame(height: 44)
        .overlay(alignment: .bottom) { Rectangle().fill(PFColor.hairline).frame(height: 1) }
    }

    private func tab(_ option: Option) -> some View {
        let selected = option.value == selection
        return Button {
            guard !selected else { return }
            PFHaptics.selection()
            withAnimation(PFMotion.respecting(PFMotion.snappy)) { selection = option.value }
        } label: {
            VStack(spacing: 0) {
                Spacer(minLength: 0)
                HStack(spacing: 5) {
                    Text(option.label).pfText(.button)
                    if let badge = option.badge, badge > 0 {
                        Text("\(badge)").pfText(.caption).foregroundStyle(PFColor.textSubtle)
                    }
                }
                .foregroundStyle(selected ? PFColor.textMain : PFColor.textMuted)
                .lineLimit(1)
                Spacer(minLength: 0)
                ZStack {
                    Capsule().fill(Color.clear).frame(height: 2.5)
                    if selected {
                        Capsule().fill(PFColor.textMain).frame(height: 2.5)
                            .matchedGeometryEffect(id: "cockpit-underline", in: namespace)
                    }
                }
            }
            .frame(minWidth: 36)
            .contentShape(.rect)
        }
        .buttonStyle(.plain)
        .id(option.value)
        .accessibilityAddTraits(selected ? [.isButton, .isSelected] : .isButton)
    }
}

/// Progress ring with the percentage in the middle (momentum card).
public struct CockpitRing: View {
    let value: Double
    let size: CGFloat
    let lineWidth: CGFloat
    let tint: Color

    public init(value: Double, size: CGFloat = 92, lineWidth: CGFloat = 9, tint: Color = PFColor.textMain) {
        self.value = value; self.size = size; self.lineWidth = lineWidth; self.tint = tint
    }

    public var body: some View {
        ZStack {
            Circle().stroke(PFColor.raised, lineWidth: lineWidth)
            Circle()
                .trim(from: 0, to: max(0.001, min(1, value)))
                .stroke(tint, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .animation(PFMotion.respecting(PFMotion.smooth), value: value)
            HStack(alignment: .firstTextBaseline, spacing: 1) {
                Text("\(Int((value * 100).rounded()))")
                    .font(.system(size: size * 0.31, weight: .heavy, design: .rounded))
                    .contentTransition(.numericText())
                Text("%").font(.system(size: size * 0.15, weight: .bold, design: .rounded)).foregroundStyle(PFColor.textMuted)
            }
            .foregroundStyle(PFColor.textMain)
        }
        .frame(width: size, height: size)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text("\(Int((value * 100).rounded())) %"))
    }
}
