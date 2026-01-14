import Foundation
import Combine
import FirebaseAuth
import FirebaseFirestore
import SwiftUI

struct ChartData: Identifiable {
    let id = UUID()
    let label: String
    let value: Int
    let color: Color
}

@MainActor
final class DashboardStore: ObservableObject {
    @Published var isLoading = true
    @Published var projectCount = 0
    @Published var taskCount = 0
    @Published var openTaskCount = 0
    @Published var issueCount = 0
    @Published var openIssueCount = 0
    @Published var flowCount = 0
    @Published var recentTasks: [Task] = []
    @Published var recentIssues: [Issue] = []
    @Published var recentFlows: [Flow] = []
    
    // Focus Metrics
    @Published var overdueTaskCount = 0
    @Published var dueTodayTaskCount = 0
    @Published var blockedTaskCount = 0
    @Published var urgentTaskCount = 0
    @Published var assignedToMeTaskCount = 0
    
    // Distributions
    @Published var projectStatusDistribution: [ChartData] = []
    @Published var taskPriorityDistribution: [ChartData] = []

    private let db = Firestore.firestore()
    private let projectRepository = ProjectRepository()
    private var projectListener: ListenerRegistration?
    private var taskListener: ListenerRegistration?
    private var issueListener: ListenerRegistration?
    private var flowListener: ListenerRegistration?
    
    private var currentUserId: String?

    func start() {
        guard let user = Auth.auth().currentUser else {
            print("DashboardStore: No user found")
            reset()
            return
        }
        
        self.currentUserId = user.uid

        guard let tenantId = TenantResolver.resolveTenantId(for: user) else {
            print("DashboardStore: No tenantId resolved for user \(user.uid)")
            reset()
            return
        }
        
        print("DashboardStore: Starting with tenantId: \(tenantId)")

        isLoading = true
        removeListeners()

        projectListener = projectRepository.listenProjects(tenantId: tenantId) { [weak self] projects in
            guard let self else { return }
            print("DashboardStore: Projects updated. Count: \(projects.count)")
            self.projectCount = projects.count
            self.updateProjectStats(projects)
            self.isLoading = false
        }

        print("DashboardStore: Setting up task listener for tenantId: \(tenantId)")
        taskListener = db.collectionGroup(FirestorePath.tasks)
            .whereField("tenantId", isEqualTo: tenantId)
            .addSnapshotListener { [weak self] snapshot, error in
                guard let self else { return }
                if let error = error {
                    print("DashboardStore: Task listener error: \(error)")
                    return
                }
                
                guard let snapshot = snapshot else {
                    print("DashboardStore: Task snapshot is nil")
                    return
                }
                
                print("DashboardStore: Task snapshot received. Documents: \(snapshot.documents.count)")
                
                let tasks = snapshot.documents.map { doc in
                    Task(id: doc.documentID, data: doc.data())
                }
                
                print("DashboardStore: Successfully decoded \(tasks.count) tasks")
                self.processTasks(tasks)
                self.isLoading = false
            }

        issueListener = db.collectionGroup(FirestorePath.issues)
            .whereField("tenantId", isEqualTo: tenantId)
            .addSnapshotListener { [weak self] snapshot, error in
                guard let self else { return }
                if let error = error {
                    print("DashboardStore: Issue listener error: \(error)")
                    return
                }
                guard let snapshot = snapshot else { return }
                print("DashboardStore: Issue snapshot received. Documents: \(snapshot.documents.count)")
                
                let issues = snapshot.documents.map { Issue(id: $0.documentID, data: $0.data()) }
                self.issueCount = issues.count
                self.openIssueCount = issues.filter { $0.status != "Resolved" && $0.status != "Closed" }.count
                self.recentIssues = self.recentItems(from: issues, limit: 4) { $0.createdAt }
                self.isLoading = false
            }

        flowListener = db.collectionGroup(FirestorePath.flows)
            .whereField("tenantId", isEqualTo: tenantId)
            .addSnapshotListener { [weak self] snapshot, error in
                guard let self else { return }
                if let error = error {
                    print("DashboardStore: Flow listener error: \(error)")
                    return
                }
                guard let snapshot = snapshot else { return }
                print("DashboardStore: Flow snapshot received. Documents: \(snapshot.documents.count)")
                
                let flows = snapshot.documents.map { Flow(id: $0.documentID, data: $0.data()) }
                self.flowCount = flows.count
                self.recentFlows = self.recentItems(from: flows, limit: 4) { $0.createdAt }
                self.isLoading = false
            }
    }

