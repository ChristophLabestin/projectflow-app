import SwiftUI

// MARK: - Board

public struct PFBoardColumn: Identifiable, Hashable {
    public let id: String
    public let title: String
    /// Dot and drop-target colour.
    public let dot: Color
    /// Text colour of the count pill (AA-safe tone).
    public let tint: Color

    public init(id: String, title: String, dot: Color, tint: Color) {
        self.id = id
        self.title = title
        self.dot = dot
        self.tint = tint
    }
}

/// Horizontally paged board: one lane per column (85 % wide, the next lane peeks in), a pinned lane
/// header (dot · UPPERCASE title · tinted count) and cards that scroll under it. Long-press a card and
/// drag it to another lane; near the screen edges the board pages on its own.
public struct PFBoard<Item: Identifiable, Card: View>: View where Item.ID == String {
    let columns: [PFBoardColumn]
    let items: [String: [Item]]
    let emptyText: String
    let canMove: Bool
    let card: (Item) -> Card
    let onMove: (Item, String) -> Void

    @State private var position = ScrollPosition(idType: String.self)
    @State private var offsetX: CGFloat = 0
    @State private var boardWidth: CGFloat = 375
    @State private var boardOrigin: CGPoint = .zero
    @State private var drag: DragState?
    @State private var hoverColumn: String?
    @State private var edgeTask: Task<Void, Never>?
    @State private var edgeDirection = 0

    private let spacing: CGFloat = 12
    private let edgeZone: CGFloat = 46

    struct DragState {
        var item: Item
        var point: CGPoint
        var source: String
    }

    public init(columns: [PFBoardColumn], items: [String: [Item]], emptyText: String, canMove: Bool = true,
                @ViewBuilder card: @escaping (Item) -> Card, onMove: @escaping (Item, String) -> Void) {
        self.columns = columns
        self.items = items
        self.emptyText = emptyText
        self.canMove = canMove
        self.card = card
        self.onMove = onMove
    }

    public var body: some View {
        VStack(spacing: 0) {
            columnSwitcher
            lanes
        }
    }

    /// Chips for every column (dot · title · count); the visible lane is highlighted, a tap jumps to it.
    private var columnSwitcher: some View {
        let active = position.viewID(type: String.self) ?? columns.first?.id
        return ScrollViewReader { reader in
            ScrollView(.horizontal) {
                HStack(spacing: 6) {
                    ForEach(columns) { column in
                        let selected = column.id == active
                        Button {
                            PFHaptics.selection()
                            withAnimation(PFMotion.respecting(PFMotion.snappy)) { position.scrollTo(id: column.id) }
                        } label: {
                            HStack(spacing: 6) {
                                PFDot(column.dot, size: 7)
                                Text(column.title).pfText(.buttonSmall).lineLimit(1)
                                Text("\(items[column.id]?.count ?? 0)")
                                    .font(.system(size: 12, weight: .bold)).monospacedDigit()
                                    .foregroundStyle(selected ? PFColor.onPrimary.opacity(0.75) : PFColor.textMuted)
                            }
                            .foregroundStyle(selected ? PFColor.onPrimary : PFColor.textMain)
                            .padding(.horizontal, 12)
                            .frame(minHeight: 32)
                            .background(selected ? PFColor.primary : PFColor.card, in: .capsule)
                            .overlay { Capsule().strokeBorder(PFColor.hairline, lineWidth: selected ? 0 : 1) }
                        }
                        .buttonStyle(.pfPressable)
                        .id(column.id)
                        .accessibilityAddTraits(selected ? [.isButton, .isSelected] : .isButton)
                    }
                }
                .padding(.horizontal, PFSpace.page)
                .padding(.vertical, 10)
            }
            .scrollIndicators(.hidden)
            .onChange(of: active) { _, id in
                guard let id else { return }
                withAnimation(PFMotion.respecting(PFMotion.snappy)) { reader.scrollTo(id, anchor: .center) }
            }
        }
    }

