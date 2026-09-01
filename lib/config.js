const fs = require('fs');

function normalizeProxyConfig(proxyConfig = {}) {
  const server = typeof proxyConfig.server === 'string' ? proxyConfig.server.trim() : '';
  const bypass = typeof proxyConfig.bypass === 'string' ? proxyConfig.bypass.trim() : '';
  return {
    enabled: !!(proxyConfig.enabled && server),
    server,
    bypass
  };
}

function normalizeTabProxyConfig(tabProxy) {
  if (!tabProxy || typeof tabProxy !== 'object') return {};
  const result = {};
  for (const [tabId, server] of Object.entries(tabProxy)) {
    if (typeof server === 'string' && server.trim()) {
      result[tabId] = server.trim();
    }
  }
  return result;
}

function getEffectiveProxy(tabName, useProxy, globalProxy, tabProxy) {
  const perTab = tabProxy && typeof tabProxy[tabName] === 'string'
    ? tabProxy[tabName].trim()
    : '';
  if (perTab) return { enabled: true, server: perTab };
  if (useProxy) return globalProxy;
  return { enabled: false, server: '' };
}

function normalizeEnabledTabs(allTabIds, enabledTabs) {
  if (!Array.isArray(enabledTabs)) {
    return { ok: false, message: 'Invalid enabled tabs' };
  }
  const known = new Set(allTabIds);
  const seen = new Set();
  const result = [];
  for (const id of enabledTabs) {
    if (typeof id !== 'string' || !known.has(id) || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  if (result.length === 0) {
    return { ok: false, message: 'At least one tab must stay enabled' };
  }
  return { ok: true, enabledTabs: result };
}

function writeConfigAtomic(filePath, config, io = fs) {
  const tmpPath = `${filePath}.tmp`;
  try {
    io.writeFileSync(tmpPath, JSON.stringify(config, null, 2));
    io.renameSync(tmpPath, filePath);
    return true;
  } catch (error) {
    try {
      io.unlinkSync(tmpPath);
    } catch (_) {
      // 临时文件可能尚未创建
    }
    return false;
  }
}

module.exports = {
  normalizeProxyConfig,
  normalizeTabProxyConfig,
  getEffectiveProxy,
  normalizeEnabledTabs,
  writeConfigAtomic
};
