import AppIntents
import SwiftUI
import WidgetKit
import PFSnapshot

/// Control Center / Lock Screen / Action Button: "Erfassen" opens the app straight into the composer.
struct CaptureControl: ControlWidget {
    static let kind = "de.christophlabestin.projectflow.control.capture"

    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: Self.kind) {
            ControlWidgetButton(action: OpenCaptureIntent()) {
                Label("Erfassen", systemImage: "plus")
            }
        }
        .displayName("Erfassen")
        .description("Öffnet den Composer, um schnell etwas festzuhalten.")
    }
}

/// "Fokus ⏯": on = running, off = paused. Disabled without a focus.
struct FocusToggleControl: ControlWidget {
    static let kind = "de.christophlabestin.projectflow.control.focus"

    struct Provider: ControlValueProvider {
        struct Value: Sendable {
            var hasFocus: Bool
            var isRunning: Bool
            var title: String?
        }

        var previewValue: Value { Value(hasFocus: true, isRunning: true, title: nil) }

        func currentValue() async throws -> Value {
            guard let focus = SnapshotStore.load()?.focus else { return Value(hasFocus: false, isRunning: false, title: nil) }
            return Value(hasFocus: true, isRunning: focus.status == "active", title: focus.title)
        }
    }

    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: Self.kind, provider: Provider()) { value in
            ControlWidgetToggle(isOn: value.isRunning, action: FocusToggleIntent()) {
                Label("Fokus", systemImage: "scope")
            } valueLabel: { isOn in
                Label(value.hasFocus ? (isOn ? "Läuft" : "Pausiert") : "Kein Fokus", systemImage: isOn ? "pause.fill" : "play.fill")
            }
            .disabled(!value.hasFocus)
        }
        .displayName("Fokus")
        .description("Pausiert oder setzt deinen Fokus fort.")
    }
}