    private var lanes: some View {
        GeometryReader { proxy in
            let laneWidth = Self.laneWidth(for: proxy.size.width)
            ScrollView(.horizontal) {
                LazyHStack(alignment: .top, spacing: spacing) {
                    ForEach(columns) { column in
                        lane(column, width: laneWidth, height: proxy.size.height)
                            .id(column.id)
                    }
                }
                .scrollTargetLayout()
            }
            .contentMargins(.horizontal, PFSpace.page, for: .scrollContent)
            .scrollTargetBehavior(.viewAligned)
            .scrollPosition($position)
            .scrollIndicators(.hidden)
            .scrollDisabled(drag != nil)
            .onScrollGeometryChange(for: CGFloat.self) { $0.contentOffset.x } action: { _, value in offsetX = value }
            .overlay(alignment: .topLeading) {
                if let drag {
                    card(drag.item)
                        .frame(width: laneWidth - 20)
                        .scaleEffect(1.04)
                        .rotationEffect(.degrees(1.6))
                        .shadow(color: .black.opacity(0.28), radius: 18, y: 10)
                        .position(x: drag.point.x, y: drag.point.y)
                        .allowsHitTesting(false)
                        .accessibilityHidden(true)
                }
            }
            .onGeometryChange(for: CGPoint.self) { $0.frame(in: .global).origin } action: { boardOrigin = $0 }
            .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { boardWidth = $0 }
        }
    }

    // MARK: Lane

    @ViewBuilder
    private func lane(_ column: PFBoardColumn, width: CGFloat, height: CGFloat) -> some View {
        let cards = items[column.id] ?? []
        let isTarget = hoverColumn == column.id && drag != nil && drag?.source != column.id
        VStack(spacing: 0) {
            HStack(spacing: 8) {
                PFDot(column.dot)
                Text(column.title).pfText(.eyebrow).foregroundStyle(PFColor.textMain).lineLimit(1)
                PFCountPill(cards.count, tint: column.tint)
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 14)
            .padding(.top, 8)
            .frame(height: 54)
            .accessibilityElement(children: .combine)
            .accessibilityAddTraits(.isHeader)

            ScrollView(.vertical) {
                LazyVStack(spacing: 10) {
                    ForEach(cards) { item in
                        card(item)
                            .opacity(drag?.item.id == item.id ? 0.25 : 1)
                            .gesture(dragGesture(item, from: column.id), isEnabled: canMove)
                    }
                    if cards.isEmpty {
                        Text(emptyText)
                            .pfText(.meta)
                            .foregroundStyle(PFColor.textMuted)
                            .frame(maxWidth: .infinity, minHeight: 84)
                            .overlay {
                                RoundedRectangle(cornerRadius: PFRadius.card, style: .continuous)
                                    .strokeBorder(PFColor.hairlineStrong, style: StrokeStyle(lineWidth: 1.5, dash: [5, 5]))
                            }
                    }
                }
                .padding(.horizontal, 10)
                .padding(.bottom, 120)
            }
            .scrollIndicators(.hidden)
            .scrollDisabled(drag != nil)
        }
        .frame(width: width, height: height)
        // Lanes read as their own surface: solid raised fill with a faint status tint, hairline ring
        // and a status-coloured accent along the top edge.
        .background {
            let shape = RoundedRectangle(cornerRadius: 22, style: .continuous)
            ZStack(alignment: .top) {
                shape.fill(PFColor.raised)
                shape.fill(column.dot.opacity(isTarget ? 0.16 : 0.07))
                Capsule().fill(column.dot).frame(width: 36, height: 4).padding(.top, 6)
            }
        }
        .overlay {
            RoundedRectangle(cornerRadius: 22, style: .continuous)
                .strokeBorder(isTarget ? column.dot.opacity(0.8) : PFColor.hairlineStrong.opacity(0.7), lineWidth: isTarget ? 2 : 1)
        }
        .animation(PFMotion.fast, value: isTarget)
    }

