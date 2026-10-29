#!/bin/bash
# Build the ToonReel macOS shell app (WKWebView pointing at the live site)
# and pack it as a zip for download.html. Run from anywhere.
set -e
cd "$(dirname "$0")"

# Site the desktop app loads. Update if the site moves.
APP_URL="https://009-daxiang.github.io/toonreel/"
VERSION="1.0.0"

cat > main.swift <<SWIFT
import Cocoa
import WebKit

let APP_URL = "$APP_URL"

final class AppDelegate: NSObject, NSApplicationDelegate {
    var window: NSWindow!
    func applicationDidFinishLaunching(_ notification: Notification) {
        let rect = NSRect(x: 0, y: 0, width: 430, height: 860)
        window = NSWindow(contentRect: rect,
                          styleMask: [.titled, .closable, .miniaturizable, .resizable],
                          backing: .buffered, defer: false)
        window.title = "ToonReel"
        window.appearance = NSAppearance(named: .darkAqua)
        window.minSize = NSSize(width: 340, height: 560)
        let config = WKWebViewConfiguration()
        let web = WKWebView(frame: (window.contentView?.bounds)!, configuration: config)
        web.autoresizingMask = [.width, .height]
        if let url = URL(string: APP_URL) {
            web.load(URLRequest(url: url))
        }
        window.contentView?.addSubview(web)
        window.center()
        window.makeKeyAndOrderFront(nil)
    }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()
SWIFT

cat > Info.plist <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>ToonReel</string>
  <key>CFBundleDisplayName</key><string>ToonReel</string>
  <key>CFBundleIdentifier</key><string>app.toonreel.desktop</string>
  <key>CFBundleVersion</key><string>$VERSION</string>
  <key>CFBundleShortVersionString</key><string>$VERSION</string>
  <key>CFBundleExecutable</key><string>ToonReel</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleInfoDictionaryVersion</key><string>6.0</string>
  <key>LSMinimumSystemVersion</key><string>11.0</string>
  <key>NSHighResolutionCapable</key><true/>
  <key>LSApplicationCategoryType</key><string>public.app-category.entertainment</string>
</dict>
</plist>
PLIST

echo "compiling (arm64 + x86_64)…"
swiftc -O -target arm64-apple-macosx11.0 -o ToonReel-arm64 main.swift -framework AppKit -framework WebKit
swiftc -O -target x86_64-apple-macosx11.0 -o ToonReel-x64 main.swift -framework AppKit -framework WebKit 2>/dev/null \
  && lipo -create ToonReel-arm64 ToonReel-x64 -output ToonReel \
  || { echo "(x86_64 unavailable — shipping arm64 only)"; cp ToonReel-arm64 ToonReel; }
rm -f ToonReel-arm64 ToonReel-x64

APP=ToonReel.app
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
mv ToonReel "$APP/Contents/MacOS/ToonReel"
cp Info.plist "$APP/Contents/Info.plist"
# brand icon
if [ -f ../assets/icons/icon-512.png ]; then
  sips -s format icns -z 512 512 ../assets/icons/icon-512.png --out "$APP/Contents/Resources/AppIcon.icns" >/dev/null 2>&1 || true
  PLIST_ADD='<key>CFBundleIconFile</key><string>AppIcon</string>'
  python3 - "$APP/Contents/Info.plist" "$PLIST_ADD" <<'P'
import sys
p, add = sys.argv[1], sys.argv[2]
s = open(p).read().replace("</dict>\n</plist>", f"  {add}\n</dict>\n</plist>")
open(p, "w").write(s)
P
fi

OUT=../downloads/toonreel-mac.zip
mkdir -p ../downloads
rm -f "$OUT"
ditto -c -k --keepParent "$APP" "$OUT"
echo "built $OUT ($(du -h "$OUT" | cut -f1))"

# quick smoke test: binary runs (launches app; kill after 2s)
"$APP/Contents/MacOS/ToonReel" & PID=$!
sleep 2
kill $PID 2>/dev/null && echo "smoke test: app launched OK"
exit 0
