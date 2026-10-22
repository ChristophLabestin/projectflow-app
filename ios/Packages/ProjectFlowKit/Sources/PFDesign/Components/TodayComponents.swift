import SwiftUI
import Observation

// Generic building blocks introduced with the Today / Focus / Work features. Nothing in here knows
// about tasks or projects.

// MARK: - Scroll offset

public extension View {
    /// Reports the vertical scroll offset of the enclosing scroll view (0 at rest, positive when
    /// scrolled down, negative while overscrolling). Apply it to the `ScrollView`.
    func pfScrollOffset(_ onChange: @escaping (CGFloat) -> Void) -> some View {
        onScrollGeometryChange(for: CGFloat.self) { geometry in
            geometry.contentOffset.y + geometry.contentInsets.top
        } action: { _, offset in
            onChange(offset)
        }
    }

    /// Fades and lifts the view in once, staggered by `index` (Reduce Motion: plain fade).
    func pfAppear(_ index: Int = 0) -> some View { modifier(PFAppearModifier(index: index)) }
}

struct PFAppearModifier: ViewModifier {
    let index: Int
    @State private var shown = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func body(content: Content) -> some View {
        content
            .opacity(shown ? 1 : 0)
            .offset(y: shown || reduceMotion ? 0 : 14)
            .onAppear {
                guard !shown else { return }
                withAnimation(PFMotion.smooth.delay(Double(min(index, 8)) * 0.045)) { shown = true }
            }
    }
}

// MARK: - Editorial headline

/// The big editorial sentence: the surrounding words are muted, the emphasised value (a count or a
/// title) is primary. A numeric value rolls to its new number when it changes.
public struct PFEditorialHeadline: View {
    let before: String
    let value: String
    let after: String
    let style: PFTextStyle

    public init(before: String, value: String, after: String, style: PFTextStyle = .display) {
        self.before = before
        self.value = value
        self.after = after
        self.style = style
    }

    public var body: some View {
        Text("\(Text(before).foregroundStyle(PFColor.textMuted))\(Text(value).foregroundStyle(PFColor.primary))\(Text(after).foregroundStyle(PFColor.textMuted))")
            .pfText(style)
            .multilineTextAlignment(.leading)
            .contentTransition(.numericText(countsDown: true))
            .animation(PFMotion.respecting(PFMotion.snappy), value: value)
            .frame(maxWidth: .infinity, alignment: .leading)
            .fixedSize(horizontal: false, vertical: true)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(before + value + after)
            .accessibilityAddTraits(.isHeader)
    }
}

// MARK: - Week strip

/// Seven day columns (weekday letter, date number, a small load bar) in one card. The current day
/// is a solid disc. Tapping a day reports it.
public struct PFWeekStrip: View {
    public struct Day: Identifiable, Hashable {
        public let id: String
        public let weekday: String
        public let number: String
        public let count: Int
        public let isToday: Bool
        public let isWeekend: Bool
        public let accessibilityLabel: String

        public init(id: String, weekday: String, number: String, count: Int, isToday: Bool, isWeekend: Bool, accessibilityLabel: String) {
            self.id = id; self.weekday = weekday; self.number = number; self.count = count
            self.isToday = isToday; self.isWeekend = isWeekend; self.accessibilityLabel = accessibilityLabel
        }
    }

    let days: [Day]
    let onSelect: (Day) -> Void

    public init(days: [Day], onSelect: @escaping (Day) -> Void) {
        self.days = days
        self.onSelect = onSelect
    }

    public var body: some View {
        HStack(spacing: 0) {
            ForEach(days) { day in
                Button {
                    PFHaptics.selection()
                    onSelect(day)
                } label: {
                    VStack(spacing: 8) {
                        Text(day.weekday).pfText(.eyebrow)
                            .foregroundStyle(day.isToday ? PFColor.textMain : PFColor.textMuted)
                        Text(day.number)
                            .pfText(.rowTitle)
                            .foregroundStyle(day.isToday ? PFColor.onPrimary : (day.isWeekend ? PFColor.textMuted : PFColor.textMain))
                            .frame(width: 34, height: 34)
                            .background(day.isToday ? PFColor.primary : Color.clear, in: .circle)
                        loadBar(day)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .contentShape(.rect)
                }
                .buttonStyle(.pfPressable)
                .accessibilityLabel(day.accessibilityLabel)
            }
        }
        .padding(.horizontal, 6)
        .pfCard()
    }

    private func loadBar(_ day: Day) -> some View {
        let height = 4 + CGFloat(min(day.count, 6)) * 4
        return ZStack(alignment: .bottom) {
            Color.clear.frame(width: 5, height: 28)
            Capsule()
                .fill(day.count == 0 ? PFColor.raised : (day.isToday ? PFColor.primary : PFColor.textSubtle.opacity(0.55)))
                .frame(width: 5, height: day.count == 0 ? 4 : height)
        }
        .animation(PFMotion.respecting(PFMotion.snappy), value: day.count)
        .accessibilityHidden(true)
    }
}

// MARK: - Glyph badge

/// Small round glyph tile tinted by meaning (overnight feed, waiting list).
public struct PFGlyphBadge: View {
    let systemImage: String
    let tint: Color
    let size: CGFloat

