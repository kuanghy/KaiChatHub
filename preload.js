const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // 切换标签
  switchTab: (tabName) => ipcRenderer.send('switch-tab', tabName),

  // 刷新当前页面
  refreshTab: () => ipcRenderer.send('refresh-tab'),

  // 显示/隐藏 BrowserView
  showViews: (show) => ipcRenderer.send('show-views', show),

  // 监听加载状态
  onLoadingStatus: (callback) => ipcRenderer.on('loading-status', (event, data) => callback(data)),

  // 获取代理配置
  getProxyConfig: () => ipcRenderer.invoke('get-proxy-config'),

  // 设置代理配置
  setProxyConfig: (config) => ipcRenderer.invoke('set-proxy-config', config),

  // 测试代理连接
  testProxy: (config) => ipcRenderer.invoke('test-proxy', config),

  // 设置 BrowserView 焦点
  focusView: () => ipcRenderer.send('focus-view'),

  // 获取标签页配置（全部标签 + 启用列表）
  getTabConfig: () => ipcRenderer.invoke('get-tab-config'),

  // 设置启用的标签页
  setEnabledTabs: (tabs) => ipcRenderer.invoke('set-enabled-tabs', tabs),

  // 清除指定平台的数据（Cookie、缓存等）
  clearSiteData: (tabId) => ipcRenderer.invoke('clear-site-data', tabId),

  // 监听设置活跃标签（用于启动时恢复上次使用的标签）
  onSetActiveTab: (callback) => ipcRenderer.on('set-active-tab', (event, tabName) => callback(tabName))
});
