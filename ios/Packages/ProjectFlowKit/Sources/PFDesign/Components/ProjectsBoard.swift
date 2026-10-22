import SwiftUI
import UIKit

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
        GeometryReader { proxy in
            let laneWidth = (proxy.size.width * 0.85).rounded()
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
            .frame(height: 46)
            .accessibilityElement(children: .combine)
            .accessibilityAddTraits(.isHeader)

            ScrollView(.vertical) {
                LazyVStack(spacing: 10) {
                    ForEach(cards) { item in
                        card(item)
                            .opacity(drag?.item.id == item.id ? 0.25 : 1)
                            .gesture(PFBoardPressDrag(
                                enabled: canMove,
                                onBegan: { began(item, from: column.id, at: $0) },
                                onMoved: { moved($0) },
                                onEnded: { ended($0, cancelled: $1) }))
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
        .background(PFColor.raised.opacity(isTarget ? 0.95 : 0.5), in: .rect(cornerRadius: 22, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 22, style: .continuous)
                .strokeBorder(column.dot.opacity(isTarget ? 0.7 : 0), lineWidth: 2)
        }
        .animation(PFMotion.fast, value: isTarget)
    }

    // MARK: Drag

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

    private var laneWidth: CGFloat { (boardWidth * 0.85).rounded() }

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

/// Long-press that keeps reporting while the finger moves (UIKit, so vertical scrolling stays intact
/// until the press has been recognised). Points are in window coordinates.
struct PFBoardPressDrag: UIGestureRecognizerRepresentable {
    let enabled: Bool
    let onBegan: (CGPoint) -> Void
    let onMoved: (CGPoint) -> Void
    let onEnded: (CGPoint, Bool) -> Void

    func makeUIGestureRecognizer(context: Context) -> UILongPressGestureRecognizer {
        let recognizer = UILongPressGestureRecognizer()
        recognizer.minimumPressDuration = 0.35
        recognizer.allowableMovement = 10
        return recognizer
    }

    func updateUIGestureRecognizer(_ recognizer: UILongPressGestureRecognizer, context: Context) {
        recognizer.isEnabled = enabled
    }

    func handleUIGestureRecognizerAction(_ recognizer: UILongPressGestureRecognizer, context: Context) {
        let point = recognizer.location(in: nil)
        switch recognizer.state {
        case .began: onBegan(point)
        case .changed: onMoved(point)
        case .ended: onEnded(point, false)
        case .cancelled, .failed: onEnded(point, true)
        default: break
        }
    }
}
