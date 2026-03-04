import SwiftUI
import PhotosUI

struct SnapToFlowView: View {
    let tenantId: String
    let projectId: String
    let permissions: PermissionContext
    
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var colorScheme
    @StateObject private var flowsStore = FlowsStore()
    @State private var selectedItem: PhotosPickerItem?
    @State private var selectedImage: UIImage?
    @State private var isAnalyzing = false
    @State private var analysisResult: String?
    
    // Form fields pre-filled by AI
    @State private var title: String = ""
    @State private var description: String = ""
    
    private var colors: PFColors { PFColors.palette(for: colorScheme) }
    private let geminiService = GeminiService.shared

    var body: some View {
        NavigationStack {
            ZStack {
                AppBackground()
                
                VStack(spacing: PFSpacing.lg) {
                    // Image Preview / Placeholder
                    ZStack {
                        RoundedRectangle(cornerRadius: PFRadius.xl)
                            .fill(colors.surfaceCard)
                            .strokeBorder(colors.surfaceBorder, style: StrokeStyle(lineWidth: 2, dash: [10]))
                            .frame(height: 240)
                        
                        if let image = selectedImage {
                            Image(uiImage: image)
                                .resizable()
                                .scaledToFill()
                                .frame(height: 240)
                                .clipShape(RoundedRectangle(cornerRadius: PFRadius.xl))
                        } else {
                            VStack(spacing: PFSpacing.sm) {
                                Image(systemName: "camera.viewfinder")
                                    .font(.system(size: 48))
                                    .foregroundStyle(colors.primary)
                                Text("Tap to capture whiteboard")
                                    .font(.subheadline)
                                    .foregroundStyle(colors.textMuted)
                            }
                        }
                    }
                    .onTapGesture {
                        // In a real device, might trigger camera
                    }
                    .overlay(alignment: .bottomTrailing) {
                        PhotosPicker(selection: $selectedItem, matching: .images) {
                            Circle()
                                .fill(colors.primary)
                                .frame(width: 48, height: 48)
                                .overlay(Image(systemName: "photo.fill").foregroundStyle(.white))
                                .shadow(radius: 4)
                        }
                        .padding()
                    }
                    
                    if isAnalyzing {
                        VStack(spacing: PFSpacing.md) {
                            ProgressView()
                                .scaleEffect(1.5)
                            Text("Gemini is analyzing your sketch...")
                                .font(.subheadline)
                                .foregroundStyle(colors.textMuted)
                        }
                        .frame(maxHeight: .infinity)
                    } else if let _ = analysisResult {
                        // Result Form
                        ScrollView {
                            VStack(alignment: .leading, spacing: PFSpacing.md) {
                                Text("AI Analysis Result")
                                    .font(.headline)
                                    .foregroundStyle(colors.success)
                                
                                PFInputField(
                                    title: "Suggested Title",
                                    placeholder: "Flow title",
                                    text: $title,
                                    isSecure: false,
                                    keyboardType: .default
                                )
                                
                                VStack(alignment: .leading, spacing: 4) {
                                    Text("Description")
                                        .font(.caption)
                                        .foregroundStyle(colors.textMuted)
                                    TextEditor(text: $description)
                                        .frame(minHeight: 120)
                                        .padding(8)
                                        .background(colors.surfacePaper)
                                        .cornerRadius(8)
                                }
                                
                                PFPrimaryButton(title: "Create Flow") {
                                    _Concurrency.Task {
                                        await flowsStore.createFlow(
                                            tenantId: tenantId,
                                            projectId: projectId,
                                            title: title,
                                            description: description,
                                            type: "Feature",
                                            stage: "Brainstorm",
                                            permissions: permissions
                                        )
                                        dismiss()
                                    }
                                }
                            }
                            .padding()
                            .background(colors.surfaceCard)
                            .cornerRadius(16)
                        }
                    } else {
                        Spacer()
                        Text("Snap a photo of your whiteboard or notebook.\nGemini will convert it into a Flow.")
                            .multilineTextAlignment(.center)
                            .font(.body)
                            .foregroundStyle(colors.textSubtle)
                            .padding()
                        Spacer()
                    }
                }
                .padding()
            }
            .navigationTitle("Snap-to-Flow")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
            .onChange(of: selectedItem) { _, newItem in
                _Concurrency.Task {
                    if let data = try? await newItem?.loadTransferable(type: Data.self),
                       let image = UIImage(data: data) {
                        selectedImage = image
                        analyzeImage(data: data)
                    }
                }
            }
        }
    }
    
    private func analyzeImage(data: Data) {
        isAnalyzing = true
        let base64 = data.base64EncodedString()
        
        _Concurrency.Task {
            do {
                let prompt = "Analyze this whiteboard sketch or notebook page. Extract the main idea and provide a concise title and a structured description for a project flow. Return ONLY JSON with keys 'title' and 'description'."
                let result = try await geminiService.callGemini(prompt: prompt, image: base64, jsonMode: true)
                
                if let jsonData = result.text.data(using: .utf8),
                   let json = try? JSONSerialization.jsonObject(with: jsonData) as? [String: String] {
                    title = json["title"] ?? "New AI Flow"
                    description = json["description"] ?? ""
                    analysisResult = "Success"
                }
            } catch {
                print("Image analysis failed: \(error)")
                analysisResult = "Failed"
            }
            isAnalyzing = false
        }
    }
}
