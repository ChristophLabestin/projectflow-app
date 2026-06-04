import SwiftUI
import FirebaseAuth
import FirebaseFirestore

struct PinnedTasksSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var colorScheme
    @StateObject private var pinnedTasksStore = PinnedTasksStore()

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        NavigationStack {
            ZStack {
                colors.surfaceBg
                    .ignoresSafeArea()

                VStack(spacing: 0) {
                    if pinnedTasksStore.isLoading {
                        ProgressView()
                            .padding(.top, PFSpacing.xl)
                    } else if pinnedTasksStore.pinnedItems.isEmpty {
                        emptyState
                    } else {
                        List {
                            ForEach(pinnedTasksStore.pinnedItems) { item in
                                PinnedItemRow(
                                    item: item,
                                    isFocus: pinnedTasksStore.focusItemId == item.id,
                                    focusStatus: pinnedTasksStore.focusState?.status,
                                    onStartFocus: { pinnedTasksStore.startFocus(item: item) },
                                    onSnoozeFocus: { pinnedTasksStore.snoozeFocus() },
                                    onBlockFocus: { pinnedTasksStore.blockFocus() }
                                )
                                    .listRowBackground(colors.surfaceCard)
                                    .listRowSeparator(.hidden)
                                    .listRowInsets(EdgeInsets(top: PFSpacing.sm, leading: PFSpacing.md, bottom: PFSpacing.sm, trailing: PFSpacing.md))
                                    .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                                        Button(role: .destructive) {
                                            pinnedTasksStore.unpin(itemId: item.id)
                                        } label: {
                                            Label("Unpin", systemImage: "pin.slash")
                                        }
                                        .tint(colors.error)
                                    }
                                    .swipeActions(edge: .leading, allowsFullSwipe: false) {
                                        Button {
                                            pinnedTasksStore.startFocus(item: item)
                                        } label: {
                                            Label("Focus", systemImage: "scope")
                                        }
                                        .tint(colors.primary)
                                    }
                            }
                        }
                        .listStyle(.plain)
                        .scrollContentBackground(.hidden)
                    }
                }
            }
            .navigationTitle("Pinned Tasks")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                    .font(.body.weight(.semibold))
                    .foregroundStyle(colors.primary)
                }
            }
            .onAppear {
                pinnedTasksStore.start()
            }
            .onDisappear {
                pinnedTasksStore.stop()
            }
        }
    }

    private var emptyState: some View {
        VStack(spacing: PFSpacing.md) {
            Spacer()

            Image(systemName: "pin.slash")
                .font(.system(size: 48))
                .foregroundStyle(colors.textMuted.opacity(0.5))

            Text("No Pinned Tasks")
                .font(.title3.weight(.semibold))
                .foregroundStyle(colors.textMain)

            Text("Pin tasks or initiatives to access them quickly from here.")
                .font(.body)
                .foregroundStyle(colors.textMuted)
                .multilineTextAlignment(.center)
                .padding(.horizontal, PFSpacing.xl)

            Spacer()
        }
    }
}

private struct PinnedItemRow: View {
    @Environment(\.colorScheme) private var colorScheme
    let item: PinnedItem
    let isFocus: Bool
    let focusStatus: String?
    let onStartFocus: () -> Void
    let onSnoozeFocus: () -> Void
    let onBlockFocus: () -> Void

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        VStack(alignment: .leading, spacing: PFSpacing.sm) {
            HStack(spacing: PFSpacing.md) {
                Circle()
                    .fill(isFocus ? colors.primary.opacity(0.16) : colors.surfaceHover)
                    .frame(width: 36, height: 36)
                    .overlay(
                        Image(systemName: item.isCompleted == true ? "checkmark" : isFocus ? "scope" : "pin.fill")
                            .font(.subheadline)
                            .foregroundStyle(isFocus ? colors.primary : colors.textMuted)
                    )

                VStack(alignment: .leading, spacing: 2) {
                    Text(item.title)
                        .font(.body.weight(.medium))
                        .foregroundStyle(colors.textMain)
                        .lineLimit(1)

                    HStack(spacing: 6) {
                        Text(item.type.capitalized)
                            .font(.caption)
                            .foregroundStyle(colors.textMuted)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(colors.surfaceHover)
                            .clipShape(RoundedRectangle(cornerRadius: 4))

                        if let priority = item.priority, !priority.isEmpty {
                            Text(priority)
                                .font(.caption)
                                .foregroundStyle(colors.textSubtle)
                        }

                        if isFocus {
                            Text(focusStatusLabel)
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(focusStatus == "blocked" ? colors.error : colors.primary)
                        }
                    }
                }

                Spacer()
            }

            HStack(spacing: PFSpacing.xs) {
                Button(isFocus ? "Resume" : "Start Focus", action: onStartFocus)
                    .buttonStyle(.borderedProminent)
                    .controlSize(.small)

                if isFocus {
                    Button("Snooze", action: onSnoozeFocus)
                        .buttonStyle(.bordered)
                        .controlSize(.small)

                    Button("Block", action: onBlockFocus)
                        .buttonStyle(.bordered)
                        .controlSize(.small)
                        .tint(colors.error)
                }
            }
        }
        .padding(PFSpacing.md)
        .background(colors.surfaceCard)
        .clipShape(RoundedRectangle(cornerRadius: PFRadius.md))
        .shadow(color: colors.shadowSm, radius: 2, x: 0, y: 1)
    }

    private var focusStatusLabel: String {
        switch focusStatus {
        case "blocked":
            return "Blocked focus"
        case "snoozed":
            return "Snoozed focus"
        default:
            return "Current focus"
        }
    }
}
