import SwiftUI

struct HealthDetailPopover: View {
    let health: ProjectHealthSnapshot
    let history: [ProjectHealthSnapshotEntry]
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.dismiss) private var dismiss
    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    private var delta: Int? {
        guard history.count >= 2 else { return nil }
        let latest = history[history.count - 1].score
        let prior = history[history.count - 2].score
        return latest - prior
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: PFSpacing.lg) {
                    HStack(alignment: .firstTextBaseline) {
                        Text("\(Int(health.score))")
                            .font(.system(size: 44, weight: .bold))
                        Text("/ 100")
                            .font(.title3)
                            .foregroundStyle(colors.textMuted)
                        Spacer()
                        Text(health.status.label.capitalized)
                            .font(.caption.weight(.semibold))
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(colors.primaryFade)
                            .clipShape(Capsule())
                    }

                    if let delta {
                        Label {
                            Text(String(format: L10n.tr("health.delta", fallback: "Change vs prior"), delta))
                        } icon: {
                            Image(systemName: delta >= 0 ? "arrow.up.right" : "arrow.down.right")
                        }
                        .font(.subheadline)
                        .foregroundStyle(delta >= 0 ? colors.success : colors.error)
                    }

                    if history.count > 1 {
                        VStack(alignment: .leading, spacing: PFSpacing.sm) {
                            Text(L10n.tr("health.history", fallback: "Health History"))
                                .font(.headline)
                            HealthHistoryChart(entries: history)
                                .frame(height: 120)
                        }
                    } else {
                        Text(L10n.tr("health.noHistory", fallback: "No history yet."))
                            .font(.subheadline)
                            .foregroundStyle(colors.textMuted)
                    }

                    if !health.factors.isEmpty {
                        VStack(alignment: .leading, spacing: PFSpacing.sm) {
                            Text(L10n.tr("health.factors", fallback: "Contributing factors"))
                                .font(.headline)
                            ForEach(Array(health.factors.enumerated()), id: \.offset) { _, factor in
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(HealthLocalization.label(for: factor, locale: L10n.locale))
                                        .font(.subheadline.weight(.semibold))
                                    Text(HealthLocalization.description(for: factor, locale: L10n.locale))
                                        .font(.caption)
                                        .foregroundStyle(colors.textMuted)
                                }
                                .padding(.vertical, 4)
                            }
                        }
                    }

                    let recs = HealthLocalization.recommendations(
                        keys: health.recommendationKeys,
                        fallbacks: health.recommendations,
                        locale: L10n.locale
                    )
                    if !recs.isEmpty {
                        VStack(alignment: .leading, spacing: PFSpacing.sm) {
                            Text(L10n.tr("health.recommendations", fallback: "Recommendations"))
                                .font(.headline)
                            ForEach(recs, id: \.self) { rec in
                                Label(rec, systemImage: "lightbulb")
                                    .font(.caption)
                            }
                        }
                    }
                }
                .padding(PFSpacing.md)
            }
            .background(AppBackground())
            .navigationTitle(L10n.tr("health.title", fallback: "Project Health"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}

struct HealthHistoryChart: View {
    let entries: [ProjectHealthSnapshotEntry]
    @Environment(\.colorScheme) private var colorScheme
    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        GeometryReader { geo in
            let scores = entries.map { Double($0.score) }
            let maxScore = max(scores.max() ?? 100, 1)
            let minScore = min(scores.min() ?? 0, maxScore - 1)
            let range = max(maxScore - minScore, 1)
            let stepX = scores.count > 1 ? geo.size.width / CGFloat(scores.count - 1) : geo.size.width

            ZStack(alignment: .bottomLeading) {
                RoundedRectangle(cornerRadius: PFRadius.md)
                    .fill(colors.surfacePaper)

                Path { path in
                    for (index, score) in scores.enumerated() {
                        let x = CGFloat(index) * stepX
                        let y = geo.size.height - CGFloat((score - minScore) / range) * (geo.size.height - 8) - 4
                        if index == 0 {
                            path.move(to: CGPoint(x: x, y: y))
                        } else {
                            path.addLine(to: CGPoint(x: x, y: y))
                        }
                    }
                }
                .stroke(colors.primary, style: StrokeStyle(lineWidth: 2, lineJoin: .round))

                ForEach(Array(scores.enumerated()), id: \.offset) { index, score in
                    let x = CGFloat(index) * stepX
                    let y = geo.size.height - CGFloat((score - minScore) / range) * (geo.size.height - 8) - 4
                    Circle()
                        .fill(colors.primary)
                        .frame(width: 6, height: 6)
                        .position(x: x, y: y)
                }
            }
        }
    }
}
