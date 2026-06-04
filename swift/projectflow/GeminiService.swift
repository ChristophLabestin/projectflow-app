import Foundation
import FirebaseFunctions
import FirebaseFirestore

class GeminiService {
    static let shared = GeminiService()
    private let functions = Functions.functions(region: "europe-west3")
    
    func callGemini(
        prompt: String,
        image: String? = nil,
        systemInstruction: String? = nil,
        temperature: Double = 0.7,
        jsonMode: Bool = false
    ) async throws -> (text: String, tokensUsed: Int) {
        var data: [String: Any] = [
            "prompt": prompt,
            "systemInstruction": systemInstruction ?? "",
            "temperature": temperature,
            "jsonMode": jsonMode
        ]
        
        if let image {
            data["image"] = image
        }
        
        return try await withCheckedThrowingContinuation { continuation in
            functions.httpsCallable("callGemini").call(data) { result, error in
                if let error = error {
                    continuation.resume(throwing: error)
                    return
                }
                
                guard let data = result?.data as? [String: Any],
                      let text = data["text"] as? String else {
                    continuation.resume(throwing: NSError(domain: "GeminiService", code: -1, userInfo: [NSLocalizedDescriptionKey: "Invalid response from Gemini"]))
                    return
                }
                
                let tokensUsed = data["tokensUsed"] as? Int ?? 0
                continuation.resume(returning: (text, tokensUsed))
            }
        }
    }
    
    func generateProjectReportPrompt(
        project: Project,
        tasks: [ProjectTask],
        milestones: [Milestone],
        activity: [ActivityItem],
        members: [ProjectMember]
    ) -> String {
        let openTasks = tasks.filter { !$0.isCompleted }
        let completedTasks = tasks.filter { $0.isCompleted }
        let highPriorityTasks = openTasks.filter { $0.priority == "High" || $0.priority == "Urgent" }

        let pendingMilestones = milestones.filter { $0.status != "Achieved" }
        let nextMilestone = pendingMilestones.sorted { a, b in
            (a.dueDate) < (b.dueDate)
        }.first

        let recentActivity = activity.prefix(5).map { "\($0.user) \($0.action) \($0.target)" }.joined(separator: "; ")
        
        return """
        You are CORA, an expert project manager. Create a comprehensive, professional status report for the project "\(project.title)".
        
        **Project Context:**
        - Description: \(project.description.isEmpty ? "No description provided" : project.description)
        - Status: \(project.status)
        - Priority: \(project.priority.isEmpty ? "Medium" : project.priority)
        - Timeline: Due \(project.dueDate.isEmpty ? "N/A" : project.dueDate)
        - Team Size: \(members.count) members

        **Key Metrics:**
        - Tasks: \(openTasks.count) open (\(highPriorityTasks.count) high priority), \(completedTasks.count) completed.
        - Milestones: \(milestones.filter { $0.status == "Achieved" }.count)/\(milestones.count) achieved. Next up: \(nextMilestone != nil ? "\(nextMilestone!.title) (Due: \(nextMilestone!.dueDate))" : "None").

        **Recent Activity:**
        \(recentActivity)

        **Instructions:**
        Generate a structured Markdown report with the following sections:
        
        # 📊 Project Status Report: \(project.title)
        
        ## 🚨 Executive Summary
        A brief 2-3 sentence overview of the project's health. Is it on track, at risk, or blocked? Mention the most critical blocker if any.

        ## 📅 Timeline & Milestones
        Assessment of the timeline. Are we hitting the next milestone? Any delays expected?

        ## 🏗 Work in Progress
        Highlight key high-priority tasks and recent progress. Do NOT list every task, just the strategic focus.

        ## 🚧 Risks & Blockers
        Summary of open risks and blockers. If there are high-priority concerns, flag them.

        ## 💡 Recommendations
        2-3 actionable next steps for the team to maintain momentum or fix problems.

        Keep the tone professional yet encouraging. Use emojis sparingly for section headers only.
        """
    }
}
