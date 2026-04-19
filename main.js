const path = require('path');
const { app, BrowserWindow, Tray, Menu, screen, session, desktopCapturer, ipcMain } = require('electron');
const fs = require('fs');

// GPU安定性とWebGPUのためのフラグ
app.commandLine.appendSwitch('enable-unsafe-webgpu');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('force_high_performance_gpu');
// Windows/LinuxでのVulkan安定化などのためだがmacOSでも悪影響は少ない
app.commandLine.appendSwitch('enable-features', 'Vulkan,UseSkiaRenderer');

const configPath = path.join(app.getPath('userData'), 'config.json');

function loadConfig() {
  try {
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
  } catch (e) {
    console.error('Failed to load config:', e);
  }
  return { modelType: 'E2B' };
}

function saveConfig(config) {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  } catch (e) {
    console.error('Failed to save config:', e);
  }
}

let mainWin;
let tray;
let config = loadConfig();
let currentStatus = '初期化中...';
let currentInterval = 10000;

function changeInterval(ms) {
  currentInterval = ms;
  if (mainWin) {
    mainWin.webContents.send('update-interval', ms);
  }
  updateTrayMenu();
}

function switchModel(type) {
  if (config.modelType === type) return;
  config.modelType = type;
  saveConfig(config);
  app.relaunch();
  app.exit(0);
}

function updateTrayMenu() {
  if (!tray || !mainWin) return;

  const isVisible = mainWin.isVisible();
  
  // ツールチップとタイトル（macOS）で状態を分かりやすく
  tray.setToolTip(`Danmaku Electron: ${isVisible ? '表示中' : '非表示'} (${currentStatus})`);
  if (process.platform === 'darwin') {
    tray.setTitle(isVisible ? ' 表示中' : ' 非表示');
  }

  const contextMenu = Menu.buildFromTemplate([
    { label: `ステータス: ${currentStatus}`, enabled: false },
    { label: `モデル: ${config.modelType === 'E4B' ? 'Gemma 4 E4B' : 'Gemma 4 E2B'}`, enabled: false },
    { type: 'separator' },
    {
      label: '画面を表示',
      type: 'checkbox',
      checked: isVisible,
      click: () => {
        if (isVisible) {
          mainWin.hide();
        } else {
          // オーバーレイなのでアクティブ化せずに表示
          mainWin.showInactive();
        }
        updateTrayMenu();
      }
    },
    {
      label: '解析頻度',
      submenu: [
        { label: '高速 (5秒)', type: 'radio', checked: currentInterval === 5000, click: () => changeInterval(5000) },
        { label: '標準 (10秒)', type: 'radio', checked: currentInterval === 10000, click: () => changeInterval(10000) },
        { label: '低速 (20秒)', type: 'radio', checked: currentInterval === 20000, click: () => changeInterval(20000) },
        { label: '極低速 (40秒)', type: 'radio', checked: currentInterval === 40000, click: () => changeInterval(40000) },
      ]
    },
    {
      label: 'AIモデル (要再起動)',
      submenu: [
        { label: 'Gemma 4 E2B (2.5B / 軽量)', type: 'radio', checked: config.modelType === 'E2B', click: () => switchModel('E2B') },
        { label: 'Gemma 4 E4B (4.3B / 高精度)', type: 'radio', checked: config.modelType === 'E4B', click: () => switchModel('E4B') },
      ]
    },
    { type: 'separator' },
    { label: '終了', role: 'quit' }
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
  
  mainWin.webContents.on('did-finish-load', () => {
    mainWin.webContents.send('init-config', {
      ...config,
      userDataPath: app.getPath('userData')
    });
  });

  // ウインドウ内のマウスクリックを透過（背後のウィンドウへ）
  // forward:true にすると子要素が CSS の pointer-events で受け取れるようになる
  mainWin.once('ready-to-show', () => {
    if (mainWin) {
      mainWin.setIgnoreMouseEvents(true, { forward: true });
    }
  });

  mainWin.on('show', updateTrayMenu);
  mainWin.on('hide', updateTrayMenu);
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
      if (mainWin.isVisible()) {
        mainWin.hide();
      } else {
        mainWin.showInactive();
      }
      updateTrayMenu();
    });
  } catch (err) {
    console.error('Tray creation failed:', err);
  }
});

app.on('window-all-closed', e => { e.preventDefault(); });
