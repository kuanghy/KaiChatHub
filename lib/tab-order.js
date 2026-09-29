// 主窗口页面脚本与 Node 测试共用，勿在此 require Node 模块
function moveTabOrder(tabOrder, tabId, direction) {
  const result = [...tabOrder];
  if (direction !== -1 && direction !== 1) return result;
  const index = result.indexOf(tabId);
  const targetIndex = index + direction;
  if (index < 0 || targetIndex < 0 || targetIndex >= result.length) return result;
  [result[index], result[targetIndex]] = [result[targetIndex], result[index]];
  return result;
}

function resolveTabStateCommit(previous, next, saveResult) {
  if (saveResult && saveResult.success === true) {
    const currentTab = next.enabledTabs.includes(next.currentTab)
      ? next.currentTab
      : next.tabOrder.find(id => next.enabledTabs.includes(id));
    return { ...next, currentTab };
  }
  return { ...previous };
}

if (typeof module === 'object' && module.exports) {
  module.exports = { moveTabOrder, resolveTabStateCommit };
}
