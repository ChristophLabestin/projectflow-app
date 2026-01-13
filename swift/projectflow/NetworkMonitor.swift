import Foundation
import Combine
import Network

@MainActor
final class NetworkMonitor: ObservableObject {
    @Published var isOffline = false

    private let monitor = NWPathMonitor()
    private let queue = DispatchQueue(label: "projectflow.network.monitor")

    init() {
        monitor.pathUpdateHandler = { [weak self] path in
            _Concurrency.Task { @MainActor in
                self?.isOffline = path.status != .satisfied
            }
        }
        monitor.start(queue: queue)
    }

    deinit {
        monitor.cancel()
    }
}
