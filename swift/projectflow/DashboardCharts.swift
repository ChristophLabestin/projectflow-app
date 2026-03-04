import SwiftUI

struct DonutChart: View {
    @Environment(\.colorScheme) private var colorScheme
    let data: [(label: String, value: Int, color: Color)]
    var total: Int { data.reduce(0) { $0 + $1.value } }
    var innerRadiusRatio: CGFloat = 0.62

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        GeometryReader { geo in
            let size = min(geo.size.width, geo.size.height)
            let innerSize = size * innerRadiusRatio

            ZStack {
                if total == 0 {
                    Circle()
                        .fill(colors.surfaceHover)
                } else {
                    ForEach(data.indices, id: \.self) { index in
                        DonutSegment(
                            startAngle: startAngle(for: index),
                            endAngle: endAngle(for: index),
                            innerRadiusRatio: innerRadiusRatio
                        )
                        .fill(data[index].color)
                    }
                }

                Circle()
                    .fill(colors.surfaceBg)
                    .frame(width: innerSize, height: innerSize)

                VStack(spacing: 2) {
                    Text("\(total)")
                        .font(.title2.weight(.bold))
                        .foregroundStyle(colors.textMain)
                    Text("Total")
                        .font(.caption)
                        .foregroundStyle(colors.textSubtle)
                }
            }
            .frame(width: geo.size.width, height: geo.size.height)
        }
        .aspectRatio(1, contentMode: .fit)
    }

    private func startAngle(for index: Int) -> Angle {
        guard total > 0 else { return .degrees(-90) }
        let prefixSum = data.prefix(index).reduce(0) { $0 + $1.value }
        let value = Double(prefixSum) / Double(total) * 360
        return .degrees(value - 90)
    }

    private func endAngle(for index: Int) -> Angle {
        guard total > 0 else { return .degrees(-90) }
        let prefixSum = data.prefix(index + 1).reduce(0) { $0 + $1.value }
        let value = Double(prefixSum) / Double(total) * 360
        return .degrees(value - 90)
    }
}

private struct DonutSegment: Shape {
    let startAngle: Angle
    let endAngle: Angle
    let innerRadiusRatio: CGFloat

    func path(in rect: CGRect) -> Path {
        let radius = min(rect.width, rect.height) / 2
        let innerRadius = radius * innerRadiusRatio
        let center = CGPoint(x: rect.midX, y: rect.midY)

        var path = Path()
        path.addArc(center: center, radius: radius, startAngle: startAngle, endAngle: endAngle, clockwise: false)
        path.addArc(center: center, radius: innerRadius, startAngle: endAngle, endAngle: startAngle, clockwise: true)
        path.closeSubpath()
        return path
    }
}

struct ChartLegend: View {
    let data: [(label: String, value: Int, color: Color)]
    let columns = [GridItem(.adaptive(minimum: 100))]
    
    var body: some View {
        LazyVGrid(columns: columns, alignment: .leading, spacing: 12) {
            ForEach(data.indices, id: \.self) { index in
                HStack(spacing: 6) {
                    Circle()
                        .fill(data[index].color)
                        .frame(width: 8, height: 8)
                    
                    Text("\(data[index].label) (\(data[index].value))")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
        }
    }
}

import Charts

struct TrendChart: View {
    @Environment(\.colorScheme) private var colorScheme
    let values: [Int] // 0-100 scores
    let color: Color
    
    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        Group {
            if values.isEmpty {
                VStack {
                    Spacer()
                    Text("No trend data")
                        .font(.caption2)
                        .foregroundStyle(colors.textSubtle)
                    Spacer()
                }
                .frame(maxWidth: .infinity)
            } else {
                Chart {
                    ForEach(Array(values.enumerated()), id: \.offset) { index, value in
                        AreaMark(
                            x: .value("Index", index),
                            y: .value("Score", value)
                        )
                        .foregroundStyle(
                            LinearGradient(
                                colors: [color.opacity(0.3), color.opacity(0.0)],
                                startPoint: .top,
                                endPoint: .bottom
                            )
                        )
                        .interpolationMethod(.catmullRom)
                        
                        LineMark(
                            x: .value("Index", index),
                            y: .value("Score", value)
                        )
                        .foregroundStyle(color)
                        .lineStyle(StrokeStyle(lineWidth: 2))
                        .interpolationMethod(.catmullRom)
                    }
                }
                .chartXAxis(.hidden)
                .chartYAxis(.hidden)
                .chartYScale(domain: 0...100)
            }
        }
    }
}

// LineShape and AreaShape removed as they are replaced by Charts framework
