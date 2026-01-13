import Foundation

extension Data {
    init?(base64URLEncoded input: String) {
        var base64 = input
            .replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/")

        let padding = 4 - (base64.count % 4)
        if padding < 4 {
            base64 += String(repeating: "=", count: padding)
        }

        self.init(base64Encoded: base64)
    }

    func base64URLEncodedString() -> String {
        self.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }
}