    // MARK: Drag

    /// Long-press, then drag. Starts only after the press, so vertical scrolling stays untouched.
    private func dragGesture(_ item: Item, from source: String) -> some Gesture {
        LongPressGesture(minimumDuration: 0.35, maximumDistance: 12)
            .sequenced(before: DragGesture(minimumDistance: 0, coordinateSpace: .global))
            .onChanged { value in
                guard case .second(true, let drag?) = value else { return }
                if self.drag == nil { began(item, from: source, at: drag.startLocation) }
                moved(drag.location)
            }
            .onEnded { value in
                if case .second(true, let drag?) = value { ended(drag.location, cancelled: false) } else { ended(.zero, cancelled: true) }
            }
    }

    private func local(_ window: CGPoint) -> CGPoint { CGPoint(x: window.x - boardOrigin.x, y: window.y - boardOrigin.y) }

    private func column(atX x: CGFloat, laneWidth: CGFloat) -> String? {
        guard !columns.isEmpty else { return nil }
        let index = Int(((x + offsetX) / (laneWidth + spacing)).rounded(.down))
        return columns[min(max(index, 0), columns.count - 1)].id
    }

    private func began(_ item: Item, from source: String, at window: CGPoint) {
        PFHaptics.tap()
        withAnimation(PFMotion.respecting(PFMotion.snappy)) {
            drag = DragState(item: item, point: local(window), source: source)
        }
        hoverColumn = source
    }

    private func moved(_ window: CGPoint) {
        guard drag != nil else { return }
        let point = local(window)
        drag?.point = point
        let hovered = column(atX: point.x, laneWidth: laneWidth)
        if hovered != hoverColumn {
            hoverColumn = hovered
            PFHaptics.selection()
        }
        let direction = point.x < edgeZone ? -1 : (point.x > boardWidth - edgeZone ? 1 : 0)
        updateEdge(direction, laneWidth: laneWidth)
    }

    private func ended(_ window: CGPoint, cancelled: Bool) {
        edgeTask?.cancel()
        edgeTask = nil
        edgeDirection = 0
        defer {
            withAnimation(PFMotion.respecting(PFMotion.snappy)) { drag = nil }
            hoverColumn = nil
        }
        guard let drag, !cancelled else { return }
        let target = column(atX: local(window).x, laneWidth: laneWidth)
        if let target, target != drag.source {
            PFHaptics.success()
            onMove(drag.item, target)
        }
    }

    private var laneWidth: CGFloat { Self.laneWidth(for: boardWidth) }

    /// Phone: one lane at 82 % so the next one peeks in. Wide boards (iPhone Duo opened) show as many lanes
    /// of at least `PFLayout.minLaneWidth` as fit side by side.
    static func laneWidth(for width: CGFloat) -> CGFloat {
        let usable = width - 2 * PFSpace.page
        let count = Int((usable + 12) / (PFLayout.minLaneWidth + 12))
        guard count >= 2 else { return (width * 0.82).rounded() }
        let lanes = CGFloat(count)
        return ((usable - 12 * (lanes - 1)) / lanes).rounded(.down)
    }

    private func updateEdge(_ direction: Int, laneWidth: CGFloat) {
        guard direction != edgeDirection else { return }
        edgeDirection = direction
        edgeTask?.cancel()
        edgeTask = nil
        guard direction != 0 else { return }
        edgeTask = Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(550))
            while !Task.isCancelled, edgeDirection == direction {
                let current = Int((offsetX / (laneWidth + spacing)).rounded())
                let next = min(max(current + direction, 0), columns.count - 1)
                if next != current {
                    withAnimation(PFMotion.respecting(PFMotion.smooth)) { position.scrollTo(id: columns[next].id, anchor: .leading) }
                    PFHaptics.soft()
                }
                try? await Task.sleep(for: .milliseconds(700))
            }
        }
    }
}
