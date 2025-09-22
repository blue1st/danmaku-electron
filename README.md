# Danmaku Electron

## 概要
タスクトレイに常駐し、クリックで表示/非表示を切り替えられる **透過ウィンドウ** 上で文字列が左から右へ流れる（マリオネット風）デモアプリです。\
- 常に前面に固定 (`alwaysOnTop`)
- 背景が透過、他のウインドウが見える
- macOS (Apple Silicon) 用 DMG パッケージをビルド可能

## 必要環境
- Node.js **v18 以上**（推奨 LTS）
- npm（Node に同梱）
- macOS 12.0 以降 (Apple Silicon) – DMG ビルド時に使用

## インストール手順
```bash
git clone <リポジトリURL>
cd danmaku-electron
npm install   # electron と electron‑builder がインストールされます
```

## 開発・実行方法
### アプリ起動
```bash
npm start
```
タスクトレイにアイコンが表示され、クリックでウィンドウの表示/非表示を切り替えられます。

### カスタマイズ例
- **ウィンドウサイズ・位置**: `main.js` の `BrowserWindow` オプション (`width`, `height`, `x`, `y`) を変更
- **スクロール速度**: `index.html` の CSS アニメーション `animation-duration` を調整
- **表示文字列**: `index.html` の `#marquee` 内容を編集、もしくは IPC で動的に送信可能

## macOS (Apple Silicon) 用 DMG ビルド手順
```bash
npm run dist   # electron‑builder が mac 用 .dmg を出力します
```
ビルド結果は `dist/` ディレクトリに `danmaku-electron-1.0.0-arm64.dmg` として生成されます。DMG を開くとアプリを `/Applications` へドラッグできます。

## Windows (amd64) 用インストーラビルド手順
```bash
npm run dist   # electron‑builder が mac と windows の両方を出力します
```
Windows 用は `dist/` に `DanmakuElectron Setup 1.0.0.exe`（NSIS インストーラ）が生成されます。実行するとインストールウィザードが表示され、任意のフォルダーへインストールできます。

## ファイル構成
```
├─ main.js          # メインプロセス（ウィンドウ・トレイ設定）
├─ index.html       # レンダラ側 UI と文字列スクロール実装
├─ tray.png         # タスクトレイアイコン (16×16 推奨)
├─ comments.txt     # デモ用コメント集（開発者向け）
└─ package.json    # スクリプト・ビルド設定
```

## ライセンス
MIT License（`LICENSE` が存在すればそちらを参照）。必要に応じて `package.json` の `license` フィールドを書き換えてください。

---
質問や要望があれば **Issues** か Pull Request でお気軽にどうぞ！
