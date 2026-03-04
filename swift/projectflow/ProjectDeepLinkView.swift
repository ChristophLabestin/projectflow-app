import SwiftUI
import FirebaseFirestore

struct ProjectDeepLinkView: View {
    let tenantId: String
    let projectId: String
    @State private var project: Project?
    @State private var isLoading = true
    @State private var errorMessage: String?
    @Environment(\.colorScheme) private var colorScheme
    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        Group {
            if isLoading {
                VStack {
                    ProgressView()
                    Text("Loading project...")
                        .font(.caption)
                        .foregroundStyle(colors.textMuted)
                }
            } else if let project = project {
                ProjectOverviewView(project: project, tenantId: tenantId)
            } else {
                VStack(spacing: PFSpacing.md) {
                    Image(systemName: "exclamationmark.triangle")
                        .font(.largeTitle)
                        .foregroundStyle(colors.error)
                    Text(errorMessage ?? "Project not found")
                        .font(.headline)
                    Text("We couldn't load the project details.")
                        .font(.subheadline)
                        .foregroundStyle(colors.textMuted)
                }
                .padding()
            }
        }
        .onAppear {
            fetchProject()
        }
    }

    private func fetchProject() {
        let db = Firestore.firestore()
        db.collection(FirestorePath.tenants)
            .document(tenantId)
            .collection(FirestorePath.projects)
            .document(projectId)
            .getDocument { snapshot, error in
                if let error = error {
                    self.errorMessage = error.localizedDescription
                    self.isLoading = false
                    return
                }
                
                guard let data = snapshot?.data() else {
                    self.errorMessage = "Project does not exist."
                    self.isLoading = false
                    return
                }
                
                self.project = Project(id: projectId, data: data)
                self.isLoading = false
            }
    }
}
