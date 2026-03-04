import SwiftUI

struct DashboardTaskRow: View {
    let task: ProjectTask
    @Environment(\.colorScheme) private var colorScheme
    
    private var colors: PFColors { PFColors.palette(for: colorScheme) }
    
    var body: some View {
        HStack(spacing: PFSpacing.md) {
            Circle()
                .fill(colors.surfaceHover)
                .frame(width: 20, height: 20)
            
            VStack(alignment: .leading, spacing: 2) {
                Text(task.title)
                    .font(.body.weight(.medium))
                    .foregroundStyle(colors.textMain)
                    .lineLimit(1)
                
                HStack(spacing: 6) {
                    if !task.priority.isEmpty {
                        Text(task.priority)
                            .font(.caption2.weight(.bold))
                            .foregroundStyle(priorityColor(task.priority))
                            .padding(.horizontal, 4)
                            .padding(.vertical, 2)
                            .background(priorityColor(task.priority).opacity(0.1))
                            .clipShape(RoundedRectangle(cornerRadius: 4))
                    }

                    if !task.dueDate.isEmpty {
                        Text(formattedDate(task.dueDate))
                            .font(.caption)
                            .foregroundStyle(isOverdue(task.dueDate) ? colors.error : colors.textMuted)
                    } else {
                        Text("No due date")
                            .font(.caption)
                            .foregroundStyle(colors.textSubtle)
                    }
                }
            }
            
            Spacer()
            
            StatusPill(text: task.status.isEmpty ? "Open" : task.status)
                .scaleEffect(0.8)
        }
        .padding(.vertical, 4)
    }
    
    private func priorityColor(_ priority: String) -> Color {
        switch priority.lowercased() {
        case "urgent": return colors.error
        case "high": return colors.warning
        case "medium": return .blue
        case "low": return colors.success
        default: return colors.textMuted
        }
    }
    
    private func formattedDate(_ value: String) -> String {
        guard let date = parseDate(value) else { return value }
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM d"
        return formatter.string(from: date)
    }
    
    private func isOverdue(_ value: String) -> Bool {
        guard let date = parseDate(value) else { return false }
        return date < Date() && !Calendar.current.isDateInToday(date)
    }

    private func parseDate(_ value: String) -> Date? {
        let isoFormatter = ISO8601DateFormatter()
        if let date = isoFormatter.date(from: value) {
            return date
        }

        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.date(from: value)
    }
}

private struct StatusPill: View {
    @Environment(\.colorScheme) private var colorScheme
    let text: String

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        Text(text)
            .font(.caption.weight(.semibold))
            .foregroundStyle(colors.textMain)
            .padding(.horizontal, PFSpacing.sm)
            .padding(.vertical, 4)
            .background(colors.surfaceHover)
            .clipShape(Capsule())
    }
}
