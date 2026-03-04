import Foundation
import Combine
import FirebaseStorage

@MainActor
final class ProjectMediaStore: ObservableObject {
    @Published private(set) var coverURLs: [String: URL] = [:]
    @Published private(set) var iconURLs: [String: URL] = [:]
    @Published var isLoading = false
    @Published var errorMessage: String?

    private var currentTenantId: String?
    private var loadingProjects: Set<String> = []

    func start(tenantId: String) {
        if tenantId != currentTenantId {
            reset()
        }
        currentTenantId = tenantId
    }

    func stop() {
        reset()
        currentTenantId = nil
    }

    func coverURL(for projectId: String) -> URL? {
        coverURLs[projectId]
    }

    func iconURL(for projectId: String) -> URL? {
        iconURLs[projectId]
    }

    /// Set URLs from Project model fields (called when Project is already available)
    func setURLsFromProject(_ project: Project) {
        // Set cover URL from Firestore field if available
        if let coverString = project.coverImage, !coverString.isEmpty, let url = URL(string: coverString) {
            if coverURLs[project.id] == nil {
                coverURLs[project.id] = url
            }
        }
        
        // Set icon URL from Firestore field if available
        if let iconString = project.squareIcon, !iconString.isEmpty, let url = URL(string: iconString) {
            if iconURLs[project.id] == nil {
                iconURLs[project.id] = url
            }
        }
    }
    
    /// Fetch assets from Storage if no URLs are set from Firestore fields
    func fetchAssetsIfNeeded(projectId: String, tenantId: String, project: Project? = nil) {
        // First, try to use Firestore fields if project is available
        if let project {
            setURLsFromProject(project)
        }
        
        guard !projectId.isEmpty, !tenantId.isEmpty else { return }
        if loadingProjects.contains(projectId) { return }
        
        // Only fetch from Storage if we don't have both URLs
        if coverURLs[projectId] != nil, iconURLs[projectId] != nil { return }

        loadingProjects.insert(projectId)
        isLoading = true
        errorMessage = nil

        let storage = Storage.storage()
        let folderRef = storage.reference().child("tenants/\(tenantId)/projects/\(projectId)")

        folderRef.listAll { [weak self] result, error in
            guard let self else { return }
            if let error {
                self.errorMessage = error.localizedDescription
                self.loadingProjects.remove(projectId)
                self.isLoading = false
                return
            }

            if let result, !result.items.isEmpty {
                self.process(items: result.items, projectId: projectId)
                return
            }

            // Fallback to legacy root folder naming: {timestamp}_media_{projectId}_{filename}
            let rootRef = storage.reference().child("tenants/\(tenantId)/projects")
            rootRef.listAll { [weak self] legacyResult, _ in
                guard let self else { return }
                if let match = legacyResult?.items.first(where: { $0.name.contains("_media_\(projectId)") }) {
                    match.downloadURL { url, _ in
                        if let url {
                            _Concurrency.Task { @MainActor in
                                self.coverURLs[projectId] = url
                                self.loadingProjects.remove(projectId)
                                self.isLoading = false
                            }
                        }
                    }
                } else {
                    _Concurrency.Task { @MainActor in
                        self.loadingProjects.remove(projectId)
                        self.isLoading = false
                    }
                }
            }
        }
    }

    private func process(items: [StorageReference], projectId: String) {
        // Only look for cover if we don't have one from Firestore
        let needsCover = coverURLs[projectId] == nil
        let needsIcon = iconURLs[projectId] == nil
        
        let coverCandidate: StorageReference? = needsCover ? (items.first { ref in
            ref.name.localizedCaseInsensitiveContains("cover")
                || ref.name.localizedCaseInsensitiveContains("hero")
                || ref.name.localizedCaseInsensitiveContains("header")
        } ?? items.first) : nil

        let iconCandidate: StorageReference? = needsIcon ? items.first { ref in
            ref.name.localizedCaseInsensitiveContains("icon")
                || ref.name.localizedCaseInsensitiveContains("logo")
                || ref.name.localizedCaseInsensitiveContains("avatar")
        } : nil

        let group = DispatchGroup()
        if let coverCandidate {
            group.enter()
            coverCandidate.downloadURL { [weak self] url, _ in
                _Concurrency.Task { @MainActor in
                    if let url {
                        self?.coverURLs[projectId] = url
                    }
                    group.leave()
                }
            }
        }

        if let iconCandidate {
            group.enter()
            iconCandidate.downloadURL { [weak self] url, _ in
                _Concurrency.Task { @MainActor in
                    if let url {
                        self?.iconURLs[projectId] = url
                    }
                    group.leave()
                }
            }
        }

        group.notify(queue: .main) {
            self.loadingProjects.remove(projectId)
            self.isLoading = false
        }
    }

    private func reset() {
        coverURLs = [:]
        iconURLs = [:]
        loadingProjects = []
        errorMessage = nil
        isLoading = false
    }
}
