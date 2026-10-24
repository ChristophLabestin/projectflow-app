import SwiftUI
import PFData
import PFDesign

/// Connects the rich description editor with the in-app AI: edit-menu rewrites of a selection (replace + undo) and
/// the ✦ field assist from the format bar.
@MainActor
enum AiEditorBridge {
    /// Sets (or clears) the editor's edit-menu hook for the current AI availability.
    static func attach(_ editor: RichEditorController, model: AppModel, itemTitle: String?) {
        guard model.showsInAppAi else { editor.aiRewrite = nil; return }
        editor.aiRewrite = { [weak editor] action, range in
            guard let editor else { return }
            let context = editor.aiContext(range)
            Task { @MainActor in
                guard let text = await AiInlineRewrite.run(model: model, action: action, field: .description, selection: context.selection,
                                                           before: context.before, after: context.after, itemTitle: itemTitle) else { return }
                editor.replace(range, with: text)
                PFHaptics.success()
                model.toasts.show(PFToast(L10n.t("ai.replaced"), style: .success, actionTitle: L10n.t("ai.undo")) { editor.undo() })
            }
        }
    }

    /// ✦ in the format bar: the field assist sheet, borrowing the keyboard like the link sheet.
    static func presentFieldAssist(_ editor: RichEditorController, model: AppModel, itemTitle: String?, projectTitle: String?) {
        let text = editor.plainText
        editor.isHoldingForSheet = true
        model.presenter.present(detents: [.fit], onDismiss: {
            editor.isHoldingForSheet = false
            editor.refocus()
        }) {
            AiFieldAssistSheet(field: .description, text: text, itemTitle: itemTitle, projectTitle: projectTitle) { result in
                editor.replaceAll(with: result)
            }
        }
    }
}
