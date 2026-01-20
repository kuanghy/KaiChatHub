const { app, BrowserWindow, BrowserView, ipcMain, session, shell } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
let browserViews = {};
let currentTab = 'yuanbao';
let viewsHidden = false;

// AI 模型配置
const AI_TABS = {
  yuanbao: { url: 'https://yuanbao.tencent.com/', partition: 'persist:yuanbao' },
  yiyan: { url: 'https://yiyan.baidu.com/', partition: 'persist:yiyan' },
  doubao: { url: 'https://www.doubao.com/', partition: 'persist:doubao' },
  deepseek: { url: 'https://chat.deepseek.com/', partition: 'persist:deepseek' },
  kimi: { url: 'https://www.kimi.com/', partition: 'persist:kimi' },
  chatgpt: { url: 'https://chatgpt.com/', partition: 'persist:chatgpt' },
  claude: { url: 'https://claude.ai/', partition: 'persist:claude' }
};

// 配置文件路径
const configPath = path.join(app.getPath('userData'), 'config.json');

// Chrome User-Agent (使用最新版本)
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';


// 读取配置
function loadConfig() {
  try {
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Failed to load config:', error);
  }
  return { proxy: { enabled: false, server: '', bypass: '' } };
}

// 保存配置
function saveConfig(config) {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  } catch (error) {
    console.error('Failed to save config:', error);
  }
}

// 设置 session
function setupSession(ses, useProxy = false, proxyConfig = null) {
  ses.setUserAgent(USER_AGENT);

  ses.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(true);
  });

  ses.setPermissionCheckHandler(() => true);

  // 应用代理（仅对国外网站）
  if (useProxy && proxyConfig && proxyConfig.enabled && proxyConfig.server) {
    ses.setProxy({
      proxyRules: proxyConfig.server,
      proxyBypassRules: '<local>'
    });
  }
}

// 创建 BrowserView
function createBrowserView(tabName) {
  const tabConfig = AI_TABS[tabName];
  const ses = session.fromPartition(tabConfig.partition);

  const config = loadConfig();
  const useProxy = (tabName === 'chatgpt' || tabName === 'claude');
  setupSession(ses, useProxy, config.proxy);

  const view = new BrowserView({
    webPreferences: {
      session: ses,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      backgroundThrottling: false
    }
  });


  // 监听加载事件
  view.webContents.on('did-start-loading', () => {
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('loading-status', { tab: tabName, loading: true });
    }
  });

  view.webContents.on('did-stop-loading', () => {
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('loading-status', { tab: tabName, loading: false });
    }
  });

  view.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    if (mainWindow && mainWindow.webContents && errorCode !== -3) {
      mainWindow.webContents.send('loading-status', { tab: tabName, loading: false, error: errorDescription });
    }
  });

  view.webContents.loadURL(tabConfig.url);

  // 处理新窗口：在外部浏览器打开
  view.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  return view;
}

// 更新 BrowserView 大小
function updateViewBounds() {
  if (!mainWindow || viewsHidden) return;

  const [width, height] = mainWindow.getContentSize();
  const sidebarWidth = 72;

  // 只更新当前显示的 view
  if (browserViews[currentTab]) {
    browserViews[currentTab].setBounds({
      x: sidebarWidth,
      y: 0,
      width: width - sidebarWidth,
      height: height
    });
  }
}