    func stop() {
        removeListeners()
    }

    private func reset() {
        isLoading = false
        projectCount = 0
        taskCount = 0
        openTaskCount = 0
        issueCount = 0
        openIssueCount = 0
        flowCount = 0
        recentTasks = []
        recentIssues = []
        recentFlows = []
        
        overdueTaskCount = 0
        dueTodayTaskCount = 0
        blockedTaskCount = 0
        urgentTaskCount = 0
        assignedToMeTaskCount = 0
        projectStatusDistribution = []
        taskPriorityDistribution = []
    }

    private func removeListeners() {
        projectListener?.remove()
        taskListener?.remove()
        issueListener?.remove()
        flowListener?.remove()
        projectListener = nil
        taskListener = nil
        issueListener = nil
        flowListener = nil
    }

    private func recentItems<T>(from items: [T], limit: Int, timestamp: (T) -> Timestamp?) -> [T] {
        let sorted = items.sorted { lhs, rhs in
            let left = timestamp(lhs)?.dateValue() ?? Date.distantPast
            let right = timestamp(rhs)?.dateValue() ?? Date.distantPast
            return left > right
        }
        return Array(sorted.prefix(limit))
    }
    
    private func processTasks(_ tasks: [Task]) {
        taskCount = tasks.count
        let openTasks = tasks.filter { !$0.isCompleted }
        openTaskCount = openTasks.count
        recentTasks = recentItems(from: tasks, limit: 4) { $0.createdAt }
        
        // Focus Metrics
        let now = Date()
        let calendar = Calendar.current
        let startOfToday = calendar.startOfDay(for: now)
        let endOfToday = calendar.date(byAdding: .day, value: 1, to: startOfToday)!
        
        // DateFormatter for parsing string dates (Assuming "yyyy-MM-dd" or ISO from backend)
        // Adjust format based on actual data. Assuming standard ISO8601 or yyyy-MM-dd
        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "yyyy-MM-dd" // Typical for simple date strings
        
        overdueTaskCount = openTasks.filter { task in
            guard let date = dateFormatter.date(from: task.dueDate) else { return false }
            return date < startOfToday
        }.count
        
        dueTodayTaskCount = openTasks.filter { task in
            guard let date = dateFormatter.date(from: task.dueDate) else { return false }
            return date >= startOfToday && date < endOfToday
        }.count
        
        blockedTaskCount = openTasks.filter { $0.status == "Blocked" }.count
        
        urgentTaskCount = openTasks.filter { $0.priority == "Urgent" }.count
        
        if let userId = currentUserId {
            assignedToMeTaskCount = openTasks.filter { $0.assigneeIds.contains(userId) }.count
        } else {
            assignedToMeTaskCount = 0
        }
        
        // Task Distribution
        updateTaskDistribution(openTasks)
    }
    
    private func updateProjectStats(_ projects: [Project]) {
        let statusCounts = Dictionary(grouping: projects, by: { $0.status })
            .mapValues { $0.count }
        
        // Define colors for statuses
        let statusColors: [String: Color] = [
            "Active": .indigo,
            "Completed": .green,
            "Planning": .orange,
            "On Hold": .gray
        ]
        
        projectStatusDistribution = statusCounts.map { (key, value) in
            ChartData(label: key, value: value, color: statusColors[key] ?? .gray)
        }.sorted { $0.value > $1.value }
    }
    
    private func updateTaskDistribution(_ tasks: [Task]) {
        let priorityCounts = Dictionary(grouping: tasks, by: { $0.priority })
            .mapValues { $0.count }
        
        let priorityColors: [String: Color] = [
            "Urgent": .red,
            "High": .orange,
            "Medium": .blue,
            "Low": .gray
        ]
        
        taskPriorityDistribution = priorityCounts.map { (key, value) in
            ChartData(label: key, value: value, color: priorityColors[key] ?? .gray)
        }.sorted {
            let order = ["Urgent": 0, "High": 1, "Medium": 2, "Low": 3]
            return (order[$0.label] ?? 4) < (order[$1.label] ?? 4)
        }
    }
}
