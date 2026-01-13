//
//  projectflowApp.swift
//  projectflow
//
//  Created by Christoph Labestin on 13.01.26.
//

import SwiftUI
import FirebaseCore

@main
struct projectflowApp: App {
#if os(iOS)
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
#endif
    @StateObject private var session = SessionStore()

    init() {
#if !os(iOS)
        if FirebaseApp.app() == nil {
            FirebaseApp.configure()
        }
#endif
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(session)
        }
    }
}
