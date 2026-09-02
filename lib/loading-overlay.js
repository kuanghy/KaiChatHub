// 主窗口页面脚本与 Node 测试共用，勿在此 require Node 模块
// persist: true 表示错误应常驻，直到切台、重试或新的加载开始
function getLoadingOverlayState({ tab, currentTab, loading, error, tabLabel, currentKind } = {}) {
  if (tab !== currentTab) {
    return { apply: false };
  }
  if (loading) {
    return {
      apply: true,
      visible: true,
      kind: 'loading',
      retry: false,
      persist: false,
      text: `正在加载 ${tabLabel}...`
    };
  }
  if (error) {
    return {
      apply: true,
      visible: true,
      kind: 'error',
      retry: true,
      persist: true,
      text: `加载失败: ${error}`
    };
  }
  if (currentKind === 'error') {
    return {
      apply: true,
      visible: true,
      kind: 'error',
      retry: true,
      persist: true
    };
  }
  return { apply: true, visible: false, kind: 'idle', retry: false, persist: false };
}

if (typeof module === 'object' && module.exports) {
  module.exports = { getLoadingOverlayState };
}
