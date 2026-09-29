const fs = require('fs');
const { moveTabOrder, resolveTabStateCommit } = require('./tab-order');

function normalizeProxyConfig(proxyConfig = {}) {
  const server = typeof proxyConfig.server === 'string' ? proxyConfig.server.trim() : '';
  const bypass = typeof proxyConfig.bypass === 'string' ? proxyConfig.bypass.trim() : '';
  return {
    enabled: !!(proxyConfig.enabled && server),
    server,
    bypass
  };
}

function normalizeProxyConfigForProbe(proxyConfig = {}) {
  const server = typeof proxyConfig.server === 'string' ? proxyConfig.server.trim() : '';
  return normalizeProxyConfig({ ...proxyConfig, enabled: !!server, server });
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

function normalizeTabOrder(allTabIds, tabOrder) {
  const known = new Set(allTabIds);
  const seen = new Set();
  const result = [];
  for (const id of tabOrder || []) {
    if (typeof id !== 'string' || !known.has(id) || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  for (const id of allTabIds) {
    if (seen.has(id)) continue;
    const defaultIndex = allTabIds.indexOf(id);
    const successor = allTabIds
      .slice(defaultIndex + 1)
      .find(candidate => result.includes(candidate));
    const insertIndex = successor ? result.indexOf(successor) : result.length;
    result.splice(insertIndex, 0, id);
    seen.add(id);
  }
  return result;
}

function normalizeTabState(allTabs, config = {}, options = {}) {
  const isConfigObject = config !== null && typeof config === 'object' && !Array.isArray(config);
  if (options.forWrite && (
    !isConfigObject
    || !Array.isArray(config.enabledTabs)
    || !Array.isArray(config.tabOrder)
  )) {
    return { ok: false, message: 'Invalid tab state' };
  }
  if (!isConfigObject) config = {};
  const allTabIds = allTabs.map(tab => tab.id);
  const known = new Set(allTabIds);
  const hasEnabledTabs = Array.isArray(config.enabledTabs);
  const storedEnabledTabs = [];
  const seen = new Set();
  const enabledSource = hasEnabledTabs
    ? config.enabledTabs
    : allTabs.filter(tab => tab.defaultEnabled !== false).map(tab => tab.id);
  for (const id of enabledSource) {
    if (typeof id !== 'string' || !known.has(id) || seen.has(id)) continue;
    seen.add(id);
    storedEnabledTabs.push(id);
  }
  let tabOrder;
  if (Array.isArray(config.tabOrder)) {
    tabOrder = normalizeTabOrder(allTabIds, config.tabOrder);
  } else {
    tabOrder = [...allTabIds];
  }
  const enabledSet = new Set(storedEnabledTabs);
  const enabledTabs = tabOrder.filter(id => enabledSet.has(id));
  if (options.forWrite && enabledTabs.length === 0) {
    return { ok: false, message: 'At least one tab must stay enabled' };
  }
  if (enabledTabs.length === 0 && tabOrder.length > 0) {
    enabledTabs.push(tabOrder[0]);
  }
  return { ok: true, tabOrder, enabledTabs };
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
  normalizeProxyConfigForProbe,
  normalizeTabProxyConfig,
  getEffectiveProxy,
  normalizeEnabledTabs,
  normalizeTabOrder,
  normalizeTabState,
  moveTabOrder,
  resolveTabStateCommit,
  writeConfigAtomic
};
