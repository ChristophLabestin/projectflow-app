import SwiftUI
import UIKit
import PhotosUI
import UniformTypeIdentifiers
import QuickLook
import PFData
import PFDesign

/// A file chosen on the device, ready to upload.
struct PickedFile {
    let name: String
    let mimeType: String
    let data: Data
}

/// Camera, photo library and Files app as one async API (UIKit pickers presented from the top view controller).
@MainActor
enum FilePicking {
    enum Source { case camera, photos, files }

    static func pick(_ source: Source) async -> [PickedFile] {
        guard let top = topViewController() else { return [] }
        switch source {
        case .camera:
            guard UIImagePickerController.isSourceTypeAvailable(.camera) else { return [] }
            return await withCheckedContinuation { continuation in
                let delegate = CameraDelegate { continuation.resume(returning: $0) }
                let picker = UIImagePickerController()
                picker.sourceType = .camera
                picker.delegate = delegate
                CameraDelegate.active = delegate
                top.present(picker, animated: true)
            }
        case .photos:
            return await withCheckedContinuation { continuation in
                var config = PHPickerConfiguration(photoLibrary: .shared())
                config.selectionLimit = 10
                let delegate = PhotosDelegate { continuation.resume(returning: $0) }
                let picker = PHPickerViewController(configuration: config)
                picker.delegate = delegate
                PhotosDelegate.active = delegate
                top.present(picker, animated: true)
            }
        case .files:
            return await withCheckedContinuation { continuation in
                let delegate = DocumentDelegate { continuation.resume(returning: $0) }
                let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.item], asCopy: true)
                picker.allowsMultipleSelection = true
                picker.delegate = delegate
                DocumentDelegate.active = delegate
                top.present(picker, animated: true)
            }
        }
    }

    static func mime(for url: URL) -> String {
        UTType(filenameExtension: url.pathExtension)?.preferredMIMEType ?? "application/octet-stream"
    }

    static func topViewController() -> UIViewController? {
        let scene = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first { $0.activationState == .foregroundActive }
        var top = scene?.keyWindow?.rootViewController
        while let presented = top?.presentedViewController { top = presented }
        return top
    }

    // MARK: Delegates

    private final class CameraDelegate: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        static var active: CameraDelegate?
        let done: ([PickedFile]) -> Void
        init(done: @escaping ([PickedFile]) -> Void) { self.done = done }

        func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
            picker.dismiss(animated: true)
            let image = info[.originalImage] as? UIImage
            let data = image?.jpegData(compressionQuality: 0.85)
            let name = "Foto \(Date().formatted(.dateTime.year().month().day().hour().minute())).jpg".replacingOccurrences(of: "/", with: "-")
            done(data.map { [PickedFile(name: name, mimeType: "image/jpeg", data: $0)] } ?? [])
            Self.active = nil
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            picker.dismiss(animated: true)
            done([])
            Self.active = nil
        }
    }

    private final class PhotosDelegate: NSObject, PHPickerViewControllerDelegate {
        static var active: PhotosDelegate?
        let done: ([PickedFile]) -> Void
        init(done: @escaping ([PickedFile]) -> Void) { self.done = done }

        func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
            picker.dismiss(animated: true)
            Task { @MainActor in
                var files: [PickedFile] = []
                for result in results {
                    let provider = result.itemProvider
                    let type = provider.registeredContentTypes.first { $0.conforms(to: .image) || $0.conforms(to: .movie) } ?? .image
                    if let data = await Self.load(provider, type) {
                        let ext = type.preferredFilenameExtension ?? "jpg"
                        let base = provider.suggestedName ?? "Foto"
                        files.append(PickedFile(name: "\(base).\(ext)", mimeType: type.preferredMIMEType ?? "image/jpeg", data: data))
                    }
                }
                self.done(files)
                Self.active = nil
            }
        }

        private static func load(_ provider: NSItemProvider, _ type: UTType) async -> Data? {
            await withCheckedContinuation { continuation in
                _ = provider.loadDataRepresentation(for: type) { data, _ in continuation.resume(returning: data) }
            }
        }
    }

    private final class DocumentDelegate: NSObject, UIDocumentPickerDelegate {
        static var active: DocumentDelegate?
        let done: ([PickedFile]) -> Void
        init(done: @escaping ([PickedFile]) -> Void) { self.done = done }

        func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
            let files = urls.compactMap { url -> PickedFile? in
                guard let data = try? Data(contentsOf: url) else { return nil }
                return PickedFile(name: url.lastPathComponent, mimeType: FilePicking.mime(for: url), data: data)
            }
            done(files)
            Self.active = nil
        }

        func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
            done([])
            Self.active = nil
        }
    }
}

/// Quick Look for one or more downloaded files.
@MainActor
enum FilePreview {
    private final class DataSource: NSObject, QLPreviewControllerDataSource {
        static var active: DataSource?
        let urls: [URL]
        init(urls: [URL]) { self.urls = urls }
        func numberOfPreviewItems(in controller: QLPreviewController) -> Int { urls.count }
        func previewController(_ controller: QLPreviewController, previewItemAt index: Int) -> QLPreviewItem { urls[index] as NSURL }
    }

    static func open(model: AppModel, tenantId: String, file: FileItem) {
        Task {
            do {
                let url = try await FilesData.localCopy(tenantId: tenantId, file: file)
                let source = DataSource(urls: [url])
                DataSource.active = source
                let controller = QLPreviewController()
                controller.dataSource = source
                FilePicking.topViewController()?.present(controller, animated: true)
            } catch {
                model.toasts.show(PFToast(L10n.t("files.preview.error"), style: .error))
            }
        }
    }
}
