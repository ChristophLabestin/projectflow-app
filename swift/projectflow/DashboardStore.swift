import Foundation
import Combine
import FirebaseAuth
import FirebaseFirestore
import SwiftUI

struct TrendData: Identifiable {
    let id = UUID()
    let date: Date
    let value: Int
    let type: String // "Tasks"
}

@MainActor
final class DashboardStore: ObservableObject {
    @Published var isLoading = true
    @Published var projectCount = 0
    @Published var taskCount = 0
    @Published var openTaskCount = 0
    @Published var recentTasks: [ProjectTask] = []
    @Published var scheduledTasks: [Date: [ProjectTask]] = [:]
    
    // Focus Metrics
    @Published var overdueTaskCount = 0
    @Published var dueTodayTaskCount = 0
    @Published var blockedTaskCount = 0
    @Published var urgentTaskCount = 0
    @Published var assignedToMeTaskCount = 0
    
    // Distributions
    @Published var projectStatusDistribution: [ChartData] = []
    @Published var taskPriorityDistribution: [ChartData] = []
    
    // Trends
    @Published var trendData: [TrendData] = []

    private let db = Firestore.firestore()
    private let projectRepository = ProjectRepository()
    private var projectListener: ListenerRegistration?
    private var taskListener: ListenerRegistration?

    private var currentUserId: String?

    // Temp storage for aggregating trends
    private var rawTasks: [ProjectTask] = []

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
            let activeProjects = projects.filter { !ProjectStatus.excludesFromHealth($0.status) }
            self.projectCount = activeProjects.count
            self.updateProjectStats(activeProjects)
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
                    ProjectTask(id: doc.documentID, data: doc.data())
                }
                
                print("DashboardStore: Successfully decoded \(tasks.count) tasks")
                self.rawTasks = tasks
                self.processTasks(tasks)
                self.updateTrends()
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
        recentTasks = []

        overdueTaskCount = 0
        dueTodayTaskCount = 0
        blockedTaskCount = 0
        urgentTaskCount = 0
        assignedToMeTaskCount = 0
        projectStatusDistribution = []
        taskPriorityDistribution = []
        trendData = []

        rawTasks = []
    }

    private func removeListeners() {
        projectListener?.remove()
        taskListener?.remove()
        projectListener = nil
        taskListener = nil
    }

    private func recentItems<T>(from items: [T], limit: Int, timestamp: (T) -> Timestamp?) -> [T] {
        let sorted = items.sorted { lhs, rhs in
            let left = timestamp(lhs)?.dateValue() ?? Date.distantPast
            let right = timestamp(rhs)?.dateValue() ?? Date.distantPast
            return left > right
        }
        return Array(sorted.prefix(limit))
    }
    
    private func processTasks(_ tasks: [ProjectTask]) {
        taskCount = tasks.count
        let openTasks = tasks.filter { !$0.isCompleted }
        openTaskCount = openTasks.count
        recentTasks = recentItems(from: tasks, limit: 4) { $0.createdAt }
        
        // Focus Metrics
        let now = Date()
        let calendar = Calendar.current
        let startOfToday = calendar.startOfDay(for: now)
        let endOfToday = calendar.date(byAdding: .day, value: 1, to: startOfToday)!
        
        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "yyyy-MM-dd"
        
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
        
        // Scheduled Tasks (last 7 days + next 7 days)
        var scheduled: [Date: [ProjectTask]] = [:]
        for task in tasks {
            guard !task.dueDate.isEmpty,
                  let date = dateFormatter.date(from: task.dueDate) else { continue }
            let startOfDay = calendar.startOfDay(for: date)
            scheduled[startOfDay, default: []].append(task)
        }
        self.scheduledTasks = scheduled
        
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
    
    private func updateTaskDistribution(_ tasks: [ProjectTask]) {
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
    
    private func updateTrends() {
        // Aggregate last 7 days
        var trends: [TrendData] = []
        let calendar = Calendar.current
        let now = Date()
        
        // Helper to bucket items by day
        func bucket<T>(items: [T], type: String, dateExtractor: (T) -> Date?) {
            var counts: [Date: Int] = [:]
            
            // Initialize last 7 days with 0
            for i in 0..<7 {
                if let day = calendar.date(byAdding: .day, value: -i, to: now) {
                    let startOfDay = calendar.startOfDay(for: day)
                    counts[startOfDay] = 0
                }
            }
            
            for item in items {
                guard let date = dateExtractor(item) else { continue }
                let startOfDay = calendar.startOfDay(for: date)
                if counts.keys.contains(startOfDay) {
                    counts[startOfDay] = (counts[startOfDay] ?? 0) + 1
                }
            }
            
            for (date, count) in counts {
                trends.append(TrendData(date: date, value: count, type: type))
            }
        }
        
        bucket(items: rawTasks, type: "Tasks") { $0.createdAt?.dateValue() }
        
        trendData = trends.sorted { $0.date < $1.date }
    }
}
