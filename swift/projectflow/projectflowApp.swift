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
    @StateObject private var session = SessionStore()

    init() {
        if FirebaseApp.app() == nil {
            FirebaseApp.configure()
        }
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(session)
        }
    }
}
