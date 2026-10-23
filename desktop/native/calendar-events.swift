// pf-calendar: prints the user's upcoming calendar events as JSON for the ProjectFlow desktop app.
//   pf-calendar [hoursAhead]     → {"status":"granted","events":[{id,title,start,end,calendar}]}
// Uses EventKit; macOS asks for calendar access on first run (attributed to ProjectFlow, which launches it).
import EventKit
import Foundation

let hoursAhead = Double(CommandLine.arguments.dropFirst().first ?? "") ?? 12
let store = EKEventStore()
let semaphore = DispatchSemaphore(value: 0)
var granted = false

func emit(_ object: [String: Any]) {
    let data = try! JSONSerialization.data(withJSONObject: object, options: [])
    FileHandle.standardOutput.write(data)
}

if #available(macOS 14.0, *) {
    store.requestFullAccessToEvents { ok, _ in granted = ok; semaphore.signal() }
} else {
    store.requestAccess(to: .event) { ok, _ in granted = ok; semaphore.signal() }
}
if semaphore.wait(timeout: .now() + 120) == .timedOut || !granted {
    emit(["status": "denied", "events": []])
    exit(0)
}

let formatter = ISO8601DateFormatter()
let now = Date()
let predicate = store.predicateForEvents(withStart: now.addingTimeInterval(-3 * 3600), end: now.addingTimeInterval(hoursAhead * 3600), calendars: nil)
let events = store.events(matching: predicate)
    .filter { !$0.isAllDay && $0.availability != .free }
    .sorted { $0.startDate < $1.startDate }
    .prefix(50)
    .map { event -> [String: Any] in
        [
            "id": "\(event.calendarItemIdentifier)@\(formatter.string(from: event.startDate))",
            "title": event.title ?? "",
            "start": formatter.string(from: event.startDate),
            "end": formatter.string(from: event.endDate),
            "calendar": event.calendar?.title ?? ""
        ]
    }
emit(["status": "granted", "events": Array(events)])
