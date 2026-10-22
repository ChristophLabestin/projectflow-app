import SwiftUI
import PFDesign

@main
struct ProjectFlowApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var delegate
    @State private var model = AppModel()
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(model)
                .onAppear {
                    delegate.model = model
                    NotificationActionHandler.model = model
                    PushRegistrar.shared.model = model
                    AppIntentBridge.model = model
                }
                .onOpenURL { url in
                    model.router.handle(url: url, activeTenant: model.workspace?.tenantId)
                }
                .onContinueUserActivity(NSUserActivityTypeBrowsingWeb) { activity in
                    if let url = activity.webpageURL {
                        model.router.handle(url: url, activeTenant: model.workspace?.tenantId)
                    }
                }
                .onChange(of: scenePhase) { _, phase in
                    if phase == .active { SystemSync.appBecameActive(model: model) }
                }
        }
    }
}
