import SwiftUI
import PFData
import PFDesign

extension AppModel {
    /// In-app AI is shown for this workspace (policy `inAppAi`, not for guests). The server still decides per request
    /// (billing): refusals come back as plan codes and show a hint.
    var showsInAppAi: Bool { aiInAppEnabled && (session?.role ?? .member) != .guest }

    /// Text for an AI error code: plan codes reuse the neutral plan texts, everything else a short notice.
    func aiMessage(code: String) -> String {
        if code == "credits-exhausted" || code == "resource-exhausted" || code == "disabled" || code == "forbidden" || code == "suspended" {
            return L10n.t("ai.error.\(code)")
        }
        if PlanErrorCode.all.contains(code) { return L10n.t("planError.\(code)") }
        return L10n.t("ai.error.generic")
    }

    static func aiIsPlanHint(_ code: String) -> Bool { AiErrorCode.planCodes.contains(code) || code == "credits-exhausted" }
}

/// The small "✦" control: secondary, no gradient or glow (contract "Stil").
struct AiSparkButton: View {
    var size: CGFloat = 44
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text("✦").font(.system(size: size * 0.38, weight: .semibold)).foregroundStyle(PFColor.textMuted)
                .frame(width: size, height: size)
                .pfGlass(in: Circle())
        }
        .buttonStyle(.pfPressable)
        .accessibilityLabel(L10n.t("ai.open"))
    }
}

#if DEBUG
/// QA without an OpenAI key (`-pfAiFake`): scripted `aiAssist` events with the same shapes as the server.
enum AiFake {
    static func install() {
        guard ProcessInfo.processInfo.arguments.contains("-pfAiFake") else { return }
        AiAssist.fake = { body in
            let de = (body["language"] as? String) != "en"
            if body["capability"] as? String == "write" {
                let input = body["input"] as? [String: Any] ?? [:]
                let text = (input["text"] as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
                let action = input["action"] as? String ?? "rephrase"
                let result: String
                switch action {
                case "draft": result = de ? "Ziel: alte URLs per 301 auf die neuen Seiten leiten.\n\nSchritte: Liste der alten URLs exportieren, Ziele zuordnen, Regeln in der CDN-Konfiguration anlegen und mit einem Crawl prüfen."
                    : "Goal: send old URLs to the new pages with 301s.\n\nSteps: export the old URLs, map targets, add rules to the CDN config and verify with a crawl."
                case "shorten": result = String(text.prefix(max(12, text.count / 2))).trimmingCharacters(in: .whitespaces) + "."
                case "bullets": result = text.split(separator: ".").map { "- " + $0.trimmingCharacters(in: .whitespaces) }.filter { $0.count > 2 }.joined(separator: "\n")
                case "fix": result = text.prefix(1).uppercased() + text.dropFirst()
                default: result = de ? "Kurz gesagt: \(text)" : "In short: \(text)"
                }
                return result.split(separator: " ", omittingEmptySubsequences: false).map { .delta(String($0) + " ") } + [.done]
            }
            let context = body["context"] as? [String: Any] ?? [:]
            let entity = context["entity"] as? [String: Any]
            let taskId = entity?["id"] as? String
            let projectId = (entity?["projectId"] as? String) ?? (context["projectId"] as? String) ?? "p-website"
            let answer = de
                ? "**Stand:** Die Aufgabe ist seit 5 Tagen überfällig und hat noch keinen nächsten Schritt.\n- Liste der alten URLs exportieren\n- Weiterleitungen in der CDN-Konfiguration anlegen\n\nSoll ich einen nächsten Schritt eintragen?"
                : "**Status:** The task is 5 days overdue and has no next step yet.\n- Export the list of old URLs\n- Add the redirects to the CDN config\n\nShall I add a next step?"
            var events: [AiEvent] = [.context(projectTitle: "Website Relaunch", taskTitle: taskId == nil ? nil : "Set up 301 redirects for old URLs"),
                                     .step(tool: "get_task")]
            events += answer.split(separator: " ", omittingEmptySubsequences: false).map { .delta(String($0) + " ") }
            events.append(.proposal(AiProposal(id: "fake-\(UUID().uuidString.prefix(6))", tool: "update_task", projectId: projectId,
                                               projectTitle: "Website Relaunch", taskId: taskId ?? "t-redirects",
                                               taskTitle: "Set up 301 redirects for old URLs",
                                               changes: [.init(field: "nextStep", from: nil, to: de ? "Liste der alten URLs exportieren" : "Export the list of old URLs")])))
            events.append(.done)
            return events
        }
    }
}
#endif

/// Opens "Frag ProjectFlow" for a context (task, project, or the day).
@MainActor
enum AiAsk {
    static func present(model: AppModel, context: AiAskContext, question: String? = nil) {
        model.presenter.present(detents: [.fraction(0.55), .large]) {
            AiAskSheet(context: context, initialQuestion: question)
        }
    }
}
