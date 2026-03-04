import SwiftUI
import FirebaseFirestore

struct ProjectReportView: View {
    let report: GeminiReport?
    let isGenerating: Bool
    let onGenerate: () -> Void
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var colorScheme
    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        NavigationStack {
            ZStack {
                AppBackground()
                
                ScrollView {
                    VStack(alignment: .leading, spacing: PFSpacing.lg) {
                        if isGenerating {
                            VStack(spacing: PFSpacing.md) {
                                ProgressView()
                                Text("Generating comprehensive analysis...")
                                    .font(.subheadline)
                                    .foregroundStyle(colors.textMuted)
                            }
                            .frame(maxWidth: .infinity, minHeight: 300)
                        } else if let report = report {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Generated on \(report.createdAt?.dateValue().formatted() ?? "Unknown date")")
                                    .font(.caption)
                                    .foregroundStyle(colors.textMuted)
                                
                                Divider()
                                
                                // Simple Markdown support via LocalizedStringKey
                                // Note: For complex markdown, a specialized renderer would be better.
                                Text(LocalizedStringKey(report.content))
                                    .font(.body)
                                    .foregroundStyle(colors.textMain)
                            }
                        } else {
                            VStack(spacing: PFSpacing.md) {
                                Image(systemName: "sparkles")
                                    .font(.system(size: 48))
                                    .foregroundStyle(.purple)
                                
                                Text("Generate Project Report")
                                    .font(.title3.weight(.bold))
                                    .foregroundStyle(colors.textMain)
                                
                                Text("Create a comprehensive status report analyzing tasks, milestones, issues, and team activity to get tailored recommendations.")
                                    .font(.subheadline)
                                    .foregroundStyle(colors.textMuted)
                                    .multilineTextAlignment(.center)
                                    .padding(.horizontal, PFSpacing.xl)
                                
                                Button(action: onGenerate) {
                                    Text("Generate Analysis")
                                        .font(.headline)
                                        .foregroundStyle(.white)
                                        .padding()
                                        .background(colors.primary)
                                        .cornerRadius(PFRadius.md)
                                }
                            }
                            .frame(maxWidth: .infinity, minHeight: 300)
                        }
                    }
                    .padding(PFSpacing.lg)
                }
            }
            .navigationTitle("Project Intelligence Report")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                }
                
                if let report = report, !isGenerating {
                    ToolbarItem(placement: .confirmationAction) {
                        Button(action: {
                            UIPasteboard.general.string = report.content
                        }) {
                            Label("Copy", systemImage: "doc.on.doc")
                        }
                    }
                    
                    ToolbarItem(placement: .primaryAction) {
                        Button(action: onGenerate) {
                            Text("Regenerate")
                        }
                    }
                }
            }
        }
    }
}
