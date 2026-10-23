// Dev-only: draws a "DEV" band over the app icon so the dev build is distinguishable from the installed app
// in the Dock / app switcher. Usage: swift dev-icon.swift <icon.icns> <out.icns>
import AppKit

let args = CommandLine.arguments
guard args.count == 3, let source = NSImage(contentsOfFile: args[1]) else { exit(2) }
let iconset = URL(fileURLWithPath: NSTemporaryDirectory()).appendingPathComponent("pf-dev-\(getpid()).iconset")
try? FileManager.default.createDirectory(at: iconset, withIntermediateDirectories: true)

for (size, scale) in [(16, 1), (16, 2), (32, 1), (32, 2), (128, 1), (128, 2), (256, 1), (256, 2), (512, 1), (512, 2)] {
    let px = size * scale
    guard let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: px, pixelsHigh: px, bitsPerSample: 8,
                                     samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB,
                                     bytesPerRow: 0, bitsPerPixel: 0) else { exit(3) }
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
    let canvas = NSRect(x: 0, y: 0, width: px, height: px)
    source.draw(in: canvas)
    let band = NSRect(x: 0, y: 0, width: CGFloat(px), height: CGFloat(px) * 0.26)
    NSColor(calibratedRed: 0.98, green: 0.45, blue: 0.09, alpha: 1).setFill()
    band.fill()
    let style = NSMutableParagraphStyle()
    style.alignment = .center
    let font = NSFont.systemFont(ofSize: CGFloat(px) * 0.17, weight: .heavy)
    let text = NSAttributedString(string: "DEV", attributes: [.font: font, .foregroundColor: NSColor.white, .paragraphStyle: style])
    let height = text.size().height
    text.draw(in: NSRect(x: 0, y: (band.height - height) / 2, width: CGFloat(px), height: height))
    NSGraphicsContext.restoreGraphicsState()
    let name = scale == 1 ? "icon_\(size)x\(size).png" : "icon_\(size)x\(size)@2x.png"
    try rep.representation(using: .png, properties: [:])!.write(to: iconset.appendingPathComponent(name))
}

let task = Process()
task.executableURL = URL(fileURLWithPath: "/usr/bin/iconutil")
task.arguments = ["-c", "icns", iconset.path, "-o", args[2]]
try task.run()
task.waitUntilExit()
try? FileManager.default.removeItem(at: iconset)
exit(task.terminationStatus)
