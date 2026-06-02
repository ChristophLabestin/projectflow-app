import SwiftUI
import FirebaseAuth
import FirebaseFirestore

struct ProjectDeepLinkView: View {
    let tenantId: String
    let projectId: String
    let taskId: String?
    let issueId: String?
    let flowId: String?
    let initiativeId: String?
    @State private var project: Project?
    @State private var task: ProjectTask?
    @State private var issue: Issue?
    @State private var flow: Flow?
    @State private var initiative: Initiative?
    @State private var isLoading = true
    @State private var errorMessage: String?
    @Environment(\.colorScheme) private var colorScheme
    @EnvironmentObject private var appSession: AppSession
    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    init(tenantId: String, projectId: String, taskId: String? = nil, issueId: String? = nil, flowId: String? = nil, initiativeId: String? = nil) {
        self.tenantId = tenantId
        self.projectId = projectId
        self.taskId = taskId
        self.issueId = issueId
        self.flowId = flowId
        self.initiativeId = initiativeId
    }

    private var permissions: PermissionContext {
        appSession.permissionContext(project: project)
    }

    var body: some View {
        Group {
            if isLoading {
                VStack {
                    ProgressView()
                    Text("Loading link...")
                        .font(.caption)
                        .foregroundStyle(colors.textMuted)
                }
            } else if let errorMessage {
                errorState(message: errorMessage)
            } else if let task {
                ProjectTaskDetailView(task: task, tenantId: tenantId, permissions: permissions)
            } else if let issue {
                ProjectIssueDetailView(issue: issue, tenantId: tenantId, permissions: permissions)
            } else if let initiative {
                ProjectInitiativeDetailView(initiative: initiative, tenantId: tenantId, permissions: permissions)
            } else if let flow {
                FlowDetailView(flow: flow, tenantId: tenantId, permissions: permissions)
            } else if let project = project {
                ProjectOverviewView(project: project, tenantId: tenantId)
            } else {
                errorState(message: "Project not found")
            }
        }
        .onAppear { fetchProject() }
    }

    private func errorState(message: String) -> some View {
        VStack(spacing: PFSpacing.md) {
            Image(systemName: "exclamationmark.triangle")
                .font(.largeTitle)
                .foregroundStyle(colors.error)
            Text(message).font(.headline)
            Text("We couldn't load the linked ProjectFlow item.")
                .font(.subheadline)
                .foregroundStyle(colors.textMuted)
                .multilineTextAlignment(.center)
        }
        .padding()
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
                self.fetchLinkedItem(db: db)
            }
    }

    private func fetchLinkedItem(db: Firestore) {
        if let taskId {
            fetchDoc(db: db, collection: FirestorePath.tasks, id: taskId) { data in
                if let data { self.task = ProjectTask(id: taskId, data: data) }
                else { self.errorMessage = "Task does not exist." }
                self.isLoading = false
            }
            return
        }
        if let issueId {
            fetchDoc(db: db, collection: FirestorePath.issues, id: issueId) { data in
                if let data { self.issue = Issue(id: issueId, data: data) }
                else { self.errorMessage = "Issue does not exist." }
                self.isLoading = false
            }
            return
        }
        if let initiativeId {
            fetchDoc(db: db, collection: FirestorePath.initiatives, id: initiativeId) { data in
                if let data { self.initiative = Initiative(id: initiativeId, data: data) }
                else { self.errorMessage = "Initiative does not exist." }
                self.isLoading = false
            }
            return
        }
        if let flowId {
            fetchDoc(db: db, collection: FirestorePath.flows, id: flowId) { data in
                if let data { self.flow = Flow(id: flowId, data: data) }
                else { self.errorMessage = "Flow does not exist." }
                self.isLoading = false
            }
            return
        }
        self.isLoading = false
    }

    private func fetchDoc(db: Firestore, collection: String, id: String, completion: @escaping ([String: Any]?) -> Void) {
        db.collection(FirestorePath.tenants)
            .document(tenantId)
            .collection(FirestorePath.projects)
            .document(projectId)
            .collection(collection)
            .document(id)
            .getDocument { snapshot, error in
                if error != nil {
                    completion(nil)
                } else {
                    completion(snapshot?.data())
                }
            }
    }
}
