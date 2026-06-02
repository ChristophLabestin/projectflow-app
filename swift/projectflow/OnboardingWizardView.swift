import SwiftUI
import FirebaseAuth

enum OnboardingStep: Int, CaseIterable {
    case profile = 0
    case plan = 1
    case workspace = 2
    case complete = 3
}

struct OnboardingWizardView: View {
    @Environment(\.colorScheme) private var colorScheme
    @EnvironmentObject private var session: SessionStore
    @State private var currentStep: OnboardingStep = .profile
    @State private var displayName = ""
    @State private var workspaceName = ""
    @State private var selectedPlan = "Professional"
    @State private var isSubmitting = false
    @State private var error: String?

    private var colors: PFColors { PFColors.palette(for: colorScheme) }
    private let repo = TenantRepository()

    var body: some View {
        ZStack {
            AppBackground()
            
            VStack(spacing: PFSpacing.xl) {
                // Progress Bar
                progressHeader
                
                // Content
                ScrollView {
                    VStack(spacing: PFSpacing.xl) {
                        switch currentStep {
                        case .profile:
                            profileStep
                        case .plan:
                            planStep
                        case .workspace:
                            workspaceStep
                        case .complete:
                            completionStep
                        }
                    }
                    .padding(PFSpacing.lg)
                }
                
                // Footer Actions
                footerActions
            }
        }
        .navigationBarBackButtonHidden(true)
    }

    private var progressHeader: some View {
        VStack(spacing: PFSpacing.md) {
            HStack(spacing: 4) {
                ForEach(0..<3) { index in
                    Capsule()
                        .fill(index <= currentStep.rawValue ? colors.primary : colors.surfaceHover)
                        .frame(height: 4)
                }
            }
            .padding(.horizontal, PFSpacing.xl)
            .padding(.top, PFSpacing.lg)
            
            Text(stepTitle)
                .font(.headline)
                .foregroundStyle(colors.textMain)
        }
    }

    private var profileStep: some View {
        VStack(alignment: .leading, spacing: PFSpacing.lg) {
            stepInfo(
                title: "How should we call you?",
                subtitle: "Your name will be visible to your team members."
            )
            
            PFInputField(
                title: "Full Name",
                placeholder: "e.g. Alex Rivera",
                text: $displayName,
                isSecure: false,
                keyboardType: .default
            )
        }
    }

    private var planStep: some View {
        VStack(alignment: .leading, spacing: PFSpacing.lg) {
            stepInfo(
                title: "Choose your path",
                subtitle: "Select the plan that best fits your scale."
            )
            
            VStack(spacing: PFSpacing.md) {
                PlanCard(
                    title: "Starter",
                    price: "Free",
                    description: "For individuals and solo creators.",
                    features: ["1 Project", "Basic Tasks", "No AI"],
                    isSelected: selectedPlan == "Starter",
                    onSelect: { selectedPlan = "Starter" }
                )
                
                PlanCard(
                    title: "Professional",
                    price: "$12/mo",
                    description: "For teams and growing startups.",
                    features: ["Unlimited Projects", "Full AI Studio", "Team Focus"],
                    isSelected: selectedPlan == "Professional",
                    onSelect: { selectedPlan = "Professional" }
                )
                
                PlanCard(
                    title: "Organization",
                    price: "Custom",
                    description: "For scale and advanced governance.",
                    features: ["SSO Support", "Custom AI Quotas", "Dedicated Support"],
                    isSelected: selectedPlan == "Organization",
                    onSelect: { selectedPlan = "Organization" }
                )
            }
        }
    }

    private var workspaceStep: some View {
        VStack(alignment: .leading, spacing: PFSpacing.lg) {
            stepInfo(
                title: "Name your workspace",
                subtitle: "This is usually your company or team name."
            )
            
            PFInputField(
                title: "Workspace Name",
                placeholder: "e.g. Acme Corp",
                text: $workspaceName,
                isSecure: false,
                keyboardType: .default
            )
        }
    }

    private var completionStep: some View {
        VStack(spacing: PFSpacing.xl) {
            ZStack {
                Circle()
                    .fill(colors.success.opacity(0.1))
                    .frame(width: 100, height: 100)
                
                Image(systemName: "checkmark.seal.fill")
                    .font(.system(size: 48))
                    .foregroundStyle(colors.success)
            }
            
            VStack(spacing: PFSpacing.sm) {
                Text("Ready to Flow")
                    .font(.title.weight(.bold))
                    .foregroundStyle(colors.textMain)
                
                Text("We've set up everything. Welcome to ProjectFlow!")
                    .font(.body)
                    .foregroundStyle(colors.textMuted)
                    .multilineTextAlignment(.center)
            }
        }
        .padding(.vertical, PFSpacing.xl)
    }

