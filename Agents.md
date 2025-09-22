# Electron アプリ作成ガイド（タスクトレイ駐在・前面表示・透過ウィンドウ・テキスト横流し）

この **Agents.md** は、以下の要件を満たす Electron アプリを構築するための手順とポイントをまとめています。

## 📋 要件概要
- アプリはタスクトレイに常駐し、クリックでウィンドウを表示/非表示できる
- ウィンドウは他アプリの前面に固定（`alwaysOnTop`）
- 背景は透過し、裏側のウインドウが見える状態にする
- 画面上部（または任意位置）で文字列を左から右へ流す（マリオネット風スクロール）

## 🛠️ 前提条件
- **Node.js** (v18 以上) と **npm** がインストール済み
- Electron の基本的な知識があること（`main` / `renderer` プロセスの概念）

## 🚀 プロジェクト作成手順
1. **プロジェクト初期化**
   ```bash
   mkdir danmaku-electron && cd $_
   npm init -y
   npm i electron@latest --save-dev
   ```

2. **`package.json` のスクリプト追加**
   ```json
   "scripts": {
     "start": "electron ."
   }
   ```

3. **エントリーファイル作成** – `main.js`
   ```javascript
   const { app, BrowserWindow, Tray, Menu } = require('electron');
   const path = require('path');

   let mainWin;
   let tray;

   function createWindow() {
     mainWin = new BrowserWindow({
       width: 800,
       height: 100,
       transparent: true,          // 背景透過
       frame: false,               // フレーム無し（見た目をシンプルに）
       alwaysOnTop: true,         // 前面固定
       skipTaskbar: true,          // タスクバーに表示しない
       webPreferences: {
         nodeIntegration: true,
         contextIsolation: false,
       },
     });

     mainWin.loadFile('index.html');
     // デバッグ時は devtools を開く（不要なら削除）
     // mainWin.webContents.openDevTools({ mode: 'detach' });
   }

   app.whenReady().then(() => {
     createWindow();

     // トレイアイコン作成
     tray = new Tray(path.join(__dirname, 'tray.png'));
     const contextMenu = Menu.buildFromTemplate([
       { label: '表示/非表示', click: () => {
         if (mainWin.isVisible()) mainWin.hide(); else mainWin.show();
       }},
       { type: 'separator' },
       { role: 'quit' }
     ]);
     tray.setToolTip('Danmaku Electron');
     tray.setContextMenu(contextMenu);

     // クリックでウィンドウの表示切替
     tray.on('click', () => {
       if (mainWin.isVisible()) mainWin.hide(); else mainWin.show();
     });
   });

   app.on('window-all-closed', (e) => { e.preventDefault(); }); // すべて閉じても終了させない
   ```

4. **レンダラ側 HTML/CSS/JS** – `index.html`
   ```html
   <!DOCTYPE html>
   <html lang="ja">
   <head>
     <meta charset="UTF-8" />
     <title>Danmaku</title>
     <style>
       body { margin:0; overflow:hidden; background:transparent; }
       #marquee {
         position:absolute;
         white-space:nowrap;
         font-size:24px;
         color:#fff;
         top:50%;
         transform:translateY(-50%);
         animation: scroll-left 10s linear infinite;
       }
       @keyframes scroll-left {
         from { left:100%; }
         to   { left:-100%; }
       }
     </style>
   </head>
   <body>
     <div id="marquee">ここに流す文字列を入れます – 例：こんにちは、世界！</div>
   </body>
   </html>
   ```

5. **トレイアイコン用画像** を `tray.png`（16×16 推奨）としてプロジェクト直下に配置する。

## 🔧 カスタマイズポイント
- **ウィンドウサイズ・位置**: `BrowserWindow` の `width/height/x/y` を調整。画面上部に固定したい場合は `y: 0`、左端から開始させたい場合は `x: 0`。
- **スクロール速度**: CSS アニメーションの `animation-duration`（例では `10s`）を変更する。
- **文字列更新**: `index.html` の `#marquee` 内容を書き換えるか、Renderer 側で IPC 経由にしてメインプロセスから動的に渡すことが可能。
- **常に前面表示の解除**: 必要なら `alwaysOnTop: false` に変更し、ウィンドウ表示時だけ `setAlwaysOnTop(true)` を呼び出すロジックを追加。

## 📦 ビルド & 配布
- **パッケージング** には `electron-builder` または `electron-packager` が便利です。例:
   ```bash
   npm i -D electron-builder
   # package.json に "build" スクリプトを追加
   "scripts": { "dist": "electron-builder" }
   npx electron-builder
   ```
- `asar` 化やアイコン設定は `electron-builder.yml` で細かく指定できます。

## 📝 注意点
1. **透過ウィンドウ** は Windows/macOS の描画方式に依存します。macOS では `transparent: true` と同時に `backgroundColor: '#00000000'` を設定すると安定します。
2. **タスクトレイ** のアイコンは OS に合わせたサイズが必要です（macOS は `.icns`、Windows は `.ico`）。
3. **常に前面表示** が不要になるケースではユーザー体験を考慮し、オプションで切り替えられるよう UI を用意すると良いでしょう。

---

この Agents.md を参考に、`danmaku-electron` ディレクトリ内で手順を実行すれば、要求された機能を持つ Electron アプリが完成します。質問や追加要件があれば遠慮なくどうぞ！

