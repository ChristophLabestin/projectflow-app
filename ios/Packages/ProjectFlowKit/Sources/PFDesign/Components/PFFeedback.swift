import SwiftUI
import Observation

// MARK: - Toasts

public struct PFToast: Identifiable, Equatable {
    public enum Style: Sendable { case neutral, success, warning, error }

    public let id = UUID()
    public let message: String
    public let style: Style
    public let actionTitle: String?
    public let action: (@MainActor () -> Void)?
    public let duration: TimeInterval

    public init(_ message: String, style: Style = .neutral, actionTitle: String? = nil, duration: TimeInterval = 5,
                action: (@MainActor () -> Void)? = nil) {
        self.message = message
        self.style = style
        self.actionTitle = actionTitle
        self.action = action
        self.duration = duration
    }

    public static func == (lhs: PFToast, rhs: PFToast) -> Bool { lhs.id == rhs.id }
}

/// Bottom-centred toasts with an optional action ("Rückgängig"). Undo instead of confirm.
@Observable
public final class PFToastCenter {
    public private(set) var current: PFToast?
    private var dismissTask: Task<Void, Never>?

    public init() {}

    public func show(_ toast: PFToast) {
        dismissTask?.cancel()
        withAnimation(PFMotion.respecting(PFMotion.bouncy)) { current = toast }
        UIAccessibility.post(notification: .announcement, argument: toast.message)
        dismissTask = Task { [weak self] in
            try? await Task.sleep(for: .seconds(toast.duration))
            guard !Task.isCancelled else { return }
            self?.dismiss(toast.id)
        }
    }

    public func dismiss(_ id: UUID? = nil) {
        guard id == nil || current?.id == id else { return }
        withAnimation(PFMotion.respecting(PFMotion.normal)) { current = nil }
    }
}

public struct PFToastHost: View {
    @Bindable var center: PFToastCenter
    let bottomInset: CGFloat

    public init(center: PFToastCenter, bottomInset: CGFloat = 110) {
        self.center = center
        self.bottomInset = bottomInset
    }

    public var body: some View {
        VStack {
            Spacer()
            if let toast = center.current {
                HStack(spacing: PFSpace.s) {
                    Image(systemName: icon(toast.style)).font(.system(size: 15, weight: .semibold))
                    Text(toast.message).pfText(.metaStrong).lineLimit(2).frame(maxWidth: .infinity, alignment: .leading)
                    if let title = toast.actionTitle, let action = toast.action {
                        Button {
                            action()
                            center.dismiss(toast.id)
                        } label: {
                            Text(title).pfText(.buttonSmall).padding(.horizontal, 12).frame(minHeight: 32)
                                .background(PFColor.onPrimary.opacity(0.16), in: .capsule)
                        }
                        .buttonStyle(.pfPressable)
                    }
                }
                .foregroundStyle(PFColor.onPrimary)
                .padding(.leading, 16).padding(.trailing, 8)
                .frame(minHeight: 52)
                .background(background(toast.style), in: .rect(cornerRadius: 16, style: .continuous))
                .pfElevation(.overlay, radius: 16)
                .padding(.horizontal, PFSpace.page)
                .padding(.bottom, bottomInset)
                .transition(.move(edge: .bottom).combined(with: .scale(scale: 0.95)).combined(with: .opacity))
                .gesture(DragGesture(minimumDistance: 10).onEnded { value in
                    if value.translation.height > 20 { center.dismiss(toast.id) }
                })
                .id(toast.id)
            }
        }
        .allowsHitTesting(center.current != nil)
    }

    private func icon(_ style: PFToast.Style) -> String {
        switch style {
        case .neutral: "info.circle"
        case .success: "checkmark.circle"
        case .warning: "exclamationmark.triangle"
        case .error: "xmark.octagon"
        }
    }

    private func background(_ style: PFToast.Style) -> Color {
        switch style {
        case .neutral, .success: PFColor.primary
        case .warning: PFColor.warningText
        case .error: PFColor.dangerText
        }
    }
}

// MARK: - Empty state

/// Web-style empty state: 48 pt icon tile, title, one sentence, one action.
public struct PFEmptyState: View {
    let systemImage: String
    let title: String
    let message: String
    let actionTitle: String?
    let action: (() -> Void)?

    public init(systemImage: String, title: String, message: String, actionTitle: String? = nil, action: (() -> Void)? = nil) {
        self.systemImage = systemImage
        self.title = title
        self.message = message
        self.actionTitle = actionTitle
        self.action = action
    }

    public var body: some View {
        VStack(spacing: PFSpace.s) {
            Image(systemName: systemImage)
                .font(.system(size: 20, weight: .medium))
                .foregroundStyle(PFColor.textMuted)
                .frame(width: 48, height: 48)
                .background(PFColor.raised, in: .rect(cornerRadius: PFRadius.control, style: .continuous))
            Text(title).pfText(.section).foregroundStyle(PFColor.textMain).multilineTextAlignment(.center)
            Text(message).pfText(.meta).foregroundStyle(PFColor.textMuted).multilineTextAlignment(.center)
            if let actionTitle, let action {
                PFButton(actionTitle, kind: .secondary, size: .small, action: action).padding(.top, 4)
            }
        }
        .padding(PFSpace.xl)
        .frame(maxWidth: .infinity)
        .pfCard()
        .accessibilityElement(children: .combine)
    }
}

// MARK: - Skeleton

/// Shimmering placeholder block (shimmer off with Reduce Motion).
public struct PFSkeleton: View {
    let height: CGFloat
    let radius: CGFloat
    @State private var phase: CGFloat = -1
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    public init(height: CGFloat = 16, radius: CGFloat = 6) {
        self.height = height
        self.radius = radius
    }

    public var body: some View {
        RoundedRectangle(cornerRadius: radius, style: .continuous)
            .fill(PFColor.raised)
            .overlay {
                if !reduceMotion {
                    GeometryReader { proxy in
                        LinearGradient(colors: [.clear, PFColor.card.opacity(0.6), .clear], startPoint: .leading, endPoint: .trailing)
                            .frame(width: proxy.size.width * 0.6)
                            .offset(x: phase * proxy.size.width * 1.4)
                    }
                    .clipShape(.rect(cornerRadius: radius, style: .continuous))
                }
            }
            .frame(height: height)
            .onAppear {
                guard !reduceMotion else { return }
                withAnimation(.linear(duration: 1.35).repeatForever(autoreverses: false)) { phase = 1 }
            }
            .accessibilityHidden(true)
    }
}

/// Thin banner for connectivity/sync state.
public struct PFStatusBanner: View {
    let text: String
    let systemImage: String

    public init(_ text: String, systemImage: String = "wifi.slash") {
        self.text = text
        self.systemImage = systemImage
    }

    public var body: some View {
        HStack(spacing: 8) {
            Image(systemName: systemImage).font(.system(size: 12, weight: .semibold))
            Text(text).pfText(.metaStrong)
        }
        .foregroundStyle(PFColor.textMuted)
        .padding(.horizontal, 14)
        .frame(minHeight: 32)
        .pfGlass(in: .capsule, interactive: false)
        .accessibilityElement(children: .combine)
    }
}
