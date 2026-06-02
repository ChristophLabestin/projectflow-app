import SwiftUI
import FirebaseAuth

struct SettingsView: View {
    @Environment(\.colorScheme) private var colorScheme
    @EnvironmentObject private var session: SessionStore
    @EnvironmentObject private var appSession: AppSession
    
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
                                                    
                                                    let activeWorkspaceId = appSession.activeTenantId
                                                        ?? UserDefaults.standard.string(forKey: TenantResolver.activeTenantKey)

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
                                Picker("Theme", selection: themeBinding) {
                                    ForEach(AppTheme.allCases) { theme in
                                        Text(theme.rawValue).tag(theme)
                                    }
                                }
                                .pickerStyle(.segmented)
                            }
                        }

                        // Language & thresholds
                        VStack(alignment: .leading, spacing: PFSpacing.sm) {
                            Text(L10n.tr("settings.language", fallback: "Language"))
                                .font(.headline)
                                .foregroundStyle(colors.textMuted)
                                .padding(.leading, 4)

                            PFCard {
                                Picker(L10n.tr("settings.language", fallback: "Language"), selection: languageBinding) {
                                    Text(L10n.tr("settings.language.en", fallback: "English")).tag("en")
                                    Text(L10n.tr("settings.language.de", fallback: "Deutsch")).tag("de")
                                }
                                .pickerStyle(.segmented)
                            }
                        }

                        VStack(alignment: .leading, spacing: PFSpacing.sm) {
                            Text(L10n.tr("settings.thresholds", fallback: "Workload thresholds"))
                                .font(.headline)
                                .foregroundStyle(colors.textMuted)
                                .padding(.leading, 4)

                            PFCard {
                                Stepper(
                                    value: dueSoonDaysBinding,
                                    in: 1...30,
                                    step: 1
                                ) {
                                    Text("\(L10n.tr("settings.dueSoonDays", fallback: "Due soon window (days)")): \(dueSoonDaysBinding.wrappedValue)")
                                        .foregroundStyle(colors.textMain)
                                }
                            }
                        }

                        // Developer Tools
                        VStack(alignment: .leading, spacing: PFSpacing.sm) {
                            Text("Developer")
                                .font(.headline)
                                .foregroundStyle(colors.textMuted)
                                .padding(.leading, 4)
                            
                            NavigationLink {
                                CalendarView()
                            } label: {
                                PFCard {
                                    Label("Calendar", systemImage: "calendar")
                                }
                            }

                            NavigationLink {
                                TeamView()
                            } label: {
                                PFCard {
                                    Label("Team", systemImage: "person.3")
                                }
                            }

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
                    .pfScreenPadding()
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
    
    private var themeBinding: Binding<AppTheme> {
        Binding(
            get: {
                switch appSession.appTheme.lowercased() {
                case "light": return .light
                case "dark": return .dark
                default: return .system
                }
            },
            set: { appSession.setTheme($0.rawValue.lowercased()) }
        )
    }

    private var languageBinding: Binding<String> {
        Binding(
            get: { appSession.appLanguage },
            set: { appSession.setLanguage($0) }
        )
    }

    private var dueSoonDaysBinding: Binding<Int> {
        Binding(
            get: { WorkspaceThresholds.dueSoonDays },
            set: { WorkspaceThresholds.dueSoonDays = $0 }
        )
    }

    private func saveProfile() async {
        await session.updateProfile(displayName: displayName, bio: bio)
        isEditing = false
    }

    private     func switchWorkspace(to tenantId: String) {
        TenantResolver.setActiveTenantId(tenantId)
        AppSession.shared.switchWorkspace(to: tenantId)
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
