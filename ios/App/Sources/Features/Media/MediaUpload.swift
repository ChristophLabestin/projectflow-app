import SwiftUI
import UIKit
import PhotosUI
import PFData
import PFModel
import PFDesign

/// Result of an upload through the tenant file pipeline (`createTenantFileUploadSession` → `finalizeTenantFileUpload`).
struct UploadedFile: Hashable, Sendable {
    let fileId: String
    let url: String
}

enum MediaPurpose: Hashable, Sendable { case projectCover, projectIcon, profilePhoto }

/// Picks a photo (system photo picker), compresses it and uploads it through the tenant file pipeline.
/// Returns nil when the user cancels or the upload fails (a toast explains failures).
/// `entityId` is the project id for cover/icon; for `.profilePhoto` it defaults to the signed-in uid.
@MainActor
enum MediaUpload {
    static func pickAndUpload(model: AppModel, purpose: MediaPurpose, entityId: String? = nil, projectId: String? = nil) async -> UploadedFile? {
        guard let tenantId = model.workspace?.tenantId else { return nil }
        guard let entity = entityId ?? (purpose == .profilePhoto ? model.uid : projectId) else { return nil }
        guard let image = await PhotoPicker.pick() else { return nil }
        let spec = Spec(purpose)
        guard let data = compress(image, maxEdge: spec.maxEdge, quality: spec.quality) else {
            model.toasts.show(PFToast(L10n.t("media.error.read"), style: .error))
            return nil
        }
        do {
            let file = try await FileUploads.upload(tenantId: tenantId, module: spec.module, entityType: spec.entityType, entityId: entity,
                                                    projectId: purpose == .profilePhoto ? nil : (projectId ?? entity),
                                                    fileName: "\(spec.entityType)-\(Int(Date().timeIntervalSince1970)).jpg", mimeType: "image/jpeg", data: data)
            return UploadedFile(fileId: file.id, url: file.downloadURL)
        } catch {
            model.toasts.show(PFToast(L10n.t("media.error.upload"), style: .error))
            return nil
        }
    }

    private struct Spec {
        let module: String
        let entityType: String
        let maxEdge: CGFloat
        let quality: CGFloat

        init(_ purpose: MediaPurpose) {
            switch purpose {
            case .projectCover: (module, entityType, maxEdge, quality) = ("project", "cover", 1800, 0.82)
            case .projectIcon: (module, entityType, maxEdge, quality) = ("project", "icon", 512, 0.85)
            case .profilePhoto: (module, entityType, maxEdge, quality) = ("profile", "avatar", 640, 0.85)
            }
        }
    }

    private static func compress(_ image: UIImage, maxEdge: CGFloat, quality: CGFloat) -> Data? {
        let longest = max(image.size.width, image.size.height)
        guard longest > 0 else { return nil }
        let scale = min(1, maxEdge / longest)
        let size = CGSize(width: (image.size.width * scale).rounded(), height: (image.size.height * scale).rounded())
        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1
        format.opaque = true
        let rendered = UIGraphicsImageRenderer(size: size, format: format).image { _ in image.draw(in: CGRect(origin: .zero, size: size)) }
        return rendered.jpegData(compressionQuality: quality)
    }
}

/// System photo picker (PHPicker) presented over whatever is on screen; resumes with the chosen image.
@MainActor
private final class PhotoPicker: NSObject, PHPickerViewControllerDelegate {
    private var continuation: CheckedContinuation<UIImage?, Never>?
    private static var active: PhotoPicker?

    static func pick() async -> UIImage? {
        guard let top = topViewController() else { return nil }
        let picker = PhotoPicker()
        active = picker
        var config = PHPickerConfiguration(photoLibrary: .shared())
        config.filter = .images
        config.selectionLimit = 1
        let controller = PHPickerViewController(configuration: config)
        controller.delegate = picker
        let image = await withCheckedContinuation { (continuation: CheckedContinuation<UIImage?, Never>) in
            picker.continuation = continuation
            top.present(controller, animated: true)
        }
        active = nil
        return image
    }

    nonisolated func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
        guard let provider = results.first?.itemProvider, provider.canLoadObject(ofClass: UIImage.self) else {
            Task { @MainActor in
                picker.dismiss(animated: true)
                self.finish(nil)
            }
            return
        }
        provider.loadObject(ofClass: UIImage.self) { object, _ in
            let image = object as? UIImage
            Task { @MainActor in
                picker.dismiss(animated: true)
                self.finish(image)
            }
        }
    }

    private func finish(_ image: UIImage?) {
        continuation?.resume(returning: image)
        continuation = nil
    }

    private static func topViewController() -> UIViewController? {
        let scene = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first { $0.activationState == .foregroundActive }
        var top = scene?.keyWindow?.rootViewController
        while let presented = top?.presentedViewController { top = presented }
        return top
    }
}
