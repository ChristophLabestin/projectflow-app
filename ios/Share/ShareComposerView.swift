import SwiftUI
import PFDesign
import PFSnapshot

/// Compact capture composer shown by the share sheet. Built from PFDesign like the app (no native form controls).
struct ShareComposerView: View {
    @Bindable var model: ShareModel

    var body: some View {
        ZStack {
            PFCanvas(dotted: true)
            switch model.phase {
            case .saved: confirmation(model.strings.t("share.saved"), symbol: "checkmark", detail: nil)
            case .queued: confirmation(model.strings.t("share.queued"), symbol: "clock", detail: nil)
            default: composer
            }
        }
        .animation(PFMotion.respecting(PFMotion.snappy), value: model.phase)
    }

    private var composer: some View {
        let strings = model.strings
        return VStack(alignment: .leading, spacing: PFSpace.m) {
            HStack {
                PFButton(strings.t("share.cancel"), kind: .ghost, size: .small) { model.cancel() }
                Spacer()
                PFEyebrow(strings.t("share.title"))
                Spacer()
                PFButton(model.hasSession ? strings.t("share.save") : strings.t("share.later"), size: .small) {
                    Task { await model.save() }
                }
                .disabled(!model.canSave)
            }
            .padding(.horizontal, PFSpace.page)
            .padding(.top, PFSpace.m)

            PFTextField(strings.t("share.placeholder"), text: $model.title, axis: .vertical)
                .padding(.horizontal, PFSpace.page)

            if let url = model.url { linkCard(url) }
            if !model.details.isEmpty {
                Text(model.details)
                    .pfText(.meta)
                    .foregroundStyle(PFColor.textMuted)
                    .lineLimit(3)
                    .padding(.horizontal, PFSpace.page)
            }

            if model.hasSession {
                VStack(alignment: .leading, spacing: 4) {
                    PFEyebrow(strings.t("share.target")).padding(.horizontal, PFSpace.page)
                    PFChipRow {
                        PFChip(strings.t("share.personal"), systemImage: "lock", isSet: model.target == .personal) { model.target = .personal }
                        ForEach(model.projects) { project in
                            PFChip(project.title, isSet: model.target == .project(project)) { model.target = .project(project) }
                        }
                    }
                }
            } else {
                notice(strings.t("share.signedOut"), symbol: "person.crop.circle.badge.exclamationmark")
            }

            if case .failed(let message) = model.phase {
                HStack(spacing: PFSpace.s) {
                    Text(message).pfText(.metaStrong).foregroundStyle(PFColor.dangerText)
                    Spacer(minLength: 0)
                    PFButton(strings.t("share.retry"), kind: .ghost, size: .small) { Task { await model.save() } }
                }
                .padding(.horizontal, PFSpace.page)
            }

            if model.phase == .saving {
                HStack(spacing: 8) {
                    PFSkeleton(height: 6, radius: 3).frame(width: 80)
                    Text(strings.t("share.saving")).pfText(.meta).foregroundStyle(PFColor.textMuted)
                }
                .padding(.horizontal, PFSpace.page)
            }
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
    }

    private func linkCard(_ url: URL) -> some View {
        HStack(spacing: PFSpace.s) {
            Image(systemName: "link").font(.system(size: 14, weight: .semibold)).foregroundStyle(PFColor.textMuted)
            VStack(alignment: .leading, spacing: 1) {
                Text(url.host() ?? url.absoluteString).pfText(.metaStrong).foregroundStyle(PFColor.textMain).lineLimit(1)
                Text(url.absoluteString).pfText(.caption).foregroundStyle(PFColor.textMuted).lineLimit(1)
            }
            Spacer(minLength: 0)
        }
        .padding(PFSpace.s)
        .pfCard(radius: PFRadius.control)
        .padding(.horizontal, PFSpace.page)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(model.strings.t("share.link")): \(url.absoluteString)")
    }

    private func notice(_ text: String, symbol: String) -> some View {
        HStack(alignment: .top, spacing: PFSpace.s) {
            Image(systemName: symbol).font(.system(size: 15, weight: .semibold)).foregroundStyle(PFColor.warningText)
            Text(text).pfText(.meta).foregroundStyle(PFColor.textMuted)
        }
        .padding(PFSpace.s)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(PFColor.warning.opacity(0.12), in: .rect(cornerRadius: PFRadius.control, style: .continuous))
        .padding(.horizontal, PFSpace.page)
    }

    private func confirmation(_ text: String, symbol: String, detail: String?) -> some View {
        VStack(spacing: PFSpace.m) {
            ZStack {
                Circle().fill(symbol == "checkmark" ? PFColor.success : PFColor.raised).frame(width: 64, height: 64)
                Image(systemName: symbol)
                    .font(.system(size: 26, weight: .bold))
                    .foregroundStyle(symbol == "checkmark" ? PFColor.onPrimary : PFColor.textMain)
            }
            Text(text).pfText(.section).foregroundStyle(PFColor.textMain).multilineTextAlignment(.center)
            if let detail { Text(detail).pfText(.meta).foregroundStyle(PFColor.textMuted) }
        }
        .padding(PFSpace.page)
        .transition(.opacity)
        .accessibilityElement(children: .combine)
    }
}
