import SwiftUI

struct ProjectMemberManagementView: View {
    let project: Project
    let tenantId: String
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var colorScheme
    @EnvironmentObject private var session: SessionStore
    @StateObject private var teamStore = ProjectTeamStore()
    @StateObject private var projectsStore = ProjectsStore()
    @StateObject private var tenantStore = TenantStore()
    @StateObject private var groupStore = GroupStore()
    
    @State private var emailToInvite = ""
    @State private var isInviting = false
    @State private var showingGroupCreator = false
    
    private var colors: PFColors { PFColors.palette(for: colorScheme) }
    private var permissionContext: PermissionContext {
        tenantStore.permissionContext(projectOwnerId: project.ownerId)
    }

    var body: some View {
        NavigationStack {
            ZStack {
                AppBackground()
                
                ScrollView {
                    VStack(alignment: .leading, spacing: PFSpacing.xl) {
                        inviteSection
                        memberListSection
                        groupsSection
                    }
                    .padding(PFSpacing.lg)
                }
            }
            .navigationTitle("Project Team")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
            .sheet(isPresented: $showingGroupCreator) {
                GroupCreatorView(tenantId: tenantId)
            }
            .onAppear {
                teamStore.start(tenantId: tenantId)
                teamStore.ensureProfiles(for: project.memberIds)
                projectsStore.start(tenantId: tenantId)
                tenantStore.update(for: session.user)
                groupStore.start(tenantId: tenantId)
            }
            .onDisappear {
                groupStore.stop()
            }
        }
    }
    
