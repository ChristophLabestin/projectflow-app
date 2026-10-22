import SwiftUI
import Observation

// MARK: - Presenter (custom sheets and peek, replaces .sheet / .contextMenu)

public enum PFDetent: Hashable, Sendable {
    /// Height follows the content (max 92 % of the screen).
    case fit
    case fraction(CGFloat)
    case large
}

public struct PFPeekAction: Identifiable {
    public enum Role: Sendable { case normal, destructive }
    public let id = UUID()
    public let title: String
    public let systemImage: String
    public let role: Role
    public let handler: @MainActor () -> Void

    public init(_ title: String, systemImage: String, role: Role = .normal, handler: @escaping @MainActor () -> Void) {
        self.title = title
        self.systemImage = systemImage
        self.role = role
        self.handler = handler
    }
}

@Observable
public final class PFPresenter {
    public struct Sheet: Identifiable {
        public let id = UUID()
        let detents: [PFDetent]
        let content: AnyView
        let onDismiss: (@MainActor () -> Void)?
        let dismissable: Bool
    }

    public struct Peek: Identifiable {
        public let id = UUID()
        let preview: AnyView
        let actions: [PFPeekAction]
    }

    public private(set) var sheets: [Sheet] = []
    public private(set) var peek: Peek?

    public init() {}

    public var isPresenting: Bool { !sheets.isEmpty || peek != nil }

    public func present<Content: View>(detents: [PFDetent] = [.fit], dismissable: Bool = true,
                                       onDismiss: (@MainActor () -> Void)? = nil, @ViewBuilder content: () -> Content) {
        let sheet = Sheet(detents: detents.isEmpty ? [.fit] : detents, content: AnyView(content()), onDismiss: onDismiss, dismissable: dismissable)
        withAnimation(PFMotion.respecting(PFMotion.snappy)) { sheets.append(sheet) }
    }

    public func dismiss() {
        guard let last = sheets.last else { return }
        withAnimation(PFMotion.respecting(PFMotion.snappy)) { _ = sheets.popLast() }
        last.onDismiss?()
    }

    public func dismissAll() {
        let all = sheets
        withAnimation(PFMotion.respecting(PFMotion.snappy)) { sheets.removeAll() }
        all.reversed().forEach { $0.onDismiss?() }
    }

    public func showPeek<Preview: View>(actions: [PFPeekAction], @ViewBuilder preview: () -> Preview) {
        PFHaptics.soft()
        withAnimation(PFMotion.respecting(PFMotion.bouncy)) { peek = Peek(preview: AnyView(preview()), actions: actions) }
    }

    public func dismissPeek() {
        withAnimation(PFMotion.respecting(PFMotion.normal)) { peek = nil }
    }
}

/// Renders presented sheets and the peek overlay. Place once at the app root, above everything.
public struct PFPresenterHost: View {
    @Bindable var presenter: PFPresenter

    public init(presenter: PFPresenter) { self.presenter = presenter }

    public var body: some View {
        ZStack {
            ForEach(Array(presenter.sheets.enumerated()), id: \.element.id) { index, sheet in
                PFSheetView(sheet: sheet, isTop: index == presenter.sheets.count - 1, presenter: presenter)
                    .zIndex(Double(index) * 2 + 1)
            }
            if let peek = presenter.peek {
                PFPeekView(peek: peek, presenter: presenter).zIndex(1000)
            }
        }
        .environment(presenter)
    }
}

struct PFSheetView: View {
    let sheet: PFPresenter.Sheet
    let isTop: Bool
    let presenter: PFPresenter
    @State private var drag: CGFloat = 0
    @State private var detentIndex = 0
    @State private var contentHeight: CGFloat = 0
    @State private var appeared = false

