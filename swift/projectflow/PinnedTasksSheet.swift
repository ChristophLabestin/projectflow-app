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
                                PinnedItemRow(item: item)
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
            
            Text("Pin tasks or issues to access them quickly from here.")
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
    
    private var colors: PFColors { PFColors.palette(for: colorScheme) }
    
    var body: some View {
        HStack(spacing: PFSpacing.md) {
            Circle()
                .fill(colors.surfaceHover)
                .frame(width: 36, height: 36)
                .overlay(
                    Image(systemName: item.isCompleted == true ? "checkmark" : "pin.fill")
                        .font(.subheadline)
                        .foregroundStyle(colors.textMuted)
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
                }
            }
            
            Spacer()
        }
        .padding(PFSpacing.md)
        .background(colors.surfaceCard)
        .clipShape(RoundedRectangle(cornerRadius: PFRadius.md))
        .shadow(color: colors.shadowSm, radius: 2, x: 0, y: 1)
    }
}
