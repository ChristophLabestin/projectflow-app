import SwiftUI
import PFDesign
import PFModel

// Temporary screens; each feature replaces its placeholder with the real screen in its own folder.
// Delete a placeholder here when the real type exists.

struct PlaceholderScreen: View {
    let title: String
    @Environment(AppModel.self) private var model

    var body: some View {
        VStack(alignment: .leading, spacing: PFSpace.m) {
            if model.router.isDeep { PFTopBar(onBack: { model.router.pop() }) }
            Text(title).pfText(.display).foregroundStyle(PFColor.textMain).padding(.horizontal, PFSpace.page)
            Spacer()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}


