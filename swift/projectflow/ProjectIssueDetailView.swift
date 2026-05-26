import SwiftUI

struct ProjectIssueDetailView: View {
    @State var issue: Issue
    let tenantId: String
    let permissions: PermissionContext
    
    @StateObject private var issuesStore = IssuesStore()
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.dismiss) private var dismiss
    
    @State private var showingEditor = false
    @State private var draftTitle = ""
    @State private var draftDescription = ""
    @State private var draftStatus = ""
    @State private var draftPriority = ""
    @State private var showingDeleteConfirm = false

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        ZStack {
            AppBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: PFSpacing.lg) {
                    header
                    description
                    details
                    
                    if canEdit {
                        VStack(spacing: PFSpacing.md) {
                            PFSecondaryButton(title: "Edit Issue") {
                                beginEdit()
                            }
                            
                            Button(role: .destructive) {
                                showingDeleteConfirm = true
                            } label: {
                                Text("Delete Issue")
                                    .font(.headline)
                                    .foregroundStyle(colors.error)
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, PFSpacing.sm)
                                    .background(colors.error.opacity(0.1))
                                    .cornerRadius(PFRadius.md)
                            }
                        }
                        .padding(.top, PFSpacing.lg)
                    }
                }
                .pfScreenPadding()
            }
        }
        .navigationTitle("Issue Details")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showingEditor) {
            IssueEditorView(
                isEditing: true,
                title: $draftTitle,
                description: $draftDescription,
                status: $draftStatus,
                priority: $draftPriority
            ) {
                await saveIssue()
            } onCancel: {
                showingEditor = false
            }
        }
        .confirmationDialog("Delete Issue?", isPresented: $showingDeleteConfirm, titleVisibility: .visible) {
            Button("Delete", role: .destructive) {
                _Concurrency.Task {
                    await issuesStore.deleteIssue(
                        tenantId: tenantId,
                        projectId: issue.projectId ?? "",
                        issueId: issue.id,
                        permissions: permissions
                    )
                    dismiss()
                }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This action cannot be undone.")
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: PFSpacing.sm) {
            HStack {
                Text(issue.priority.uppercased())
                    .font(.caption.weight(.bold))
                    .foregroundStyle(priorityColor)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(priorityColor.opacity(0.1))
                    .cornerRadius(4)
                
                Spacer()
                
                Text(issue.status)
                    .font(.caption.weight(.bold))
                    .foregroundStyle(colors.textMain)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(colors.surfaceHover)
                    .clipShape(Capsule())
            }
            
            Text(issue.title)
                .font(.title2.weight(.bold))
                .foregroundStyle(colors.textMain)
        }
    }

    private var description: some View {
        VStack(alignment: .leading, spacing: PFSpacing.xs) {
            Text("Description")
                .font(.headline)
                .foregroundStyle(colors.textMain)
            
            Text(issue.description.isEmpty ? "No description provided." : issue.description)
                .font(.body)
                .foregroundStyle(colors.textSubtle)
        }
    }

    private var details: some View {
        PFCard {
            VStack(spacing: PFSpacing.md) {
                detailRow(label: "Due Date", value: issue.dueDate.isEmpty ? "Not set" : issue.dueDate)
                Divider()
                detailRow(label: "Reporter", value: issue.reporterId.isEmpty ? "Unknown" : "ID: \(issue.reporterId.prefix(8))")
            }
            .padding(PFSpacing.md)
        }
    }

    private func detailRow(label: String, value: String) -> some View {
        HStack {
            Text(label)
                .font(.subheadline)
                .foregroundStyle(colors.textMuted)
            Spacer()
            Text(value)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(colors.textMain)
        }
    }

    private var priorityColor: Color {
        switch issue.priority.lowercased() {
        case "urgent": return colors.error
        case "high": return colors.warning
        case "medium": return .blue
        case "low": return colors.success
        default: return colors.textMuted
        }
    }
    
    private var canEdit: Bool {
        PermissionEvaluator(context: permissions).allows(PermissionNode.issuesEdit)
    }
    
    private func beginEdit() {
        draftTitle = issue.title
        draftDescription = issue.description
        draftStatus = issue.status
        draftPriority = issue.priority
        showingEditor = true
    }
    
    private func saveIssue() async {
        await issuesStore.updateIssue(
            tenantId: tenantId,
            projectId: issue.projectId ?? "",
            issueId: issue.id,
            title: draftTitle,
            description: draftDescription,
            status: draftStatus,
            priority: draftPriority,
            permissions: permissions
        )
        
        if issuesStore.errorMessage == nil {
            issue.title = draftTitle
            issue.description = draftDescription
            issue.status = draftStatus
            issue.priority = draftPriority
            showingEditor = false
        }
    }
}

// Internal IssueEditorView
private struct IssueEditorView: View {
    @Environment(\.colorScheme) private var colorScheme
    let isEditing: Bool
    @Binding var title: String
    @Binding var description: String
    @Binding var status: String
    @Binding var priority: String
    let onSave: () async -> Void
    let onCancel: () -> Void

    private var colors: PFColors { PFColors.palette(for: colorScheme) }
    private let statuses = ["Open", "In Progress", "Resolved", "Closed"]
    private let priorities = ["Low", "Medium", "High", "Urgent"]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: PFSpacing.lg) {
                Text(isEditing ? "Edit Issue" : "New Issue")
                    .font(.title2.weight(.semibold))
                    .foregroundStyle(colors.textMain)

                PFInputField(
                    title: "Title",
                    placeholder: "Issue title",
                    text: $title,
                    isSecure: false,
                    keyboardType: .default
                )

                VStack(alignment: .leading, spacing: PFSpacing.xs) {
                    Text("Description")
                        .font(.caption)
                        .foregroundStyle(colors.textMuted)

                    TextEditor(text: $description)
                        .frame(minHeight: 120)
                        .padding(PFSpacing.sm)
                        .background(colors.surfacePaper)
                        .clipShape(RoundedRectangle(cornerRadius: PFRadius.md, style: .continuous))
                        .shadow(color: colors.shadowSm, radius: 4, x: 0, y: 2)
                }

                VStack(alignment: .leading, spacing: PFSpacing.xs) {
                    Text("Status")
                        .font(.caption)
                        .foregroundStyle(colors.textMuted)

                    Picker("Status", selection: $status) {
                        ForEach(statuses, id: \.self) { value in
                            Text(value).tag(value)
                        }
                    }
                    .pickerStyle(.menu)
                }

                VStack(alignment: .leading, spacing: PFSpacing.xs) {
                    Text("Priority")
                        .font(.caption)
                        .foregroundStyle(colors.textMuted)

                    Picker("Priority", selection: $priority) {
                        ForEach(priorities, id: \.self) { value in
                            Text(value).tag(value)
                        }
                    }
                    .pickerStyle(.menu)
                }

                PFPrimaryButton(title: isEditing ? "Save Changes" : "Create Issue") {
                    _Concurrency.Task {
                        await onSave()
                    }
                }

                PFSecondaryButton(title: "Cancel") {
                    onCancel()
                }
            }
            .padding(PFSpacing.lg)
        }
        .background(colors.surfaceBg.ignoresSafeArea())
    }
}
