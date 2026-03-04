import SwiftUI

struct GroupCreatorView: View {
    let tenantId: String
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var colorScheme
    @StateObject private var groupStore = GroupStore()
    
    @State private var name = ""
    @State private var description = ""
    @State private var selectedColor = "#4F46E5"
    @State private var isSaving = false
    
    private var colors: PFColors { PFColors.palette(for: colorScheme) }
    private let presetColors = ["#4F46E5", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#6B7280"]

    var body: some View {
        NavigationStack {
            ZStack {
                AppBackground()
                
                ScrollView {
                    VStack(alignment: .leading, spacing: PFSpacing.lg) {
                        PFInputField(
                            title: "Group Name",
                            placeholder: "e.g. Engineering",
                            text: $name,
                            isSecure: false,
                            keyboardType: .default
                        )
                        
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Description")
                                .font(.subheadline.weight(.medium))
                                .foregroundStyle(colors.textMain)
                            TextEditor(text: $description)
                                .frame(height: 100)
                                .padding(8)
                                .background(colors.surfaceCard)
                                .cornerRadius(PFRadius.md)
                                .overlay(RoundedRectangle(cornerRadius: PFRadius.md).stroke(colors.surfaceBorder, lineWidth: 1))
                        }
                        
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Color")
                                .font(.subheadline.weight(.medium))
                                .foregroundStyle(colors.textMain)
                            
                            HStack(spacing: 12) {
                                ForEach(presetColors, id: \.self) { hex in
                                    Circle()
                                        .fill(Color(hex: hex))
                                        .frame(width: 32, height: 32)
                                        .overlay(
                                            Circle()
                                                .stroke(colors.textMain, lineWidth: selectedColor == hex ? 2 : 0)
                                        )
                                        .onTapGesture {
                                            selectedColor = hex
                                        }
                                }
                            }
                        }
                        
                        if let error = groupStore.errorMessage {
                            Text(error)
                                .font(.caption)
                                .foregroundStyle(colors.error)
                        }
                        
                        PFPrimaryButton(title: isSaving ? "Creating..." : "Create Group", isLoading: isSaving) {
                            createGroup()
                        }
                        .disabled(name.isEmpty)
                    }
                    .padding(PFSpacing.lg)
                }
            }
            .navigationTitle("New Group")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }
    
    private func createGroup() {
        isSaving = true
        _Concurrency.Task {
            await groupStore.createGroup(
                tenantId: tenantId,
                name: name,
                description: description,
                color: selectedColor
            )
            if groupStore.errorMessage == nil {
                dismiss()
            }
            isSaving = false
        }
    }
}
