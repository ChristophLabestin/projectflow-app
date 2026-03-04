import SwiftUI
import FirebaseAuth

struct SettingsView: View {
    @Environment(\.colorScheme) private var colorScheme
    @EnvironmentObject private var session: SessionStore
    @AppStorage("appTheme") private var appTheme: AppTheme = .system
    
    @StateObject private var workspaceStore = WorkspaceStore()
    @State private var displayName: String = ""
    @State private var bio: String = ""
    @State private var isEditing = false

    private var colors: PFColors { PFColors.palette(for: colorScheme) }
    
    enum AppTheme: String, CaseIterable, Identifiable {
        case system = "System"
        case light = "Light"
        case dark = "Dark"
        var id: String { rawValue }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                AppBackground()
                ScrollView(showsIndicators: false) {
                    VStack(alignment: .leading, spacing: PFSpacing.xl) {
                        // Header
                        Text("Settings")
                            .font(.largeTitle.weight(.bold))
                            .foregroundStyle(colors.textMain)
                        
                        // Profile Card
                        PFCard {
                            VStack(alignment: .leading, spacing: PFSpacing.md) {
                                HStack {
                                    SettingsUserAvatar(name: session.user?.displayName, url: session.user?.photoURL, size: 64)
                                    
                                    VStack(alignment: .leading, spacing: 4) {
                                        if isEditing {
                                            TextField("Display Name", text: $displayName)
                                                .textFieldStyle(.roundedBorder)
                                        } else {
                                            Text(session.userProfile?.displayName ?? "User")
                                                .font(.title3.weight(.semibold))
                                                .foregroundStyle(colors.textMain)
                                        }
                                        
                                        Text(session.user?.email ?? "No email")
                                            .font(.subheadline)
                                            .foregroundStyle(colors.textMuted)
                                    }
                                    
                                    Spacer()
                                    
                                    Button {
                                        if isEditing {
                                            _Concurrency.Task { await saveProfile() }
                                        } else {
                                            displayName = session.userProfile?.displayName ?? ""
                                            bio = session.userProfile?.bio ?? ""
                                            isEditing = true
                                        }
                                    } label: {
                                        Image(systemName: isEditing ? "checkmark.circle.fill" : "pencil.circle.fill")
                                            .font(.title2)
                                            .foregroundStyle(colors.primary)
                                    }
                                }
                                
                                if isEditing {
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text("Bio")
                                            .font(.caption.weight(.semibold))
                                            .foregroundStyle(colors.textMuted)
                                        TextEditor(text: $bio)
                                            .frame(height: 80)
                                            .padding(4)
                                            .background(colors.surfacePaper)
                                            .cornerRadius(4)
                                    }
                                } else if let bioText = session.userProfile?.bio, !bioText.isEmpty {
                                    Text(bioText)
                                        .font(.subheadline)
                                        .foregroundStyle(colors.textSubtle)
                                        .lineLimit(3)
                                }
                            }
                        }
                        
                        // Workspace Switcher
                        VStack(alignment: .leading, spacing: PFSpacing.sm) {
                            Text("Workspace")
                                .font(.headline)
                                .foregroundStyle(colors.textMuted)
                                .padding(.leading, 4)
                            
                            PFCard {
                                VStack(alignment: .leading, spacing: PFSpacing.md) {
                                    if workspaceStore.isLoading {
                                        ProgressView()
                                    } else {
                                        ForEach(workspaceStore.workspaces) { workspace in
                                            Button {
                                                switchWorkspace(to: workspace.id)
                                            } label: {
                                                HStack {
                                                    VStack(alignment: .leading, spacing: 2) {
                                                        Text(workspace.name)
                                                            .font(.subheadline.weight(.semibold))
                                                            .foregroundStyle(colors.textMain)
                                                        Text("\(workspace.planTier) • \(workspace.role)")
                                                            .font(.caption2)
                                                            .foregroundStyle(colors.textMuted)
                                                    }
                                                    
                                                    Spacer()
                                                    
                                                    let activeWorkspaceId = UserDefaults.standard.string(forKey: TenantResolver.activeTenantKey)
                                                        ?? session.user?.uid

                                                    if activeWorkspaceId == workspace.id {
                                                        Image(systemName: "checkmark.circle.fill")
                                                            .foregroundStyle(colors.success)
                                                    }
                                                }
                                            }
                                            .buttonStyle(.plain)
                                            
                                            if workspace.id != workspaceStore.workspaces.last?.id {
                                                Divider()
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        
                        // Appearance
                        VStack(alignment: .leading, spacing: PFSpacing.sm) {
                            Text("Appearance")
                                .font(.headline)
                                .foregroundStyle(colors.textMuted)
                                .padding(.leading, 4)
                            
                            PFCard {
                                Picker("Theme", selection: $appTheme) {
                                    ForEach(AppTheme.allCases) { theme in
                                        Text(theme.rawValue).tag(theme)
                                    }
                                }
                                .pickerStyle(.segmented)
                            }
                        }

                        // Developer Tools
                        VStack(alignment: .leading, spacing: PFSpacing.sm) {
                            Text("Developer")
                                .font(.headline)
                                .foregroundStyle(colors.textMuted)
                                .padding(.leading, 4)
                            
                            NavigationLink {
                                StyleGuideView()
                            } label: {
                                PFCard {
                                    HStack {
                                        Label("Style Guide", systemImage: "paintpalette.fill")
                                            .foregroundStyle(colors.textMain)
                                        Spacer()
                                        Image(systemName: "chevron.right")
                                            .foregroundStyle(colors.textMuted)
                                    }
                                }
                            }
                            .buttonStyle(.plain)
                        }
                        
                        // About
                        VStack(alignment: .leading, spacing: PFSpacing.sm) {
                            Text("About")
                                .font(.headline)
                                .foregroundStyle(colors.textMuted)
                                .padding(.leading, 4)
                            
                            PFCard {
                                VStack(spacing: 0) {
                                    AboutRow(label: "Version", value: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0.0")
                                    Divider().padding(.vertical, 8)
                                    AboutRow(label: "Build", value: Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1")
                                }
                            }
                        }

                        PFPrimaryButton(title: "Sign Out", action: { session.signOut() })
                            .padding(.top, PFSpacing.lg)
                    }
                    .padding(PFSpacing.lg)
                }
            }
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            if let uid = session.user?.uid {
                workspaceStore.start(userId: uid)
            }
        }
        .onDisappear {
            workspaceStore.stop()
        }
        }
    }
    
    private func saveProfile() async {
        await session.updateProfile(displayName: displayName, bio: bio)
        isEditing = false
    }

    private func switchWorkspace(to tenantId: String) {
        TenantResolver.setActiveTenantId(tenantId)
    }
}

private struct SettingsUserAvatar: View {
    let name: String?
    let url: URL?
    let size: CGFloat
    
    var initials: String {
        guard let name = name, !name.isEmpty else { return "U" }
        return String(name.prefix(1)).uppercased()
    }
    
    var body: some View {
        ZStack {
            Circle()
                .fill(Color.blue)
                .frame(width: size, height: size)
            
            if let url = url {
                AsyncImage(url: url) { image in
                    image.resizable().scaledToFill()
                } placeholder: {
                    Text(initials)
                        .font(.system(size: size * 0.4, weight: .bold))
                        .foregroundStyle(.white)
                }
                .clipShape(Circle())
            } else {
                Text(initials)
                    .font(.system(size: size * 0.4, weight: .bold))
                    .foregroundStyle(.white)
            }
        }
    }
}

private struct AboutRow: View {
    let label: String
    let value: String
    @Environment(\.colorScheme) private var colorScheme
    private var colors: PFColors { PFColors.palette(for: colorScheme) }
    
    var body: some View {
        HStack {
            Text(label)
                .foregroundStyle(colors.textMain)
            Spacer()
            Text(value)
                .foregroundStyle(colors.textMuted)
        }
    }
}