    private var groupsSection: some View {
        VStack(alignment: .leading, spacing: PFSpacing.md) {
            HStack {
                PFSectionHeader(title: "Groups", subtitle: "Managed team segments")
                Spacer()
                Button {
                    showingGroupCreator = true
                } label: {
                    Image(systemName: "plus.circle.fill")
                        .font(.title3)
                        .foregroundStyle(colors.primary)
                }
            }
            
            VStack(spacing: PFSpacing.md) {
                if groupStore.groups.isEmpty {
                    Text("No groups created yet.")
                        .font(.subheadline)
                        .foregroundStyle(colors.textMuted)
                        .padding()
                        .frame(maxWidth: .infinity)
                        .background(colors.surfaceCard)
                        .cornerRadius(PFRadius.md)
                } else {
                    ForEach(groupStore.groups) { group in
                        PFCard {
                            HStack {
                                Circle()
                                    .fill(Color(hex: group.color))
                                    .frame(width: 12, height: 12)
                                
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(group.name)
                                        .font(.subheadline.weight(.semibold))
                                        .foregroundStyle(colors.textMain)
                                    Text("\(group.memberIds.count) members")
                                        .font(.caption2)
                                        .foregroundStyle(colors.textMuted)
                                }
                                
                                Spacer()
                                
                                Image(systemName: "chevron.right")
                                    .font(.caption)
                                    .foregroundStyle(colors.textMuted)
                            }
                        }
                    }
                }
            }
        }
    }
    
    private var inviteSection: some View {
        VStack(alignment: .leading, spacing: PFSpacing.md) {
            PFSectionHeader(title: "Invite Member", subtitle: "Add someone to the project via email")
            
            HStack(spacing: PFSpacing.sm) {
                TextField("Email address", text: $emailToInvite)
                    .textFieldStyle(.roundedBorder)
                    .autocapitalization(.none)
                    .keyboardType(.emailAddress)
                
                if isInviting {
                    ProgressView()
                        .padding(.horizontal, 8)
                } else {
                    Button {
                        inviteUser()
                    } label: {
                        Text("Invite")
                            .font(.subheadline.weight(.bold))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 16)
                            .padding(.vertical, 8)
                            .background(colors.primary)
                            .clipShape(Capsule())
                    }
                    .disabled(emailToInvite.isEmpty)
                }
            }
            
            if let error = projectsStore.errorMessage {
                Text(error)
                    .font(.caption)
                    .foregroundStyle(colors.error)
            }
        }
        .padding(PFSpacing.md)
        .background(colors.surfaceCard)
        .clipShape(RoundedRectangle(cornerRadius: PFRadius.lg))
    }
    
    private var memberListSection: some View {
        VStack(alignment: .leading, spacing: PFSpacing.md) {
            PFSectionHeader(title: "Current Members", subtitle: "\(project.memberIds.count) people")
            
            VStack(spacing: 0) {
                ForEach(project.memberIds, id: \.self) { userId in
                    memberRow(userId: userId)
                    
                    if userId != project.memberIds.last {
                        Divider().padding(.leading, 50)
                    }
                }
            }
            .background(colors.surfaceCard)
            .clipShape(RoundedRectangle(cornerRadius: PFRadius.lg))
        }
    }
    
    private func memberRow(userId: String) -> some View {
        let profile = teamStore.profilesById[userId]
        let presence = teamStore.presenceById[userId]
        let role = project.members.first(where: { $0.userId == userId })?.role ?? "Member"
        let isOwner = userId == project.ownerId
        
        return HStack(spacing: PFSpacing.md) {
            // Avatar with Presence
            ZStack(alignment: .bottomTrailing) {
                if let photoURL = profile?.photoURL, let url = URL(string: photoURL) {
                    AsyncImage(url: url) { image in
                        image.resizable().scaledToFill()
                    } placeholder: {
                        colors.surfaceHover
                    }
                    .frame(width: 40, height: 40)
                    .clipShape(Circle())
                } else {
                    Circle()
                        .fill(colors.primary.opacity(0.1))
                        .frame(width: 40, height: 40)
                        .overlay(
                            Text(String((profile?.displayName ?? "U").prefix(1)).uppercased())
                                .font(.headline)
                                .foregroundStyle(colors.primary)
                        )
                }
                
                // Presence Dot
                Circle()
                    .fill(presenceColor(presence))
                    .frame(width: 12, height: 12)
                    .overlay(Circle().stroke(colors.surfaceCard, lineWidth: 2))
            }
            
            VStack(alignment: .leading, spacing: 2) {
                Text(profile?.displayName ?? "Loading...")
                    .font(.body.weight(.semibold))
                    .foregroundStyle(colors.textMain)
                
                Text(isOwner ? "Owner" : role)
                    .font(.caption)
                    .foregroundStyle(colors.textMuted)
            }
            
            Spacer()
            
            if !isOwner && PermissionEvaluator(context: permissionContext).allows(PermissionNode.projectSettingsEdit) {
                Menu {
                    Button("Remove Member", role: .destructive) {
                        removeUser(userId: userId)
                    }
                    
                    Menu("Change Role") {
                        Button("Admin") { updateRole(userId: userId, role: "Admin") }
                        Button("Member") { updateRole(userId: userId, role: "Member") }
                        Button("Viewer") { updateRole(userId: userId, role: "Viewer") }
                    }
                } label: {
                    Image(systemName: "ellipsis")
                        .font(.body)
                        .foregroundStyle(colors.textMuted)
                        .padding(8)
                }
            }
        }
        .padding(PFSpacing.md)
    }
    
    private func presenceColor(_ presence: PresenceSnapshot?) -> Color {
        guard let presence else { return .gray.opacity(0.5) }
        if presence.isOnline { return colors.success }
        if presence.isBusy { return colors.error }
        if presence.isIdle { return colors.warning }
        return .gray.opacity(0.5)
    }
    
    private func inviteUser() {
        isInviting = true
        _Concurrency.Task {
            await projectsStore.inviteMember(
                tenantId: tenantId,
                projectId: project.id,
                email: emailToInvite,
                permissions: permissionContext
            )
            isInviting = false
            if projectsStore.errorMessage == nil {
                emailToInvite = ""
            }
        }
    }
    
    private func removeUser(userId: String) {
        _Concurrency.Task {
            await projectsStore.removeMember(
                tenantId: tenantId,
                projectId: project.id,
                userId: userId,
                permissions: permissionContext
            )
        }
    }
    
    private func updateRole(userId: String, role: String) {
        _Concurrency.Task {
            await projectsStore.updateMemberRole(
                tenantId: tenantId,
                projectId: project.id,
                userId: userId,
                newRole: role,
                permissions: permissionContext
            )
        }
    }
}