// 切换标签
function switchTab(tabName) {
  if (!AI_TABS[tabName]) return;

  currentTab = tabName;

  // 如果 view 不存在，创建它
  if (!browserViews[tabName]) {
    browserViews[tabName] = createBrowserView(tabName);
    mainWindow.addBrowserView(browserViews[tabName]);
  }

  // 将所有 view 移到屏幕外
  Object.entries(browserViews).forEach(([name, view]) => {
    if (name !== tabName) {
      view.setBounds({ x: -10000, y: -10000, width: 1, height: 1 });
    }
  });

  // 如果设置面板打开，也将当前 view 移到屏幕外
  if (viewsHidden) {
    browserViews[tabName].setBounds({ x: -10000, y: -10000, width: 1, height: 1 });
    return;
  }

  // 显示当前 view
  const [width, height] = mainWindow.getContentSize();
  browserViews[tabName].setBounds({
    x: 72,
    y: 0,
    width: width - 72,
    height: height
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 15, y: 15 },
    backgroundColor: '#0f0f14',
    show: false
  });

  mainWindow.loadFile('sidebar.html');

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    // 默认显示元宝
    switchTab('yuanbao');
  });

  mainWindow.on('resize', updateViewBounds);

  // 快捷键打开开发者工具 (Cmd+Shift+I)
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.meta && input.shift && input.key === 'i') {
      mainWindow.webContents.openDevTools();
    }
  });

  // 当主窗口获得焦点时，确保当前 BrowserView 也获得焦点
  mainWindow.on('focus', () => {
    if (browserViews[currentTab]) {
      browserViews[currentTab].webContents.focus();
    }
  });

  // 监听鼠标进入内容区域，设置焦点
  mainWindow.webContents.on('did-finish-load', () => {
    // 注入脚本监听侧边栏外的点击
    mainWindow.webContents.executeJavaScript(`
      document.addEventListener('mousedown', (e) => {
        // 如果点击在侧边栏外，通知主进程设置焦点
        if (e.clientX > 72) {
          window.electronAPI && window.electronAPI.focusView && window.electronAPI.focusView();
        }
      });
    `).catch(() => {});
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC: 切换标签
ipcMain.on('switch-tab', (event, tabName) => {
  switchTab(tabName);
});

// IPC: 设置 BrowserView 焦点
ipcMain.on('focus-view', () => {
  if (browserViews[currentTab]) {
    browserViews[currentTab].webContents.focus();
    browserViews[currentTab].webContents.setIgnoreMenuShortcuts(true);
  }
});

// IPC: 显示/隐藏 BrowserView（用于设置面板）
ipcMain.on('show-views', (event, show) => {
  viewsHidden = !show;

  if (browserViews[currentTab]) {
    if (show) {
      // 恢复到正常位置
      const [width, height] = mainWindow.getContentSize();
      browserViews[currentTab].setBounds({
        x: 72,
        y: 0,
        width: width - 72,
        height: height
      });
    } else {
      // 将 view 移到屏幕外，而不是移除它（避免重新渲染）
      browserViews[currentTab].setBounds({
        x: -10000,
        y: -10000,
        width: 1,
        height: 1
      });
    }
  }
});

// IPC: 刷新当前页面
ipcMain.on('refresh-tab', () => {
  if (browserViews[currentTab]) {
    browserViews[currentTab].webContents.reload();
  }
});

// IPC: 获取代理配置
ipcMain.handle('get-proxy-config', () => {
  const config = loadConfig();
  return config.proxy || { enabled: false, server: '', bypass: '' };
});

// IPC: 保存代理配置
ipcMain.handle('set-proxy-config', async (event, proxyConfig) => {
  const config = loadConfig();
  config.proxy = proxyConfig;
  saveConfig(config);

  // 重新设置国外网站的代理
  ['chatgpt', 'claude'].forEach(tabName => {
    const tabConfig = AI_TABS[tabName];
    if (tabConfig) {
      const ses = session.fromPartition(tabConfig.partition);
      if (proxyConfig.enabled && proxyConfig.server) {
        ses.setProxy({
          proxyRules: proxyConfig.server,
          proxyBypassRules: '<local>'
        });
      } else {
        ses.setProxy({ proxyRules: '' });
      }
    }
  });

  // 刷新所有 view
  Object.values(browserViews).forEach(view => {
    view.webContents.reload();
  });

  return { success: true };
});

// IPC: 测试代理
ipcMain.handle('test-proxy', async (event, proxyConfig) => {
  try {
    const testSession = session.fromPartition('persist:test');
    if (proxyConfig.enabled && proxyConfig.server) {
      await testSession.setProxy({
        proxyRules: proxyConfig.server,
        proxyBypassRules: '<local>'
      });
    }

    const { net } = require('electron');
    const request = net.request({
      url: 'https://www.google.com',
      session: testSession
    });

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        request.abort();
        resolve({ success: false, message: '连接超时' });
      }, 10000);

      request.on('response', (response) => {
        clearTimeout(timeout);
        resolve({ success: response.statusCode === 200, message: `状态码: ${response.statusCode}` });
      });

      request.on('error', (error) => {
        clearTimeout(timeout);
        resolve({ success: false, message: error.message });
      });

      request.end();
    });
  } catch (error) {
    return { success: false, message: error.message };
  }
});
