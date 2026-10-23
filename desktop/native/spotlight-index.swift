// pf-spotlight: replaces the app's CoreSpotlight items (macOS).
// Ships in Contents/MacOS of ProjectFlow.app so Bundle.main resolves to the app: items are attributed to the
// app, and a click arrives as `continue-activity` (com.apple.corespotlightitem) with the item id = app path.
// stdin: [{"id":"/project/p/tasks/t","title":"…","subtitle":"…","keywords":["…"]}] — `[]` clears the index.
import CoreSpotlight
import Foundation
import UniformTypeIdentifiers

struct Item: Decodable {
    let id: String
    let title: String
    let subtitle: String?
    let keywords: [String]?
}

let domain = "projectflow"
let input = FileHandle.standardInput.readDataToEndOfFile()
guard let items = try? JSONDecoder().decode([Item].self, from: input) else {
    FileHandle.standardError.write("invalid input\n".data(using: .utf8)!)
    exit(2)
}
guard Bundle.main.bundleIdentifier != nil else {
    FileHandle.standardError.write("not inside an app bundle\n".data(using: .utf8)!)
    exit(3)
}

let index = CSSearchableIndex.default()
let done = DispatchSemaphore(value: 0)
var failure: Error?

index.deleteSearchableItems(withDomainIdentifiers: [domain]) { error in
    if let error = error { failure = error; done.signal(); return }
    if items.isEmpty { done.signal(); return }
    let searchable = items.prefix(2000).map { item -> CSSearchableItem in
        let attributes = CSSearchableItemAttributeSet(contentType: UTType.content)
        attributes.title = item.title
        attributes.contentDescription = item.subtitle
        attributes.keywords = item.keywords
        let entry = CSSearchableItem(uniqueIdentifier: item.id, domainIdentifier: domain, attributeSet: attributes)
        entry.expirationDate = Date().addingTimeInterval(60 * 60 * 24 * 30)
        return entry
    }
    index.indexSearchableItems(Array(searchable)) { error in
        failure = error
        done.signal()
    }
}

if done.wait(timeout: .now() + 30) == .timedOut { exit(4) }
if let failure = failure {
    FileHandle.standardError.write("\(failure.localizedDescription)\n".data(using: .utf8)!)
    exit(1)
}
print("indexed \(items.count)")
