import SwiftUI
import PFDesign

/// Thin platform announcement below the top edge of the content (all tabs): tinted by type, optional link, dismiss.
struct AnnouncementBanner: View {
    let announcement: AnnouncementStore.Announcement
    let onDismiss: () -> Void

    @Environment(\.openURL) private var openURL

    private var language: String { L10n.language.rawValue }

    private var tint: (fill: Color, icon: Color, symbol: String) {
        switch announcement.kind {
        case .info: (PFColor.statusBase(.open), PFColor.statusText(.open), "megaphone")
        case .maintenance: (PFColor.warning, PFColor.warningText, "wrench.and.screwdriver")
        case .warning: (PFColor.danger, PFColor.dangerText, "exclamationmark.triangle")
        }
    }

    var body: some View {
        let tint = tint
        HStack(alignment: .top, spacing: PFSpace.s) {
            Image(systemName: tint.symbol)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(tint.icon)
                .frame(width: 20, height: 20)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 4) {
                Text(announcement.localized(announcement.text, language: language))
                    .pfText(.meta)
                    .foregroundStyle(PFColor.textMain)
                    .fixedSize(horizontal: false, vertical: true)
                if let url = announcement.linkURL {
                    Button { openURL(url) } label: {
                        HStack(spacing: 4) {
                            Text(announcement.localized(announcement.linkLabel, language: language).isEmpty
                                 ? url.host() ?? url.absoluteString
                                 : announcement.localized(announcement.linkLabel, language: language))
                            Image(systemName: "arrow.up.right").font(.system(size: 10, weight: .bold))
                        }
                        .pfText(.metaStrong)
                        .foregroundStyle(PFColor.textMain)
                        .underline()
                    }
                    .buttonStyle(.pfPressable)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            if announcement.dismissible {
                Button(action: onDismiss) {
                    Image(systemName: "xmark")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(PFColor.textMuted)
                        .frame(width: 28, height: 28)
                        .contentShape(.rect)
                }
                .buttonStyle(.pfPressable)
                .accessibilityLabel(L10n.t("platform.announcement.dismiss"))
            }
        }
        .padding(.leading, PFSpace.m)
        .padding(.trailing, announcement.dismissible ? PFSpace.xs : PFSpace.m)
        .padding(.vertical, 10)
        .background(tint.fill.opacity(announcement.kind == .maintenance ? 0.16 : 0.12),
                    in: .rect(cornerRadius: PFRadius.card, style: .continuous))
        .padding(.horizontal, PFSpace.page)
        .padding(.top, 4)
        .accessibilityElement(children: .contain)
        .accessibilityLabel(L10n.t("platform.announcement.\(announcement.kind.rawValue)"))
    }
}
