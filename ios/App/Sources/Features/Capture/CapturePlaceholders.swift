import SwiftUI
import PFModel

// Interface used by other features to open the capture composer. The Capture feature replaces the
// body of `present` with the real composer and deletes this comment.

/// Where a capture starts from (pre-filled project, text from Siri/share, focus option).
struct CaptureContext: Hashable {
    var projectId: String?
    var initialText: String?
    var dueDate: FlexDate?
    var offerFocus = true

    static let blank = CaptureContext()
}

@MainActor
enum CaptureLauncher {
    static func present(model: AppModel, context: CaptureContext = .blank) {
        model.toasts.show(.init("Capture"))
    }
}