    public init(_ systemImage: String, tint: Color, size: CGFloat = 28) {
        self.systemImage = systemImage
        self.tint = tint
        self.size = size
    }

    public var body: some View {
        Image(systemName: systemImage)
            .font(.system(size: size * 0.42, weight: .bold))
            .foregroundStyle(tint)
            .frame(width: size, height: size)
            .background(tint.opacity(0.14), in: .circle)
            .accessibilityHidden(true)
    }
}

// MARK: - Inline text

/// Borderless multi-line text input that reads like plain text until edited (focus room next step).
public struct PFInlineTextField: View {
    let placeholder: String
    @Binding var text: String
    let style: PFTextStyle
    let lineLimit: ClosedRange<Int>
    let onCommit: () -> Void
    @FocusState private var focused: Bool

    public init(_ placeholder: String, text: Binding<String>, style: PFTextStyle = .section, lineLimit: ClosedRange<Int> = 1...5,
                onCommit: @escaping () -> Void = {}) {
        self.placeholder = placeholder
        self._text = text
        self.style = style
        self.lineLimit = lineLimit
        self.onCommit = onCommit
    }

    public var body: some View {
        TextField("", text: $text, prompt: Text(placeholder).foregroundStyle(PFColor.textSubtle), axis: .vertical)
            .textFieldStyle(.plain)
            .pfText(style)
            .foregroundStyle(PFColor.textMain)
            .lineLimit(lineLimit)
            .focused($focused)
            .submitLabel(.done)
            .onSubmit { focused = false }
            .onChange(of: focused) { _, isFocused in if !isFocused { onCommit() } }
            .frame(maxWidth: .infinity, alignment: .leading)
            .contentShape(.rect)
            .onTapGesture { focused = true }
    }
}

// MARK: - Drag and drop (long-press lift, snap to drop targets)

/// Shared state of one drag-and-drop surface. Sources lift after a long press and follow the
/// finger; targets register their frames; the hovered target snaps with a haptic tick. All
/// coordinates live in the named coordinate space the surface defines.
@Observable
public final class PFDragCoordinator {
    public private(set) var payload: AnyHashable?
    public private(set) var location: CGPoint = .zero
    public private(set) var hoverTarget: AnyHashable?
    public private(set) var itemFrame: CGRect = .zero
    private var grab: CGSize = .zero
    @ObservationIgnored private var frames: [AnyHashable: CGRect] = [:]

    public init() {}

    public var isDragging: Bool { payload != nil }

    /// Top-left of the lifted item, following the finger.
    public var ghostOrigin: CGPoint { CGPoint(x: location.x - grab.width, y: location.y - grab.height) }

    public func registerTarget(_ id: AnyHashable, frame: CGRect) {
        frames[id] = frame
        if isDragging { updateHover() }
    }

    public func unregisterTarget(_ id: AnyHashable) { frames[id] = nil }

    func begin(_ payload: AnyHashable, frame: CGRect, location: CGPoint) {
        itemFrame = frame
        grab = CGSize(width: location.x - frame.minX, height: location.y - frame.minY)
        self.location = location
        withAnimation(PFMotion.respecting(PFMotion.snappy)) { self.payload = payload }
        updateHover()
    }

    func move(to location: CGPoint) {
        self.location = location
        updateHover()
    }

    /// Ends the drag and returns the target it was released over.
    func end() -> AnyHashable? {
        let target = hoverTarget
        finish()
        return target
    }

    func cancel() { finish() }

    private func finish() {
        withAnimation(PFMotion.respecting(PFMotion.snappy)) {
            payload = nil
            hoverTarget = nil
        }
    }

    private func updateHover() {
        let hit = frames
            .filter { $0.value.contains(location) }
            .min { $0.value.width * $0.value.height < $1.value.width * $1.value.height }?.key
        guard hit != hoverTarget else { return }
        hoverTarget = hit
        if hit != nil { PFHaptics.tap() }
    }

