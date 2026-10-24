import SwiftUI
import PFData
import PFDesign

/// "Nur lesen" notice on a project above the plan's project limit (`entitlements/plan.lockedProjectIds`).
struct PlanLockedNotice: View {
    var body: some View {
        HStack(alignment: .top, spacing: PFSpace.s) {
            Image(systemName: "lock.fill").font(.system(size: 14, weight: .semibold)).foregroundStyle(PFColor.warningText)
                .frame(width: 20, height: 20)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text(L10n.t("plan.locked.title")).pfText(.metaStrong).foregroundStyle(PFColor.textMain)
                Text(L10n.t("plan.locked.message")).pfText(.meta).foregroundStyle(PFColor.textMuted)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(PFSpace.m)
        .background(PFColor.warning.opacity(0.14), in: .rect(cornerRadius: PFRadius.card, style: .continuous))
        .padding(.horizontal, PFSpace.page)
        .accessibilityElement(children: .combine)
    }
}

/// Plan status of the active workspace for Account: plan, status/trial end, limits. Shows, never sells
/// (App Store Guideline 3.1.1/3.1.3: no purchase buttons, no links or calls to action for buying elsewhere).
struct PlanStatusCard: View {
    @Environment(AppModel.self) private var model

    private var plan: PlanEntitlements { model.entitlements }
    private var workspaceName: String { model.session?.activeWorkspace?.name ?? "" }

    var body: some View {
        VStack(alignment: .leading, spacing: PFSpace.s) {
            PFEyebrow(L10n.t("plan.section"))
            if let hint { PlanHint(text: hint.text, tone: hint.tone) }
            SettingsCard(footer: L10n.t("plan.footer", ["name": workspaceName])) {
                VStack(alignment: .leading, spacing: 0) {
                    HStack(spacing: PFSpace.s) {
                        Image(systemName: "creditcard").font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(PFColor.textMuted).frame(width: 24)
                            .accessibilityHidden(true)
                        Text(L10n.t("plan.name.\(plan.plan.rawValue)")).pfText(.rowTitle).foregroundStyle(PFColor.textMain)
                        Spacer(minLength: PFSpace.s)
                        Text(statusText).pfText(.metaStrong).foregroundStyle(statusColor)
                            .padding(.horizontal, 10).frame(minHeight: 26)
                            .background(statusColor.opacity(0.12), in: .capsule)
                    }
                    .padding(.horizontal, PFSpace.m)
                    .frame(minHeight: 52)
                    PFRowDivider()
                    row(L10n.t("plan.limit.projects"), projectsValue)
                    PFRowDivider()
                    row(L10n.t("plan.limit.members"), membersValue)
                    if plan.seats > 0, !plan.isPersonalWorkspace {
                        PFRowDivider()
                        row(L10n.t("plan.seats"), L10n.t("plan.seats.value", ["used": fullMembers, "seats": plan.seats]))
                    }
                    if plan.aiAddonAvailable || plan.aiAddonSeats > 0 {
                        PFRowDivider()
                        row(L10n.t("plan.aiSeats"), L10n.t("plan.aiSeats.value", ["assigned": plan.aiMemberIds.count, "seats": plan.aiAddonSeats]))
                    }
                    if !plan.isPersonalWorkspace {
                        PFRowDivider()
                        row(L10n.t("plan.limit.invites"), L10n.t(plan.canInvite ? "plan.limit.invitesOn" : "plan.limit.invitesOff"))
                    }
                    PFRowDivider()
                    row(L10n.t("plan.limit.ai"), L10n.t(plan.aiEnabled(for: model.uid) ? "plan.limit.aiOn" : "plan.limit.aiOff"))
                    if let bytes = plan.storageQuotaBytes {
                        PFRowDivider()
                        row(L10n.t("plan.limit.storage"), ByteCountFormatter.string(fromByteCount: bytes, countStyle: .file))
                    }
                }
            }
        }
    }

    /// Full members (guests never count as a seat).
    private var fullMembers: Int {
        (model.workspace?.people.values ?? [:].values).filter { $0.role != .guest }.count
    }