    private var footerActions: some View {
        VStack(spacing: PFSpacing.md) {
            if let error = error {
                Text(error)
                    .font(.caption)
                    .foregroundStyle(colors.error)
            }
            
            HStack(spacing: PFSpacing.md) {
                if currentStep != .profile && currentStep != .complete {
                    PFSecondaryButton(title: "Back") {
                        withAnimation {
                            if let prev = OnboardingStep(rawValue: currentStep.rawValue - 1) {
                                currentStep = prev
                            }
                        }
                    }
                }
                
                PFPrimaryButton(
                    title: currentStep == .workspace ? "Complete Setup" : (currentStep == .complete ? "Get Started" : "Continue"),
                    isLoading: isSubmitting
                ) {
                    handleContinue()
                }
                .disabled(!canContinue)
            }
        }
        .padding(PFSpacing.lg)
        .background(colors.surfaceCard)
    }

    private func handleContinue() {
        if currentStep == .workspace {
            finishOnboarding()
        } else if currentStep == .complete {
            // Dismiss or move to main app
            session.isLoading = false 
        } else {
            withAnimation {
                if let next = OnboardingStep(rawValue: currentStep.rawValue + 1) {
                    currentStep = next
                }
            }
        }
    }

    private func finishOnboarding() {
        guard let user = Auth.auth().currentUser else { return }
        isSubmitting = true
        error = nil
        
        _Concurrency.Task {
            do {
                // 1. Setup Profile
                try await repo.setupUserProfile(uid: user.uid, email: user.email ?? "", displayName: displayName)
                
                // 2. Create Tenant
                let tenantId = try await repo.createTenant(ownerId: user.uid, name: workspaceName, planTier: selectedPlan)
                
                // 3. Set as active tenant
                TenantResolver.setActiveTenantId(tenantId)
                AppSession.shared.setInitialTenantIfNeeded(tenantId)
                
                withAnimation {
                    currentStep = .complete
                }
            } catch {
                self.error = error.localizedDescription
            }
            isSubmitting = false
        }
    }

    private var stepTitle: String {
        switch currentStep {
        case .profile: return "Identity"
        case .plan: return "Selection"
        case .workspace: return "Workspace"
        case .complete: return "Finish"
        }
    }

    @ViewBuilder
    private func stepInfo(title: String, subtitle: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.title2.weight(.bold))
                .foregroundStyle(colors.textMain)
            Text(subtitle)
                .font(.subheadline)
                .foregroundStyle(colors.textMuted)
        }
    }

    private var canContinue: Bool {
        switch currentStep {
        case .profile: return !displayName.isEmpty
        case .plan: return !selectedPlan.isEmpty
        case .workspace: return !workspaceName.isEmpty
        case .complete: return true
        }
    }
}

private struct PlanCard: View {
    let title: String
    let price: String
    let description: String
    let features: [String]
    let isSelected: Bool
    let onSelect: () -> Void
    
    @Environment(\.colorScheme) private var colorScheme
    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        Button(action: onSelect) {
            VStack(alignment: .leading, spacing: PFSpacing.md) {
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(title)
                            .font(.headline)
                            .foregroundStyle(colors.textMain)
                        Text(price)
                            .font(.subheadline.weight(.bold))
                            .foregroundStyle(colors.primary)
                    }
                    Spacer()
                    if isSelected {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundStyle(colors.primary)
                    } else {
                        Circle()
                            .strokeBorder(colors.surfaceBorder, lineWidth: 2)
                            .frame(width: 24, height: 24)
                    }
                }
                
                Text(description)
                    .font(.caption)
                    .foregroundStyle(colors.textMuted)
                    .multilineTextAlignment(.leading)
                
                Divider()
                
                VStack(alignment: .leading, spacing: 4) {
                    ForEach(features, id: \.self) { feature in
                        HStack(spacing: 6) {
                            Image(systemName: "checkmark")
                                .font(.system(size: 10, weight: .bold))
                                .foregroundStyle(colors.success)
                            Text(feature)
                                .font(.caption2)
                                .foregroundStyle(colors.textSubtle)
                        }
                    }
                }
            }
            .padding(PFSpacing.md)
            .background(isSelected ? colors.primary.opacity(0.05) : colors.surfaceCard)
            .clipShape(RoundedRectangle(cornerRadius: PFRadius.md))
            .overlay(
                RoundedRectangle(cornerRadius: PFRadius.md)
                    .stroke(isSelected ? colors.primary : Color.clear, lineWidth: 2)
            )
        }
        .buttonStyle(.plain)
    }
}
