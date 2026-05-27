import SwiftUI

struct AppBackground: View {
    @Environment(\.colorScheme) private var colorScheme

    private var colors: PFColors { PFColors.palette(for: colorScheme) }
    private var dotColor: Color {
        colorScheme == .dark ? Color.white.opacity(0.035) : Color(hex: "#e5e7eb").opacity(0.7)
    }

    var body: some View {
        ZStack {
            colors.surfaceBg
                .ignoresSafeArea()

            DottedBackground(color: dotColor, spacing: 28, dotSize: 1)
                .ignoresSafeArea()
        }
    }
}

struct DottedBackground: View {
    let color: Color
    var spacing: CGFloat = 24
    var dotSize: CGFloat = 1.5

    var body: some View {
        Canvas { context, size in
            let columns = Int(size.width / spacing) + 1
            let rows = Int(size.height / spacing) + 1

            for row in 0...rows {
                for column in 0...columns {
                    let x = CGFloat(column) * spacing
                    let y = CGFloat(row) * spacing
                    let rect = CGRect(x: x, y: y, width: dotSize, height: dotSize)
                    context.fill(Path(ellipseIn: rect), with: .color(color))
                }
            }
        }
    }
}
