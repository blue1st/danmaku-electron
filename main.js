const { app, BrowserWindow, Tray, Menu, screen, session, desktopCapturer, ipcMain } = require('electron');
const path = require('path');

let mainWin;
let tray;
let currentStatus = '初期化中...';

function updateTrayMenu() {
  if (!tray) return;

  const contextMenu = Menu.buildFromTemplate([
    { label: `ステータス: ${currentStatus}`, enabled: false },
    { type: 'separator' },
    { label: '表示/非表示', click: () => {
      if (mainWin.isVisible()) mainWin.hide(); else mainWin.show();
    }},
    { type: 'separator' },
    { role: 'quit' }
  ]);
  tray.setContextMenu(contextMenu);
}

function createWindow() {
  // ディスプレイサイズに合わせてウインドウを大きく設定
  const { width: displayWidth, height: displayHeight } = screen.getPrimaryDisplay().workAreaSize;

  const winWidth = displayWidth;
  const winHeight = displayHeight;

  mainWin = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    transparent: true,
    backgroundColor: '#00000000', // macOS 透過ウィンドウの安定化
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      backgroundThrottling: false,
      nodeIntegrationInWorker: true,
    },
  });

  // 画面キャプチャの権限設定
  session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
    desktopCapturer.getSources({ types: ['screen'] }).then((sources) => {
      // 最初の画面を選択（自動選択）
      callback({ video: sources[0] });
    });
  });

  mainWin.loadFile('index.html');
  // ウインドウ内のマウスクリックを透過（背後のウィンドウへ）
  // forward:true にすると子要素が CSS の pointer-events で受け取れるようになる
  mainWin.once('ready-to-show', () => {
    if (mainWin) {
      mainWin.setIgnoreMouseEvents(true, { forward: true });
    }
  });
}

app.whenReady().then(() => {
  createWindow();

  try {
    const { nativeImage } = require('electron');
    let icon = nativeImage.createFromPath(path.join(__dirname, 'tray.png'));
    icon = icon.resize({ width: 22, height: 22 });
    if (process.platform === 'darwin') {
      icon.setTemplateImage(true);
    }
    tray = new Tray(icon);
    tray.setToolTip('Danmaku Electron');
    updateTrayMenu();

    ipcMain.on('update-status', (event, status) => {
      currentStatus = status;
      updateTrayMenu();
    });

    tray.on('click', () => {
      if (mainWin.isVisible()) mainWin.hide(); else mainWin.show();
    });
  } catch (err) {
    console.error('Tray creation failed:', err);
  }
});

app.on('window-all-closed', e => { e.preventDefault(); });