    /// Points per frame to scroll while the finger is near the top or bottom edge (negative = up).
    public func edgeScroll(viewportTop: CGFloat, viewportBottom: CGFloat, inset: CGFloat = 96, maxStep: CGFloat = 16) -> CGFloat {
        guard isDragging else { return 0 }
        if location.y < viewportTop + inset { return -maxStep * min(1, (viewportTop + inset - location.y) / inset) }
        if location.y > viewportBottom - inset { return maxStep * min(1, (location.y - (viewportBottom - inset)) / inset) }
        return 0
    }
}

public extension View {
    /// Makes the view a drop target. `id` is reported as the hover/drop target.
    func pfDropTarget(_ id: AnyHashable, coordinator: PFDragCoordinator, space: String) -> some View {
        self
            .onGeometryChange(for: CGRect.self) { $0.frame(in: .named(space)) } action: { coordinator.registerTarget(id, frame: $0) }
            .onDisappear { coordinator.unregisterTarget(id) }
    }

    /// Makes the view liftable: a long press picks it up, dragging moves it, releasing over a target
    /// calls `onDrop` (with `nil` when released over nothing). Releasing without moving calls `onRelease`
    /// (use it for the peek). Needs a non-lazy container and `scrollDisabled(coordinator.isDragging)`.
    func pfDragSource(_ payload: AnyHashable, coordinator: PFDragCoordinator, space: String,
                      onRelease: @escaping () -> Void = {}, onDrop: @escaping (AnyHashable?) -> Void) -> some View {
        modifier(PFDragSourceModifier(payload: payload, coordinator: coordinator, space: space, onRelease: onRelease, onDrop: onDrop))
    }
}

struct PFDragSourceModifier: ViewModifier {
    let payload: AnyHashable
    let coordinator: PFDragCoordinator
    let space: String
    let onRelease: () -> Void
    let onDrop: (AnyHashable?) -> Void

    @State private var frame: CGRect = .zero
    @State private var started = false
    @State private var travelled: CGFloat = 0
    @GestureState private var isPressing = false

    func body(content: Content) -> some View {
        content
            .opacity(coordinator.payload == payload ? 0.3 : 1)
            .onGeometryChange(for: CGRect.self) { $0.frame(in: .named(space)) } action: { frame = $0 }
            .simultaneousGesture(gesture)
            .onChange(of: isPressing) { _, pressing in
                if !pressing, started {
                    started = false
                    coordinator.cancel()
                }
            }
    }

    private var gesture: some Gesture {
        LongPressGesture(minimumDuration: 0.32, maximumDistance: 12)
            .sequenced(before: DragGesture(minimumDistance: 0, coordinateSpace: .named(space)))
            .updating($isPressing) { _, state, _ in state = true }
            .onChanged { value in
                guard case .second(_, let drag) = value else { return }
                let location = drag?.location ?? CGPoint(x: frame.midX, y: frame.midY)
                if !started {
                    started = true
                    travelled = 0
                    PFHaptics.soft()
                    coordinator.begin(payload, frame: frame, location: location)
                } else {
                    coordinator.move(to: location)
                }
                if let drag { travelled = max(travelled, hypot(drag.translation.width, drag.translation.height)) }
            }
            .onEnded { _ in
                guard started else { return }
                started = false
                let moved = travelled > 8
                let target = coordinator.end()
                if moved { onDrop(target) } else { onRelease() }
            }
    }
}

/// Renders the lifted item above everything else in the drag surface. Place it as an overlay on the
/// view that defines the coordinate space.
public struct PFDragGhost<Content: View>: View {
    let coordinator: PFDragCoordinator
    let content: (AnyHashable) -> Content

    public init(coordinator: PFDragCoordinator, @ViewBuilder content: @escaping (AnyHashable) -> Content) {
        self.coordinator = coordinator
        self.content = content
    }

    public var body: some View {
        ZStack(alignment: .topLeading) {
            if let payload = coordinator.payload {
                content(payload)
                    .frame(width: coordinator.itemFrame.width)
                    .background(PFColor.card, in: .rect(cornerRadius: PFRadius.card, style: .continuous))
                    .pfElevation(.overlay, radius: PFRadius.card)
                    .scaleEffect(1.03)
                    .offset(x: coordinator.ghostOrigin.x, y: coordinator.ghostOrigin.y)
                    .transition(.scale(scale: 0.96).combined(with: .opacity))
                    .accessibilityHidden(true)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .allowsHitTesting(false)
    }
}