    /// One neutral hint at a time, most important first. Never a purchase prompt (App Store 3.1.1).
    private var hint: (text: String, tone: PlanHint.Tone)? {
        switch plan.status {
        case .pastDue: return (L10n.t("plan.hint.pastDue"), .warning)
        case .canceled: return (L10n.t("plan.hint.canceled"), .warning)
        case .trialing:
            if let end = plan.trialEndsAt {
                let days = max(0, Calendar.current.dateComponents([.day], from: .now, to: end).day ?? 0)
                return (L10n.t("plan.hint.trial", ["days": days, "date": date(end)]), .info)
            }
        case .active where plan.cancelAtPeriodEnd:
            if let end = plan.currentPeriodEnd { return (L10n.t("plan.hint.ending", ["date": date(end)]), .warning) }
        default: break
        }
        if !plan.lockedProjectIds.isEmpty { return (L10n.t("plan.hint.locked", ["count": plan.lockedProjectIds.count]), .warning) }
        if let limit = plan.projectLimit, plan.projectCount >= limit { return (L10n.t("plan.hint.projectLimit", ["limit": limit]), .info) }
        return nil
    }

    private func row(_ title: String, _ value: String) -> some View {
        HStack(spacing: PFSpace.s) {
            Text(title).pfText(.body).foregroundStyle(PFColor.textMain)
            Spacer(minLength: PFSpace.s)
            Text(value).pfText(.body).foregroundStyle(PFColor.textMuted).multilineTextAlignment(.trailing)
        }
        .padding(.horizontal, PFSpace.m)
        .frame(minHeight: 44)
        .accessibilityElement(children: .combine)
    }

    private func date(_ value: Date) -> String {
        value.formatted(.dateTime.day().month(.abbreviated).year().locale(L10n.locale))
    }

    private var statusText: String {
        switch plan.status {
        case .trialing: plan.trialEndsAt.map { L10n.t("plan.status.trialing", ["date": date($0)]) } ?? L10n.t("plan.status.trialingOpen")
        case .grace: plan.graceEndsAt.map { L10n.t("plan.status.graceUntil", ["date": date($0)]) } ?? L10n.t("plan.status.grace")
        case .active:
            plan.cancelAtPeriodEnd ? plan.currentPeriodEnd.map { L10n.t("plan.status.activeUntil", ["date": date($0)]) } ?? L10n.t("plan.status.active")
                : L10n.t("plan.status.active")
        default: L10n.t("plan.status.\(plan.status.rawValue)")
        }
    }

    private var statusColor: Color {
        switch plan.status {
        case .active, .exempt: PFColor.successText
        case .trialing, .grace: PFColor.statusText(.open)
        case .pastDue, .canceled: PFColor.warningText
        case .free: PFColor.textMuted
        }
    }

    private var projectsValue: String {
        guard let limit = plan.projectLimit else { return L10n.t("plan.limit.unlimited") }
        return L10n.t("plan.limit.projectsUsage", ["count": plan.projectCount, "limit": limit])
    }

    private var membersValue: String {
        if plan.isPersonalWorkspace || plan.memberLimit == 1 { return L10n.t("plan.limit.membersOnly") }
        guard let limit = plan.memberLimit else { return L10n.t("plan.limit.unlimited") }
        return "\(limit)"
    }
}

/// Small tinted notice above the plan card.
struct PlanHint: View {
    enum Tone { case info, warning }
    let text: String
    let tone: Tone

    var body: some View {
        HStack(alignment: .top, spacing: PFSpace.s) {
            Image(systemName: tone == .warning ? "exclamationmark.triangle" : "info.circle")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(tone == .warning ? PFColor.warningText : PFColor.statusText(.open))
            Text(text).pfText(.meta).foregroundStyle(PFColor.textMain).fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
        }
        .padding(PFSpace.s)
        .background((tone == .warning ? PFColor.warning : PFColor.statusBase(.open)).opacity(0.12),
                    in: .rect(cornerRadius: PFRadius.control, style: .continuous))
        .accessibilityElement(children: .combine)
    }
}