    var body: some View {
        GeometryReader { proxy in
            let maxHeight = proxy.size.height * 0.94
            let height = resolvedHeight(sheet.detents[min(detentIndex, sheet.detents.count - 1)], max: maxHeight)
            ZStack(alignment: .bottom) {
                PFColor.scrim
                    .opacity(isTop ? 1 : 0.4)
                    .ignoresSafeArea()
                    .onTapGesture { if sheet.dismissable { presenter.dismiss() } }
                    .transition(.opacity)
                    .accessibilityHidden(true)

                VStack(spacing: 0) {
                    grabber
                    sheet.content
                        .frame(maxWidth: .infinity, alignment: .top)
                        .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { contentHeight = $0 + 28 }
                }
                .frame(height: min(height, maxHeight), alignment: .top)
                .frame(maxWidth: .infinity)
                .background(PFColor.card, in: UnevenRoundedRectangle(topLeadingRadius: PFRadius.surface, topTrailingRadius: PFRadius.surface, style: .continuous))
                .background(alignment: .bottom) { PFColor.card.frame(height: proxy.safeAreaInsets.bottom + 40).offset(y: proxy.safeAreaInsets.bottom + 20) }
                .shadow(color: .black.opacity(0.18), radius: 30, y: -6)
                .offset(y: max(drag, -24) + (drag < 0 ? drag * 0.1 : 0))
                .transition(.move(edge: .bottom))
                .accessibilityAction(.escape) { if sheet.dismissable { presenter.dismiss() } }
                .accessibilityAddTraits(.isModal)
            }
        }
    }

    private var grabber: some View {
        Capsule()
            .fill(PFColor.hairlineStrong)
            .frame(width: 40, height: 5)
            .frame(maxWidth: .infinity, minHeight: 28)
            .contentShape(.rect)
            .gesture(
                DragGesture()
                    .onChanged { drag = $0.translation.height }
                    .onEnded { value in
                        let predicted = value.predictedEndTranslation.height
                        if predicted > 220 || value.translation.height > 160, sheet.dismissable {
                            drag = 0
                            presenter.dismiss()
                        } else if predicted < -120, detentIndex < sheet.detents.count - 1 {
                            withAnimation(PFMotion.snappy) { detentIndex += 1; drag = 0 }
                        } else if predicted > 120, detentIndex > 0 {
                            withAnimation(PFMotion.snappy) { detentIndex -= 1; drag = 0 }
                        } else {
                            withAnimation(PFMotion.snappy) { drag = 0 }
                        }
                    }
            )
            .accessibilityHidden(true)
    }

    private func resolvedHeight(_ detent: PFDetent, max: CGFloat) -> CGFloat {
        switch detent {
        case .fit: contentHeight > 0 ? contentHeight : max * 0.5
        case .fraction(let f): max * f
        case .large: max
        }
    }
}

struct PFPeekView: View {
    let peek: PFPresenter.Peek
    let presenter: PFPresenter

    var body: some View {
        ZStack {
            Rectangle().fill(.ultraThinMaterial).ignoresSafeArea()
                .overlay(PFColor.scrim.opacity(0.4).ignoresSafeArea())
                .onTapGesture { presenter.dismissPeek() }
                .transition(.opacity)
                .accessibilityHidden(true)
            VStack(spacing: PFSpace.s) {
                peek.preview
                    .frame(maxWidth: .infinity)
                    .allowsHitTesting(false)
                VStack(spacing: 0) {
                    ForEach(Array(peek.actions.enumerated()), id: \.element.id) { index, action in
                        if index > 0 { PFRowDivider(leadingInset: 48) }
                        Button {
                            presenter.dismissPeek()
                            DispatchQueue.main.asyncAfter(deadline: .now() + 0.12) { action.handler() }
                        } label: {
                            HStack(spacing: 14) {
                                Image(systemName: action.systemImage).font(.system(size: 16, weight: .medium)).frame(width: 22)
                                Text(action.title).pfText(.rowTitle)
                                Spacer()
                            }
                            .foregroundStyle(action.role == .destructive ? PFColor.dangerText : PFColor.textMain)
                            .padding(.horizontal, PFSpace.m)
                            .frame(minHeight: 50)
                            .contentShape(.rect)
                        }
                        .buttonStyle(.pfPressable)
                    }
                }
                .background(PFColor.card, in: .rect(cornerRadius: PFRadius.card, style: .continuous))
                .pfElevation(.overlay)
                .frame(maxWidth: 300)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(.horizontal, PFSpace.page)
            .transition(.scale(scale: 0.92).combined(with: .opacity))
            .accessibilityAction(.escape) { presenter.dismissPeek() }
        }
    }
}

public extension View {
    /// Long-press preview with a custom action menu (replaces `.contextMenu`).
    func pfPeek<Preview: View>(_ presenter: PFPresenter, actions: @escaping () -> [PFPeekAction], @ViewBuilder preview: @escaping () -> Preview) -> some View {
        self
            .onLongPressGesture(minimumDuration: 0.38, maximumDistance: 12) {
                presenter.showPeek(actions: actions(), preview: preview)
            }
            .accessibilityActions {
                ForEach(actions()) { action in
                    Button(action.title) { action.handler() }
                }
            }
    }
}
