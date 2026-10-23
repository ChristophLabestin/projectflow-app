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
        sheets.append(sheet)
    }

    public func dismiss() {
        guard let last = sheets.last else { return }
        _ = sheets.popLast()
        last.onDismiss?()
    }

    public func dismissAll() {
        dismiss(from: 0)
    }

    /// Removes the sheet at `index` and everything stacked above it (used when the system dismisses a sheet).
    func dismiss(from index: Int) {
        guard index < sheets.count else { return }
        let removed = Array(sheets[index...])
        sheets.removeSubrange(index...)
        removed.reversed().forEach { $0.onDismiss?() }
    }

    public func showPeek<Preview: View>(actions: [PFPeekAction], @ViewBuilder preview: () -> Preview) {
        PFHaptics.soft()
        withAnimation(PFMotion.respecting(PFMotion.bouncy)) { peek = Peek(preview: AnyView(preview()), actions: actions) }
    }

    public func dismissPeek() {
        withAnimation(PFMotion.respecting(PFMotion.normal)) { peek = nil }
    }
}

/// Hosts presented sheets (native SwiftUI sheets, so dragging, detents and dismissal feel like iOS)
/// and the custom peek overlay. Place once at the app root.
public struct PFPresenterHost: View {
    @Bindable var presenter: PFPresenter

    public init(presenter: PFPresenter) { self.presenter = presenter }

    public var body: some View {
        ZStack {
            Color.clear
                .allowsHitTesting(false)
                .modifier(PFSheetLayer(presenter: presenter, index: 0))
            if let peek = presenter.peek {
                PFPeekView(peek: peek, presenter: presenter).zIndex(1000)
            }
        }
        .environment(presenter)
    }
}

/// Presents `presenter.sheets[index]` as a native sheet; the sheet's content presents the next layer,
/// so stacked sheets work like nested system sheets.
struct PFSheetLayer: ViewModifier {
    let presenter: PFPresenter
    let index: Int

    func body(content: Content) -> some View {
        content.sheet(isPresented: Binding(
            get: { presenter.sheets.count > index },
            set: { presented in if !presented { presenter.dismiss(from: index) } }
        )) {
            if index < presenter.sheets.count {
                PFSheetContent(sheet: presenter.sheets[index])
                    .modifier(PFSheetLayer(presenter: presenter, index: index + 1))
                    .environment(presenter)
            }
        }
    }
}

struct PFSheetContent: View {
    let sheet: PFPresenter.Sheet
    @State private var fitHeight: CGFloat = 320

    var body: some View {
        ScrollView {
            sheet.content
                .frame(maxWidth: .infinity, alignment: .top)
                .padding(.top, 22)
                .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { fitHeight = $0 + 8 }
        }
        .scrollBounceBehavior(.basedOnSize)
        .scrollDismissesKeyboard(.interactively)
        .presentationDetents(Set(sheet.detents.map(detent)))
        .presentationDragIndicator(.visible)
        .presentationCornerRadius(PFRadius.surface)
        .presentationBackground(PFColor.card)
        .interactiveDismissDisabled(!sheet.dismissable)
    }

    private func detent(_ value: PFDetent) -> PresentationDetent {
        switch value {
        case .fit: .height(fitHeight)
        case .fraction(let f): .fraction(f)
        case .large: .large
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
