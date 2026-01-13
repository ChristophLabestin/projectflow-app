//
//  ContentView.swift
//  projectflow
//
//  Created by Christoph Labestin on 13.01.26.
//

import SwiftUI

struct ContentView: View {
    var body: some View {
        AppShellView()
    }
}

#Preview {
    ContentView()
        .environmentObject(SessionStore())
}
