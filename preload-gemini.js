// 针对 Safari 身份的深度伪装
const script = document.createElement('script');
script.textContent = `
  // 1. 移除自动化检测特征
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

  // 2. 移除 window.chrome (Safari 没有这个对象)
  // 如果 User-Agent 是 Safari 但存在 window.chrome，会被 Google 判定为伪装
  delete window.chrome;
  delete window.browser;

  // 3. 模拟 Safari 的 plugins 和 languages
  Object.defineProperty(navigator, 'plugins', { get: () => [] });
  Object.defineProperty(navigator, 'languages', { get: () => ['zh-CN', 'zh'] });

  // 4. 模拟 Safari 的特定对象
  window.safari = {
    pushNotification: function() {}
  };
`;
document.documentElement.appendChild(script);
