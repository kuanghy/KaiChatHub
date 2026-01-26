const { app, BrowserWindow, BrowserView, ipcMain, session, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

// 禁用自动化控制标识（必须在 app ready 之前设置）
if (app && app.commandLine) {
  app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled');
}

let mainWindow;
let browserViews = {};
let currentTab = 'yuanbao';
let viewsHidden = false;

// AI 模型配置
const AI_TABS = {
  yuanbao: { url: 'https://yuanbao.tencent.com/', partition: 'persist:yuanbao', useProxy: false },
  yiyan: { url: 'https://yiyan.baidu.com/', partition: 'persist:yiyan', useProxy: false },
  doubao: { url: 'https://www.doubao.com/', partition: 'persist:doubao', useProxy: false },
  deepseek: { url: 'https://chat.deepseek.com/', partition: 'persist:deepseek', useProxy: false },
  kimi: { url: 'https://www.kimi.com/', partition: 'persist:kimi', useProxy: false },
  chatgpt: { url: 'https://chatgpt.com/', partition: 'persist:chatgpt', useProxy: true },
  gemini: { url: 'https://gemini.google.com/', partition: 'persist:gemini', useProxy: true },
  claude: { url: 'https://claude.ai/', partition: 'persist:claude', useProxy: true }
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
function setupSession(ses, tabName, useProxy = false, proxyConfig = null) {
  // 对于 Gemini，伪装成原生的 Safari 浏览器，这通常比 Chrome 伪装更易通过 Google 检测
  const SAFARI_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15';
  const UA = (tabName === 'gemini') ? SAFARI_UA : USER_AGENT;

  ses.setUserAgent(UA);

  // 深度清理请求头
  if (tabName === 'gemini') {
    ses.webRequest.onBeforeSendHeaders({
      urls: ['https://accounts.google.com/*', 'https://*.google.com/*', 'https://*.googleusercontent.com/*']
    }, (details, callback) => {
      const { requestHeaders } = details;

      // 1. 删除 X-Requested-With (处理各种大小写)
      Object.keys(requestHeaders).forEach(key => {
        if (key.toLowerCase() === 'x-requested-with') {
          delete requestHeaders[key];
        }
      });

      // 2. 删除 sec-ch-ua 相关头部（这些头部会泄露真实的 Chromium 版本）
      Object.keys(requestHeaders).forEach(key => {
        if (key.toLowerCase().startsWith('sec-ch-ua')) {
          delete requestHeaders[key];
        }
      });

      callback({ requestHeaders });
    });
  }

  ses.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(true);
  });

  ses.setPermissionCheckHandler(() => true);

  // 应用代理（针对国外网站）
  if (useProxy && proxyConfig && proxyConfig.enabled && proxyConfig.server) {
    ses.setProxy({
      proxyRules: proxyConfig.server,
      proxyBypassRules: '<local>'
    });
  }
}

// Gemini 专用：注入回车修复脚本
function injectGeminiScript(webContents) {
  const script = `
    (function() {
      // 防止重复注入
      if (window.__kaiChatHubInjected) return;
      window.__kaiChatHubInjected = true;

      // 1. 伪装成 Safari
      try {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        delete window.chrome;
        delete window.browser;
        Object.defineProperty(navigator, 'plugins', { get: () => [] });
        Object.defineProperty(navigator, 'languages', { get: () => ['zh-CN', 'zh'] });
        window.safari = { pushNotification: function() {} };
      } catch(e) {}

      // 2. 焦点与可见性修复
      try {
        document.hasFocus = function() { return true; };
        Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true });
        Object.defineProperty(document, 'hidden', { get: () => false, configurable: true });
      } catch(e) {}

      // 3. 查找发送按钮的函数
      function findSendButton() {
        const selectors = [
          'button[aria-label*="Send"]',
          'button[aria-label*="发送"]',
          'button[aria-label*="submit"]',
          'button[aria-label*="Submit"]',
          'button[data-tooltip*="Send"]',
          '.send-button-container button',
          'button.send-button'
        ];
        for (const selector of selectors) {
          const btn = document.querySelector(selector);
          if (btn && btn.offsetParent !== null) {
            return btn;
          }
        }
        // 兜底：遍历所有按钮
        const allButtons = document.querySelectorAll('button');
        for (const btn of allButtons) {
          const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
          if ((ariaLabel.includes('send') || ariaLabel.includes('发送') || ariaLabel.includes('submit')) && btn.offsetParent !== null) {
            return btn;
          }
        }
        return null;
      }

      // 4. 回车提交修复
      window.addEventListener('keydown', function(e) {
        // 只拦截普通的 Enter（不处理 Shift+Enter 和输入法合成状态）
        if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
          const activeEl = document.activeElement;

          const isInput = activeEl && (
            activeEl.getAttribute('contenteditable') === 'true' ||
            activeEl.tagName === 'TEXTAREA' ||
            activeEl.role === 'textbox'
          );

          if (isInput) {
            const sendBtn = findSendButton();

            if (sendBtn && !sendBtn.disabled) {
              e.preventDefault();
              e.stopImmediatePropagation();

              // 触发 input 事件确保编辑器状态更新
              activeEl.dispatchEvent(new Event('input', { bubbles: true }));

              // 下一帧点击发送按钮
              requestAnimationFrame(function() {
                sendBtn.click();
              });
            }
          }
        }
      }, true);
    })();
  `;

  webContents.executeJavaScript(script).catch(() => {});
}

