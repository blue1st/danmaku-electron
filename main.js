const { app, BrowserWindow, Tray, Menu, screen } = require('electron');
const path = require('path');

let mainWin;
let tray;

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
    },
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

  tray.on('click', () => {
    if (mainWin.isVisible()) mainWin.hide(); else mainWin.show();
  });
});

app.on('window-all-closed', e => { e.preventDefault(); });
