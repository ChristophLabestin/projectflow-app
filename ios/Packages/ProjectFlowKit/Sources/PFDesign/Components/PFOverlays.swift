import SwiftUI
import UIKit
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
    /// Accessibility label of the side-region close button on sheets (set by the app from its copy).
    public var closeLabel = "Close"
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
    @State private var contentHeight: CGFloat = 312
    @State private var footerHeight: CGFloat = 0
    @State private var keyboardHeight: CGFloat = 0
    @State private var footer: PFSheetFooterBox?
    @State private var trailingInset: CGFloat = 0
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @Environment(\.dismiss) private var dismiss
    @Environment(PFPresenter.self) private var presenter

    /// iPhone Duo outer display: the sheet keeps a side region too; a close button sits at its bottom.
    private var sideRegion: CGFloat {
        PFLayout.sideRegionWidth(trailingInset: trailingInset, isCompact: horizontalSizeClass == .compact)
    }

    var body: some View {
        ScrollView {
            sheet.content
                .frame(maxWidth: .infinity, alignment: .top)
                .padding(.top, 26)
                .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { contentHeight = $0 + 8 }
        }
        .scrollBounceBehavior(.basedOnSize)
        .scrollDismissesKeyboard(.interactively)
        // The primary actions sit outside the scroll view, so the keyboard can never cover them.
        .safeAreaInset(edge: .bottom, spacing: 0) {
            if let footer {
                footer.view
                    .padding(.top, PFSpace.s)
                    .padding(.bottom, keyboardHeight > 0 ? PFSpace.s : PFSpace.xs)
                    .frame(maxWidth: .infinity)
                    // Content scrolling under the buttons fades out instead of showing through them.
                    .background {
                        // The sheet surface is slightly translucent, so it is stacked twice to hide the content.
                        let fade = LinearGradient(stops: [.init(color: PFColor.sheetSurface.opacity(0), location: 0),
                                                          .init(color: PFColor.sheetSurface, location: 0.4)],
                                                  startPoint: .top, endPoint: .bottom)
                        ZStack { fade; fade }
                            .padding(.top, -PFSpace.l)
                            .ignoresSafeArea(edges: .bottom)
                    }
                    .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { footerHeight = $0 }
            }
        }
        .onGeometryChange(for: CGFloat.self) { $0.safeAreaInsets.trailing } action: { trailingInset = $0 }
        .overlay {
            if sideRegion > 0, sheet.dismissable {
                PFSideColumn(side: sideRegion) {
                    PFIconButton("xmark", label: presenter.closeLabel, style: .glass) { dismiss() }
                }
            }
        }
        .onPreferenceChange(PFSheetFooterKey.self) { value in
            footer = value
            if value == nil { footerHeight = 0 }
        }
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillShowNotification)) { note in
            let frame = (note.userInfo?[UIResponder.keyboardFrameEndUserInfoKey] as? CGRect) ?? .zero
            keyboardHeight = frame.height
        }
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillHideNotification)) { _ in
            keyboardHeight = 0
        }
        .presentationDetents(Set(sheet.detents.map(detent)))
        // System sheet chrome (material, corner radius, insets, grabber) — only the content is ProjectFlow's.
        .presentationDragIndicator(.visible)
        .presentationBackground {
            ZStack {
                Rectangle().fill(.ultraThinMaterial)
                PFColor.sheetSurface
            }
        }
        .interactiveDismissDisabled(!sheet.dismissable)
    }

    /// A fitted sheet grows by the keyboard height while typing, so its content stays above the keyboard.
    private var fitHeight: CGFloat { contentHeight + footerHeight + keyboardHeight }

    private func detent(_ value: PFDetent) -> PresentationDetent {
        switch value {
        case .fit: .height(fitHeight)
        case .fraction(let f): .fraction(f)
        case .large: .large
        }
    }
}

struct PFSheetFooterBox: Equatable, @unchecked Sendable {
    let token: AnyHashable
    let view: AnyView
    static func == (lhs: Self, rhs: Self) -> Bool { lhs.token == rhs.token }
}

struct PFSheetFooterKey: PreferenceKey {
    static let defaultValue: PFSheetFooterBox? = nil
    static func reduce(value: inout PFSheetFooterBox?, nextValue: () -> PFSheetFooterBox?) {
        value = value ?? nextValue()
    }
}

public extension View {
    /// Pins `footer` (a sheet's primary actions) below the scrolling sheet content, above the keyboard.
    /// `token` must change whenever the footer looks different (enabled state, titles), since the footer
    /// is only re-read when the token changes.
    func pfSheetFooter<Token: Hashable, Footer: View>(_ token: Token, @ViewBuilder footer: () -> Footer) -> some View {
        preference(key: PFSheetFooterKey.self, value: PFSheetFooterBox(token: AnyHashable(token), view: AnyView(footer())))
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
