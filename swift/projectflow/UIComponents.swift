import SwiftUI

#if os(iOS)
import UIKit
typealias PFKeyboardType = UIKeyboardType
#else
enum PFKeyboardType {
    case `default`
    case emailAddress
    case numberPad
}
#endif

struct PFCard<Content: View>: View {
    @Environment(\.colorScheme) private var colorScheme
    private let content: Content

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        content
            .padding(PFSpacing.md)
            .background(colors.surfaceCard)
            .clipShape(RoundedRectangle(cornerRadius: PFRadius.lg, style: .continuous))
            .shadow(color: colors.shadowSm, radius: 2, x: 0, y: 1)
    }
}

struct PFSectionHeader: View {
    @Environment(\.colorScheme) private var colorScheme
    let title: String

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        Text(title)
            .font(.headline)
            .foregroundStyle(colors.textMain)
    }
}

struct PFPrimaryButton: View {
    @Environment(\.colorScheme) private var colorScheme
    let title: String
    let isLoading: Bool
    let action: () -> Void

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    init(title: String, isLoading: Bool = false, action: @escaping () -> Void) {
        self.title = title
        self.isLoading = isLoading
        self.action = action
    }

    var body: some View {
        Button(action: action) {
            HStack(spacing: PFSpacing.sm) {
                if isLoading {
                    ProgressView()
                        .progressViewStyle(.circular)
                        .tint(colors.primaryText)
                }

                Text(title)
                    .font(.headline)
                    .foregroundStyle(colors.primaryText)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, PFSpacing.sm)
        }
        .background(colors.primary)
        .clipShape(RoundedRectangle(cornerRadius: PFRadius.md, style: .continuous))
    }
}

struct PFSecondaryButton: View {
    @Environment(\.colorScheme) private var colorScheme
    let title: String
    let action: () -> Void

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.headline)
                .foregroundStyle(colors.textMain)
                .frame(maxWidth: .infinity)
                .padding(.vertical, PFSpacing.sm)
        }
        .background(colors.surfaceCard)
        .clipShape(RoundedRectangle(cornerRadius: PFRadius.md, style: .continuous))
    }
}

struct PFInputField: View {
    @Environment(\.colorScheme) private var colorScheme
    let title: String
    let placeholder: String
    @Binding var text: String
    let isSecure: Bool
    let keyboardType: PFKeyboardType
    let error: String?

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    init(
        title: String,
        placeholder: String,
        text: Binding<String>,
        isSecure: Bool,
        keyboardType: PFKeyboardType,
        error: String? = nil
    ) {
        self.title = title
        self.placeholder = placeholder
        self._text = text
        self.isSecure = isSecure
        self.keyboardType = keyboardType
        self.error = error
    }

    var body: some View {
        VStack(alignment: .leading, spacing: PFSpacing.xs) {
            Text(title)
                .font(.caption)
                .foregroundStyle(colors.textMuted)

            Group {
                if isSecure {
                    SecureField(placeholder, text: $text)
                } else {
                    TextField(placeholder, text: $text)
#if os(iOS)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
#endif
                }
            }
#if os(iOS)
            .keyboardType(keyboardType)
#endif
            .padding(PFSpacing.sm)
            .background(colors.surfacePaper)
            .clipShape(RoundedRectangle(cornerRadius: PFRadius.md, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: PFRadius.md, style: .continuous)
                    .stroke(error == nil ? colors.surfaceBorder : colors.error, lineWidth: 1)
            )

            if let error {
                Text(error)
                    .font(.caption)
                    .foregroundStyle(colors.error)
            }
        }
    }
}