// 创建 BrowserView
function createBrowserView(tabName) {
  const tabConfig = AI_TABS[tabName];
  const ses = session.fromPartition(tabConfig.partition);

  const config = loadConfig();
  setupSession(ses, tabName, tabConfig.useProxy, config.proxy);

  const view = new BrowserView({
    webPreferences: {
      session: ses,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      backgroundThrottling: false,
      // 为 Gemini 添加特殊的注入脚本
      preload: (tabName === 'gemini') ? path.join(__dirname, 'preload-gemini.js') : undefined
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

  // Gemini 专用：页面加载完成后注入回车修复脚本
  if (tabName === 'gemini') {
    view.webContents.on('did-finish-load', () => {
      injectGeminiScript(view.webContents);
    });
    // 页面内导航也需要重新注入
    view.webContents.on('did-navigate-in-page', () => {
      injectGeminiScript(view.webContents);
    });
  }

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

  // 管理 View 状态：静音后台 View，显示当前 View
  Object.entries(browserViews).forEach(([name, view]) => {
    if (name !== tabName) {
      view.setBounds({ x: -10000, y: -10000, width: 1, height: 1 });
      view.webContents.setAudioMuted(true);
    } else {
      view.webContents.setAudioMuted(false);
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

  // 确保 view 获得焦点，并触发页面可见性恢复
  browserViews[tabName].webContents.focus();

  // 尝试聚焦到输入框（所有页面通用）
  browserViews[tabName].webContents.executeJavaScript(`
    (function() {
      const selectors = [
        '#prompt-textarea',
        'textarea',
        '[contenteditable="true"]',
        '.ql-editor',
        '.ProseMirror'
      ];
      for (const s of selectors) {
        const el = document.querySelector(s);
        if (el && el.getBoundingClientRect().height > 0) {
          el.focus();
          break;
        }
      }
    })();
  `).catch(() => {});
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

// 显示关于窗口
function showAboutWindow() {
  const pkg = require('./package.json');

  const aboutWindow = new BrowserWindow({
    width: 360,
    height: 300,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    title: '关于 KaiChatHub',
    parent: mainWindow,
    modal: true,
    show: false,
    titleBarStyle: 'default',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  const aboutHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          color: #f0f0f5;
          height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 24px;
          text-align: center;
          user-select: none;
        }
        .logo {
          width: 72px;
          height: 72px;
          background: linear-gradient(135deg, #00d4aa, #4d6bfe);
          border-radius: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 32px;
          font-weight: 700;
          margin-bottom: 16px;
          box-shadow: 0 8px 24px rgba(0, 212, 170, 0.3);
        }
        .name { font-size: 22px; font-weight: 600; margin-bottom: 6px; }
        .version { font-size: 14px; color: #8a8a9a; margin-bottom: 16px; }
        .desc { font-size: 13px; color: #a0a0b0; line-height: 1.6; margin-bottom: 20px; }
        .copyright { font-size: 11px; color: #6a6a7a; margin-bottom: 16px; }
        .close-btn {
          padding: 8px 32px;
          background: rgba(255,255,255,0.1);
          border: 1px solid rgba(255,255,255,0.2);
          border-radius: 8px;
          color: #f0f0f5;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .close-btn:hover { background: rgba(255,255,255,0.2); }
      </style>
    </head>
    <body>
      <div class="logo">K</div>
      <div class="name">KaiChatHub</div>
      <div class="version">版本 ${pkg.version}</div>
      <div class="desc">一站式 AI 大模型聊天应用<br>整合多个主流 AI 助手</div>
      <div class="copyright">© 2026 KaiChatHub. MIT License.</div>
      <button class="close-btn" onclick="window.close()">关闭</button>
      <script>
        document.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') window.close();
        });
      </script>
    </body>
    </html>
  `;

  aboutWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(aboutHTML));
  aboutWindow.once('ready-to-show', () => aboutWindow.show());
}

app.whenReady().then(() => {
  // 创建应用菜单（用于注册全局快捷键）
  const template = [
    {
      label: 'KaiChatHub',
      submenu: [
        {
          label: '关于 KaiChatHub',
          click: () => showAboutWindow()
        },
        { type: 'separator' },
        { role: 'hide', label: '隐藏 KaiChatHub' },
        { role: 'hideOthers', label: '隐藏其他' },
        { role: 'unhide', label: '显示全部' },
        { type: 'separator' },
        { role: 'quit', label: '退出 KaiChatHub' }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: '视图',
      submenu: [
        {
          label: '刷新当前页面',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            if (browserViews[currentTab]) {
              browserViews[currentTab].webContents.reload();
            }
          }
        },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

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
      // 将 view 移到屏幕外（避免遮挡设置面板）
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
  Object.entries(AI_TABS).forEach(([tabName, tabConfig]) => {
    if (tabConfig.useProxy) {
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
