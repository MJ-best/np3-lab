#!/bin/sh
# Build NP3 Lab for iPhone/iPad and upload it to App Store Connect (then TestFlight / review).
# Needs Xcode with your Apple ID under Settings > Accounts, and the app created in App Store Connect
# with bundle id io.github.mj-best.np3lab. The version comes from package.json (npm run version).
set -eu
cd "$(dirname "$0")/.."
OUT=build/ios
rm -rf "$OUT"
npm run build:ios
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Release \
  -destination 'generic/platform=iOS' -archivePath "$OUT/NP3Lab.xcarchive" \
  -allowProvisioningUpdates archive
xcodebuild -exportArchive -archivePath "$OUT/NP3Lab.xcarchive" \
  -exportOptionsPlist ios/release/ExportOptions.plist -exportPath "$OUT/export" \
  -allowProvisioningUpdates
echo "Uploaded. It shows up in App Store Connect > TestFlight after processing (about 10-30 minutes)."
