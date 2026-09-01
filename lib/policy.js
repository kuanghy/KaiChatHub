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

module.exports = {
  isPermissionAllowed,
  urlMatchesHost,
  resolveNavigationAction,
  shouldShowNewViewImmediately,
  getSidebarPaddingTop,
  shouldUseHiddenTitleBar,
  darwinHideMenuRoles
};
