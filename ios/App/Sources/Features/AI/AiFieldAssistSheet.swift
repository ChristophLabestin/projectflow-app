import SwiftUI
import PFData
import PFDesign

/// ✦ for a text field without a selection: "Was soll ich tun?" plus quick actions, the result as a preview (old text
/// struck through, new text highlighted), then apply or discard. Same family as the web field assist.
struct AiFieldAssistSheet: View {
    let field: AiField
    let text: String
    var itemTitle: String?
    var projectTitle: String?
    let onApply: (String) -> Void

    @Environment(AppModel.self) private var model
    @Environment(PFPresenter.self) private var presenter

    @State private var instruction = ""
    @State private var result = ""
    @State private var hint: String?
    @State private var running: Task<Void, Never>?
    @State private var finished = false

    private var isEmpty: Bool { text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
    private var quickActions: [AiWriteAction] { isEmpty ? [.draft] : [.expand, .shorten, .rephrase, .fix] }

    var body: some View {
        VStack(alignment: .leading, spacing: PFSpace.m) {
            HStack(spacing: PFSpace.xs) {
                Text(L10n.t("ai.badge")).pfText(.metaStrong).foregroundStyle(PFColor.textMuted)
                Text(L10n.t("ai.field.title")).pfText(.section).foregroundStyle(PFColor.textMain).accessibilityAddTraits(.isHeader)
            }
            if result.isEmpty && running == nil {
                HStack(spacing: PFSpace.xs) {
                    TextField("", text: $instruction, prompt: Text(L10n.t("ai.field.placeholder")).foregroundStyle(PFColor.textSubtle))
                        .pfText(.body)
                        .submitLabel(.go)
                        .onSubmit { run(.custom) }
                        .padding(.horizontal, 14)
                        .frame(minHeight: 44)
                        .background(PFColor.sheetGroup, in: .rect(cornerRadius: 22, style: .continuous))
                    PFIconButton("arrow.up", label: L10n.t("ai.action.custom"), style: .primary) { run(.custom) }
                        .disabled(instruction.trimmingCharacters(in: .whitespaces).isEmpty)
                        .opacity(instruction.trimmingCharacters(in: .whitespaces).isEmpty ? 0.4 : 1)
                }
                FlowLayout(spacing: 8) {
                    ForEach(quickActions, id: \.self) { action in
                        PFButton(L10n.t("ai.action.\(action.rawValue)"), kind: .ghost, size: .small) { run(action) }
                    }
                }
            } else {
                preview
            }
            if let hint {
                Label(hint, systemImage: "info.circle").pfText(.meta).foregroundStyle(PFColor.textMuted)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(.horizontal, PFSpace.page)
        .padding(.bottom, PFSpace.l)
        .onDisappear { running?.cancel() }
    }

    private var preview: some View {
        VStack(alignment: .leading, spacing: PFSpace.s) {
            ScrollView {
                VStack(alignment: .leading, spacing: PFSpace.xs) {
                    if !isEmpty {
                        Text(text).pfText(.meta).foregroundStyle(PFColor.textMuted).strikethrough()
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    Text(result.isEmpty ? L10n.t("ai.preview.working") : result)
                        .pfText(.body).foregroundStyle(result.isEmpty ? PFColor.textMuted : PFColor.textMain)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(PFSpace.s)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(PFColor.statusBase(.open).opacity(0.10), in: .rect(cornerRadius: PFRadius.control, style: .continuous))
                }
            }
            .frame(maxHeight: 300)
            .scrollBounceBehavior(.basedOnSize)
            HStack(spacing: PFSpace.xs) {
                PFButton(L10n.t("ai.preview.discard"), kind: .ghost, size: .large, fullWidth: true) {
                    running?.cancel()
                    presenter.dismiss()
                }
                PFButton(L10n.t("ai.preview.apply"), size: .large, fullWidth: true) {
                    onApply(result.trimmingCharacters(in: .whitespacesAndNewlines))
                    PFHaptics.success()
                    presenter.dismiss()
                }
                .disabled(!finished || result.isEmpty)
            }
        }
    }

    private func run(_ action: AiWriteAction) {
        guard running == nil, let tenantId = model.workspace?.tenantId else { return }
        if action == .custom, instruction.trimmingCharacters(in: .whitespaces).isEmpty { return }
        hint = nil
        result = ""
        finished = false
        let stream = AiAssist.write(tenantId: tenantId, language: L10n.language.rawValue, action: action, field: field, text: text,
                                    instruction: action == .custom ? instruction : nil, itemTitle: itemTitle, projectTitle: projectTitle)
        running = Task {
            defer { running = nil }
            do {
                for try await event in stream {
                    switch event {
                    case .delta(let chunk): result += chunk
                    case .done: finished = true
                    case .error(let code, _):
                        hint = model.aiMessage(code: code)
                        result = ""
                    default: break
                    }
                }
                finished = finished || !result.isEmpty
            } catch is CancellationError {
            } catch {
                hint = L10n.t("ai.error.generic")
                result = ""
            }
        }
    }
}

/// Replaces a selection with an AI rewrite (edit-menu entries). Returns the new text, or nil with a toast on refusal.
@MainActor
enum AiInlineRewrite {
    static func run(model: AppModel, action: AiWriteAction, field: AiField, selection: String, before: String?, after: String?,
                    itemTitle: String?) async -> String? {
        guard let tenantId = model.workspace?.tenantId else { return nil }
        var output = ""
        do {
            for try await event in AiAssist.write(tenantId: tenantId, language: L10n.language.rawValue, action: action, field: field,
                                                  text: selection, itemTitle: itemTitle, before: before, after: after) {
                switch event {
                case .delta(let chunk): output += chunk
                case .error(let code, _):
                    model.toasts.show(PFToast(model.aiMessage(code: code), style: AppModel.aiIsPlanHint(code) ? .warning : .error))
                    return nil
                default: break
                }
            }
        } catch {
            model.toasts.show(PFToast(L10n.t("ai.error.generic"), style: .error))
            return nil
        }
        let trimmed = output.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}
