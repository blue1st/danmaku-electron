#!/bin/bash
# scripts/update-homebrew.sh

set -e

VERSION=$1
DMG_PATH="dist/danmaku-electron-${VERSION}-arm64.dmg"

if [ ! -f "$DMG_PATH" ]; then
  echo "Error: DMG not found at $DMG_PATH"
  exit 1
fi

if [ -z "$HOMEBREW_TAP_TOKEN" ]; then
  echo "Error: HOMEBREW_TAP_TOKEN is not set"
  exit 1
fi

# SHA256を計算
SHA256=$(shasum -a 256 "$DMG_PATH" | awk '{print $1}')
echo "Updating Homebrew Cask to version $VERSION with SHA256 $SHA256"

# Tapリポジトリをテンポラリにクローン
TMP_DIR=$(mktemp -d)
git clone "https://${HOMEBREW_TAP_TOKEN}@github.com/blue1st/homebrew-taps.git" "$TMP_DIR"

CASK_PATH="$TMP_DIR/Casks/danmaku-electron.rb"
mkdir -p "$TMP_DIR/Casks"

# Caskの内容を生成
cat <<EOF > "$CASK_PATH"
cask "danmaku-electron" do
  version "${VERSION}"
  sha256 "${SHA256}"

  url "https://github.com/blue1st/danmaku-electron/releases/download/v#{version}/danmaku-electron-#{version}-arm64.dmg"
  name "Danmaku Electron"
  desc "AI Desktop Commentary Overlay"
  homepage "https://github.com/blue1st/danmaku-electron"

  app "DanmakuElectron.app"

  # Only support Apple Silicon (based on release assets)
  depends_on arch: :arm64

  postflight do
    system_command "/usr/bin/xattr",
                   args: ["-dr", "com.apple.quarantine", "#{appdir}/DanmakuElectron.app"],
                   sudo: false
    system_command "/usr/bin/codesign",
                   args: ["--force", "--deep", "--sign", "-", "#{appdir}/DanmakuElectron.app"],
                   sudo: false
  end

  zap trash: [
    "~/Library/Application Support/DanmakuElectron",
    "~/Library/Preferences/com.example.danmaku.plist",
    "~/Library/Logs/DanmakuElectron",
  ]
end
EOF

# コミットしてプッシュ
cd "$TMP_DIR" || exit 1
git config user.name "github-actions[bot]"
git config user.email "github-actions[bot]@users.noreply.github.com"
git add .
git commit -m "chore: update danmaku-electron to v${VERSION}"
git push origin main

# 後片付け
rm -rf "$TMP_DIR"
echo "Homebrew Cask updated successfully!"
