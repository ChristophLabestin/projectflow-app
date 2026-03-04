import SwiftUI

struct FlowDetailView: View {
    let flow: Flow
    let tenantId: String
    let permissions: PermissionContext
    
    @StateObject private var flowsStore = FlowsStore()
    @State private var isGeneratingKeywords = false
    @State private var isGeneratingSWOT = false
    @State private var isGeneratingConcept = false
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.dismiss) private var dismiss
    
    private var colors: PFColors { PFColors.palette(for: colorScheme) }
    private let geminiService = GeminiService.shared

    var body: some View {
        ZStack {
            AppBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: PFSpacing.lg) {
                    header
                    description
                    
                    if flow.stage == "Brainstorm" {
                        brainstormingTools
                    } else if flow.stage == "Refining" {
                        refinementTools
                    } else if flow.stage == "Concept" {
                        conceptTools
                    } else {
                        pipeline
                    }
                    
                    if flow.stage == "Approved" {
                        PFPrimaryButton(title: "Convert to Task") {
                            _Concurrency.Task {
                                do {
                                    _ = try await flowsStore.convertToTask(
                                        tenantId: tenantId,
                                        projectId: flow.projectId ?? "",
                                        flow: flow,
                                        permissions: permissions
                                    )
                                    dismiss()
                                } catch {
                                    print("Conversion failed: \(error)")
                                }
                            }
                        }
                        .padding(.top, PFSpacing.md)
                    } else if flow.stage != "Archived" && flow.stage != "Implemented" {
                        advanceButton
                    }
                }
                .padding(PFSpacing.lg)
            }
        }
        .navigationTitle("Flow Details")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: PFSpacing.sm) {
            HStack {
                HStack(spacing: 4) {
                    Image(systemName: icon(for: flow.type))
                    Text(FlowLocalization.type(flow.type).uppercased())
                }
                .font(.caption.weight(.bold))
                .foregroundStyle(colors.primary)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(colors.primary.opacity(0.1))
                .cornerRadius(4)
                
                Spacer()
                
                Text(FlowLocalization.stage(flow.stage))
                    .font(.caption.weight(.bold))
                    .foregroundStyle(colors.textMain)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(colors.surfaceHover)
                    .clipShape(Capsule())
            }
            
            Text(flow.title)
                .font(.title2.weight(.bold))
                .foregroundStyle(colors.textMain)
        }
    }

    private var description: some View {
        VStack(alignment: .leading, spacing: PFSpacing.xs) {
            Text("Strategy")
                .font(.headline)
                .foregroundStyle(colors.textMain)
            
            Text(flow.description.isEmpty ? "No strategy or description provided." : flow.description)
                .font(.body)
                .foregroundStyle(colors.textSubtle)
        }
    }

    private var brainstormingTools: some View {
        VStack(alignment: .leading, spacing: PFSpacing.md) {
            Text("Brainstorming")
                .font(.headline)
                .foregroundStyle(colors.textMain)
            
            PFCard {
                VStack(alignment: .leading, spacing: PFSpacing.md) {
                    Text("Keywords")
                        .font(.subheadline.weight(.semibold))
                    
                    if #available(iOS 16.0, *) {
                        FlowLayout(spacing: 8) {
                            ForEach(flow.keywords, id: \.self) { keyword in
                                Text(keyword)
                                    .font(.caption)
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 4)
                                    .background(colors.primary.opacity(0.1))
                                    .foregroundStyle(colors.primary)
                                    .cornerRadius(4)
                            }
                        }
                    } else {
                        Text(flow.keywords.joined(separator: ", "))
                            .font(.caption)
                            .foregroundStyle(colors.textSubtle)
                    }
                    
                    PFSecondaryButton(title: isGeneratingKeywords ? "Generating..." : "CORA Suggest Keywords") {
                        suggestKeywords()
                    }
                    .disabled(isGeneratingKeywords)
                }
                .padding(PFSpacing.md)
            }
        }
    }

    private var refinementTools: some View {
        VStack(alignment: .leading, spacing: PFSpacing.md) {
            Text("Strategic Refinement")
                .font(.headline)
                .foregroundStyle(colors.textMain)
            
            PFCard {
                VStack(alignment: .leading, spacing: PFSpacing.md) {
                    HStack {
                        VStack(alignment: .leading) {
                            Text("Impact")
                                .font(.caption.weight(.bold))
                                .foregroundStyle(colors.textMuted)
                            Text(flow.impact ?? "Not Set")
                                .font(.subheadline)
                        }
                        Spacer()
                        VStack(alignment: .trailing) {
                            Text("Effort")
                                .font(.caption.weight(.bold))
                                .foregroundStyle(colors.textMuted)
                            Text(flow.effort ?? "Not Set")
                                .font(.subheadline)
                        }
                    }
                    
                    Divider()
                    
                    Text("SWOT Analysis")
                        .font(.subheadline.weight(.semibold))
                    
                    VStack(alignment: .leading, spacing: 8) {
                        swotRow(title: "Strengths", items: flow.strengths, color: .green)
                        swotRow(title: "Weaknesses", items: flow.weaknesses, color: .red)
                    }
                    
                    PFSecondaryButton(title: isGeneratingSWOT ? "Analyzing..." : "Generate Analysis with CORA") {
                        generateSWOT()
                    }
                    .disabled(isGeneratingSWOT)
                }
                .padding(PFSpacing.md)
            }
        }
    }

    private var conceptTools: some View {
        VStack(alignment: .leading, spacing: PFSpacing.md) {
            Text("Concept Brief")
                .font(.headline)
                .foregroundStyle(colors.textMain)
            
            PFCard {
                VStack(alignment: .leading, spacing: PFSpacing.md) {
                    if let concept = flow.concept, !concept.isEmpty {
                        Text(concept)
                            .font(.body)
                            .foregroundStyle(colors.textSubtle)
                    } else {
                        Text("No concept drafted yet. Use CORA to generate a starting point.")
                            .font(.caption)
                            .foregroundStyle(colors.textMuted)
                            .italic()
                    }
                    
                    PFPrimaryButton(title: isGeneratingConcept ? "Drafting..." : (flow.concept == nil ? "Draft with CORA" : "Refine with CORA")) {
                        draftConcept()
                    }
                    .disabled(isGeneratingConcept)
                }
                .padding(PFSpacing.md)
            }
        }
    }

    private var advanceButton: some View {
        PFSecondaryButton(title: "Advance to \(FlowLocalization.stage(nextStage))") {
            _Concurrency.Task {
                await flowsStore.updateFlow(
                    tenantId: tenantId,
                    projectId: flow.projectId ?? "",
                    flowId: flow.id,
                    stage: nextStage,
                    permissions: permissions
                )
            }
        }
    }

    private var nextStage: String {
        switch flow.stage {
        case "Brainstorm": return "Refining"
        case "Refining": return "Concept"
        case "Concept": return "Review"
        case "Review": return "Approved"
        default: return "Archived"
        }
    }

    private func swotRow(title: String, items: [String], color: Color) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.caption.weight(.bold))
                .foregroundStyle(color)
            if items.isEmpty {
                Text("No items").font(.caption).foregroundStyle(colors.textMuted)
            } else {
                ForEach(items, id: \.self) { item in
                    Text("• \(item)").font(.caption).foregroundStyle(colors.textSubtle)
                }
            }
        }
    }

    private var pipeline: some View {
        VStack(alignment: .leading, spacing: PFSpacing.md) {
            Text("Pipeline Status")
                .font(.headline)
                .foregroundStyle(colors.textMain)
            
            PFCard {
                VStack(alignment: .leading, spacing: PFSpacing.sm) {
                    Text("Current Stage: \(FlowLocalization.stage(flow.stage))")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(colors.textMain)
                    
                    Text("Status and stage-specific tools will be available here soon.")
                        .font(.caption)
                        .foregroundStyle(colors.textMuted)
                }
                .padding(PFSpacing.md)
            }
        }
    }

    private func suggestKeywords() {
        isGeneratingKeywords = true
        _Concurrency.Task {
            do {
                let prompt = "Suggest 5-8 short keywords for a ProjectFlow '\(flow.type)' flow titled '\(flow.title)'. Description: \(flow.description). Return ONLY a comma-separated list."
                let result = try await geminiService.callGemini(prompt: prompt)
                let newKeywords = result.text.components(separatedBy: ",").map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
                
                await flowsStore.updateFlow(
                    tenantId: tenantId,
                    projectId: flow.projectId ?? "",
                    flowId: flow.id,
                    keywords: Array(Set(flow.keywords + newKeywords)),
                    permissions: permissions
                )
            } catch {
                print("Keyword generation failed: \(error)")
            }
            isGeneratingKeywords = false
        }
    }

    private func generateSWOT() {
        isGeneratingSWOT = true
        _Concurrency.Task {
            do {
                let prompt = "Perform a SWOT analysis for a '\(flow.type)' flow titled '\(flow.title)'. Description: \(flow.description). Return a JSON object with keys 'strengths', 'weaknesses', 'opportunities', 'threats' as string arrays."
                let result = try await geminiService.callGemini(prompt: prompt, jsonMode: true)
                
                if let data = result.text.data(using: .utf8),
                   let json = try? JSONSerialization.jsonObject(with: data) as? [String: [String]] {
                    await flowsStore.updateFlow(
                        tenantId: tenantId,
                        projectId: flow.projectId ?? "",
                        flowId: flow.id,
                        strengths: json["strengths"],
                        weaknesses: json["weaknesses"],
                        opportunities: json["opportunities"],
                        threats: json["threats"],
                        permissions: permissions
                    )
                }
            } catch {
                print("SWOT generation failed: \(error)")
            }
            isGeneratingSWOT = false
        }
    }

    private func draftConcept() {
        isGeneratingConcept = true
        _Concurrency.Task {
            do {
                let prompt = "Draft a product concept document for '\(flow.title)' (\(flow.type)). Keywords: \(flow.keywords.joined(separator: ", ")). Description: \(flow.description). Use Markdown. Focus on 'Why', 'What', and 'Success Metrics'."
                let result = try await geminiService.callGemini(prompt: prompt)
                
                await flowsStore.updateFlow(
                    tenantId: tenantId,
                    projectId: flow.projectId ?? "",
                    flowId: flow.id,
                    concept: result.text,
                    permissions: permissions
                )
            } catch {
                print("Concept drafting failed: \(error)")
            }
            isGeneratingConcept = false
        }
    }

    private func icon(for type: String) -> String {
        switch type {
        case "Feature": return "hammer"
        case "Product": return "cube"
        case "Optimization": return "bolt"
        case "Marketing": return "megaphone"
        case "Moonshot": return "rocket"
        default: return "sparkles"
        }
    }
}