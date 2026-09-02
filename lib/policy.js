const { getLoadingOverlayState } = require('./loading-overlay');

const DENIED_PERMISSIONS = new Set([
  'geolocation',
  'midi',
  'midiSysex',
  'hid',
  'serial',
  'usb'
]);

function isPermissionAllowed(permission) {
  return !DENIED_PERMISSIONS.has(permission);
}

function urlMatchesHost(rawUrl, hosts) {
  try {
    const { hostname } = new URL(rawUrl);
    return hosts.some(host => hostname === host || hostname.endsWith(`.${host}`));
  } catch (_) {
    return false;
  }
}

function resolveNavigationAction(rawUrl, options = {}) {
  const { tabUrl, tabName, grokAuthHosts = [], kind = 'navigate' } = options;
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch (_) {
    return { action: 'deny' };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { action: 'deny' };
  }
  if (tabName === 'grok' && urlMatchesHost(rawUrl, grokAuthHosts)) {
    return { action: kind === 'window-open' ? 'popup' : 'load' };
  }
  let tabHost;
  try {
    tabHost = new URL(tabUrl).hostname;
  } catch (_) {
    return { action: 'deny' };
  }
  if (urlMatchesHost(rawUrl, [tabHost])) {
    return { action: 'load' };
  }
  return { action: 'external' };
}

function shouldShowNewViewImmediately(isLoading) {
  return !isLoading;
}

function getSidebarPaddingTop(platform) {
  return platform === 'darwin' ? 60 : 20;
}

function shouldUseHiddenTitleBar(platform) {
  return platform === 'darwin';
}

function darwinHideMenuRoles(platform) {
  return platform === 'darwin' ? ['hide', 'hideOthers', 'unhide'] : [];
}

const MAX_RENDER_GONE_RELOADS = 3;

function shouldReloadAfterRenderGone(reason, consecutiveReloads = 0) {
  if (reason !== 'crashed' && reason !== 'killed') return false;
  return consecutiveReloads < MAX_RENDER_GONE_RELOADS;
}

function formatRenderGoneFailureMessage() {
  return '页面反复崩溃，请手动刷新';
}

const LOAD_FAILURE_MESSAGES = {
  '-2': '网络连接失败',
  '-7': '连接超时',
  '-21': '网络变化导致连接中断',
  '-100': '连接被关闭',
  '-101': '连接被重置',
  '-102': '连接被拒绝',
  '-105': 'DNS 解析失败',
  '-106': '无网络连接',
  '-118': '连接超时',
  '-130': '代理连接失败',
  '-137': 'SSL 协议错误',
  '-138': '代理验证失败'
};

function formatLoadFailureMessage(errorCode, errorDescription) {
  const mapped = LOAD_FAILURE_MESSAGES[String(errorCode)];
  return `${mapped || errorDescription} (${errorCode})`;
}

function shouldKeepViewOffscreen(viewsHidden, errorHidesView) {
  return !!(viewsHidden || errorHidesView);
}

// 主框架失败时藏 View，避免 Chromium 错误页盖住侧栏浮层；自动重试窗口内同样藏
function shouldHideViewOnFailLoad({ isMainFrame, errorCode, willAutoRetry }) {
  if (!isMainFrame) return false;
  if (willAutoRetry) return true;
  return errorCode !== -3;
}

module.exports = {
  isPermissionAllowed,
  urlMatchesHost,
  resolveNavigationAction,
  shouldShowNewViewImmediately,
  getSidebarPaddingTop,
  shouldUseHiddenTitleBar,
  darwinHideMenuRoles,
  shouldReloadAfterRenderGone,
  formatLoadFailureMessage,
  formatRenderGoneFailureMessage,
  getLoadingOverlayState,
  shouldKeepViewOffscreen,
  shouldHideViewOnFailLoad
};
