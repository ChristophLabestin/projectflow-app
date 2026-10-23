import SwiftUI
import PFDesign

/// Page frame of the account screens: glass back button, big title, scrolling content.
struct SettingsScaffold<Content: View>: View {
    let title: String
    var subtitle: String?
    var topTrailing: AnyView?
    @ViewBuilder let content: Content
    @Environment(AppModel.self) private var model

    var body: some View {
        VStack(spacing: 0) {
            PFTopBar(backLabel: L10n.t("common.back"), onBack: model.router.isDeep ? { model.router.pop() } : nil) {
                if let topTrailing { topTrailing }
            }
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(title).pfText(.display).foregroundStyle(PFColor.textMain)
                        if let subtitle {
                            Text(subtitle).pfText(.body).foregroundStyle(PFColor.textMuted).fixedSize(horizontal: false, vertical: true)
                        }
                    }
                    .padding(.top, PFSpace.s)
                    content
                }
                .padding(.horizontal, PFSpace.page)
                .padding(.bottom, PFSpace.xxl)
            }
            .scrollDismissesKeyboard(.interactively)
        }
    }
}

/// Card with rows separated by hairlines (each row owns its padding).
struct SettingsCard<Content: View>: View {
    var footer: String?
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: PFSpace.xs) {
            PFCardList { content }
            if let footer {
                Text(footer).pfText(.meta).foregroundStyle(PFColor.textMuted)
                    .padding(.horizontal, PFSpace.xs).fixedSize(horizontal: false, vertical: true)
            }
        }
    }
}

/// Icon tile · title/subtitle · trailing content, as one tap target.
struct SettingsRow<Trailing: View>: View {
    enum Role { case normal, danger }

    let systemImage: String
    let title: String
    var subtitle: String?
    var role: Role = .normal
    var showsChevron = true
    var action: (() -> Void)?
    @ViewBuilder let trailing: Trailing

    var body: some View {
        let content = HStack(spacing: PFSpace.s) {
            Image(systemName: systemImage)
                .font(.system(size: 15, weight: .medium))
                .foregroundStyle(role == .danger ? PFColor.dangerText : PFColor.textMuted)
                .frame(width: 34, height: 34)
                .background(PFColor.raised, in: .rect(cornerRadius: PFRadius.control, style: .continuous))
            VStack(alignment: .leading, spacing: 2) {
                Text(title).pfText(.rowTitle).foregroundStyle(role == .danger ? PFColor.dangerText : PFColor.textMain)
                    .multilineTextAlignment(.leading)
                if let subtitle {
                    Text(subtitle).pfText(.meta).foregroundStyle(PFColor.textMuted).multilineTextAlignment(.leading)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            Spacer(minLength: 0)
            trailing
            if showsChevron && action != nil {
                Image(systemName: "chevron.right").font(.system(size: 12, weight: .semibold)).foregroundStyle(PFColor.textSubtle)
            }
        }
        .padding(.horizontal, PFSpace.m)
        .padding(.vertical, 10)
        .frame(minHeight: 56)
        .contentShape(.rect)
        if let action {
            Button(action: action) { content }.buttonStyle(.pfPressable)
        } else {
            content.accessibilityElement(children: .combine)
        }
    }
}

extension SettingsRow where Trailing == EmptyView {
    init(systemImage: String, title: String, subtitle: String? = nil, role: Role = .normal, showsChevron: Bool = true, action: (() -> Void)? = nil) {
        self.init(systemImage: systemImage, title: title, subtitle: subtitle, role: role, showsChevron: showsChevron, action: action) { EmptyView() }
    }
}

/// Switch with an optional explanation below, padded like a row.
struct SettingsSwitchRow: View {
    let title: String
    var subtitle: String?
    @Binding var isOn: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            PFSwitch(title, isOn: $isOn)
            if let subtitle {
                Text(subtitle).pfText(.meta).foregroundStyle(PFColor.textMuted).fixedSize(horizontal: false, vertical: true)
                    .padding(.trailing, 60)
            }
        }
        .padding(.horizontal, PFSpace.m)
        .padding(.vertical, 12)
        .frame(minHeight: 56)
    }
}

/// "08:00 − +" in 15-minute steps (replaces the native time picker).
struct SettingsTimeRow: View {
    let title: String
    @Binding var time: String

    private var minutes: Int {
        let parts = time.split(separator: ":").compactMap { Int($0) }
        return parts.count == 2 ? parts[0] * 60 + parts[1] : 8 * 60
    }

    private func set(_ total: Int) {
        let wrapped = ((total % 1440) + 1440) % 1440
        time = String(format: "%02d:%02d", wrapped / 60, wrapped % 60)
        PFHaptics.selection()
    }

    var body: some View {
        HStack(spacing: PFSpace.s) {
            Text(title).pfText(.rowTitle).foregroundStyle(PFColor.textMain)
            Spacer()
            PFIconButton("minus", label: L10n.t("account.time.earlier"), style: .raised, size: 34) { set(minutes - 15) }
            Text(time).pfText(.rowTitle).foregroundStyle(PFColor.textMain).frame(minWidth: 52)
            PFIconButton("plus", label: L10n.t("account.time.later"), style: .raised, size: 34) { set(minutes + 15) }
        }
        .padding(.horizontal, PFSpace.m)
        .frame(minHeight: 56)
        .accessibilityElement(children: .contain)
    }
}

/// Small coloured state label ("Aktiv", "Blockiert").
struct SettingsStateLabel: View {
    let text: String
    var tone: Tone = .neutral
    enum Tone { case neutral, good, warning }

    var body: some View {
        PFPill(text, tone: pillTone, compact: true)
    }

    private var pillTone: PFPill.Tone {
        switch tone {
        case .neutral: .neutral
        case .good: .severity(.done)
        case .warning: .severity(.due)
        }
    }
}

/// Settings entry as a tile (account overview grid): icon, title, one-line hint.
struct SettingsTile: View {
    let systemImage: String
    let title: String
    let subtitle: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: PFSpace.s) {
                Image(systemName: systemImage)
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(PFColor.textMain)
                    .frame(width: 40, height: 40)
                    .background(PFColor.raised, in: .circle)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).pfText(.rowTitle).foregroundStyle(PFColor.textMain).lineLimit(1).minimumScaleFactor(0.85)
                    Text(subtitle).pfText(.meta).foregroundStyle(PFColor.textMuted).lineLimit(2)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .padding(PFSpace.m)
            .pfCard()
            .contentShape(.rect)
        }
        .buttonStyle(.pfPressable)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isButton)
    }
}

/// Workspace initial on a tinted square (no workspace logos yet).
struct WorkspaceMonogram: View {
    let name: String
    let size: CGFloat

    var body: some View {
        Text(String(name.trimmingCharacters(in: .whitespaces).prefix(1)).uppercased())
            .font(.system(size: size * 0.42, weight: .bold, design: .rounded))
            .foregroundStyle(PFColor.onPrimary)
            .frame(width: size, height: size)
            .background(PFColor.primary, in: .rect(cornerRadius: size * 0.28, style: .continuous))
            .accessibilityHidden(true)
    }
}
