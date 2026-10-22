import SwiftUI
import PFDesign

/// Multi-select list in a custom sheet (project and priority filters). Stays open while choosing.
struct WorkMultiSelectSheet: View {
    struct Option: Identifiable {
        let id: String
        let label: String
        let leading: AnyView

        init<Leading: View>(id: String, label: String, @ViewBuilder leading: () -> Leading) {
            self.id = id
            self.label = label
            self.leading = AnyView(leading())
        }
    }

    let title: String
    let emptyText: String
    let options: [Option]
    let isSelected: (String) -> Bool
    let toggle: (String) -> Void
    let clear: () -> Void

    @Environment(PFPresenter.self) private var presenter

    var body: some View {
        VStack(alignment: .leading, spacing: PFSpace.s) {
            HStack {
                PFEyebrow(title)
                Spacer()
                if options.contains(where: { isSelected($0.id) }) {
                    Button { PFHaptics.selection(); clear() } label: {
                        Text(L10n.t("work.filter.reset")).pfText(.metaStrong).foregroundStyle(PFColor.textMuted).frame(minHeight: 32)
                    }
                    .buttonStyle(.pfPressable)
                }
            }
            .padding(.horizontal, PFSpace.page)

            if options.isEmpty {
                Text(emptyText).pfText(.meta).foregroundStyle(PFColor.textMuted).padding(.horizontal, PFSpace.page)
            } else {
                ScrollView {
                    VStack(spacing: 0) {
                        ForEach(Array(options.enumerated()), id: \.element.id) { index, option in
                            if index > 0 { PFRowDivider() }
                            row(option)
                        }
                    }
                    .background(PFColor.raisedSoft, in: .rect(cornerRadius: PFRadius.card, style: .continuous))
                    .padding(.horizontal, PFSpace.m)
                }
                .frame(maxHeight: 420)
                .scrollIndicators(.hidden)
            }
            PFButton(L10n.t("common.done"), fullWidth: true) { presenter.dismiss() }
                .padding(.horizontal, PFSpace.page)
                .padding(.top, PFSpace.xs)
        }
        .padding(.bottom, PFSpace.l)
    }

    private func row(_ option: Option) -> some View {
        let selected = isSelected(option.id)
        return Button {
            PFHaptics.selection()
            withAnimation(PFMotion.respecting(PFMotion.fast)) { toggle(option.id) }
        } label: {
            HStack(spacing: PFSpace.s) {
                option.leading.frame(minWidth: 26)
                Text(option.label).pfText(.rowTitle).foregroundStyle(PFColor.textMain).lineLimit(1)
                Spacer()
                ZStack {
                    Circle().strokeBorder(selected ? PFColor.primary : PFColor.hairlineStrong, lineWidth: 2)
                    if selected {
                        Circle().fill(PFColor.primary)
                        Image(systemName: "checkmark").font(.system(size: 10, weight: .bold)).foregroundStyle(PFColor.onPrimary)
                    }
                }
                .frame(width: 22, height: 22)
            }
            .padding(.horizontal, PFSpace.m)
            .frame(minHeight: 52)
            .contentShape(.rect)
        }
        .buttonStyle(.pfPressable)
        .accessibilityAddTraits(selected ? [.isButton, .isSelected] : .isButton)
    }
}
