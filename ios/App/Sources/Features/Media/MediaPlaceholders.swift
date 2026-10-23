import SwiftUI
import PFModel

/// Result of an upload through the tenant file pipeline (`createTenantFileUploadSession` → `finalizeTenantFileUpload`).
struct UploadedFile: Hashable, Sendable {
    let fileId: String
    let url: String
}

enum MediaPurpose: Hashable, Sendable { case projectCover, projectIcon, profilePhoto }

// Interface for picking + uploading an image. The Projects package replaces the body.
@MainActor
enum MediaUpload {
    static func pickAndUpload(model: AppModel, purpose: MediaPurpose) async -> UploadedFile? { nil }
}
