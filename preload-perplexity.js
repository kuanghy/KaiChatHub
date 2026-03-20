// Perplexity BrowserView 预加载脚本
// 在页面脚本执行前运行，将 Electron 浏览器标识替换为 Google Chrome
// 影响范围：Perplexity BrowserView 主框架（www.perplexity.ai）
//
// 背景：Perplexity 使用 Cloudflare Turnstile 做人机验证，其检测脚本在 DOM 解析阶段
// 即采集 navigator.userAgentData 等指纹。若此时 brands 数组包含 "Electron"，
// Cloudflare 会将请求判定为自动化浏览器并反复弹出人机验证。
// 通过 preload 在页面脚本之前执行，确保 Cloudflare 采集时已是伪装后的值。
(function() {
  'use strict';

  // === 1. 伪造 navigator.userAgentData ===
  // 将 Electron 品牌替换为 Google Chrome，版本号与 Electron 28 内置 Chromium 120 对齐
  var brands = [
    { brand: 'Not_A Brand', version: '8' },
    { brand: 'Chromium', version: '120' },
    { brand: 'Google Chrome', version: '120' }
  ];
  var fullVersionList = [
    { brand: 'Not_A Brand', version: '8.0.0.0' },
    { brand: 'Chromium', version: '120.0.6099.56' },
    { brand: 'Google Chrome', version: '120.0.6099.56' }
  ];

  try {
    Object.defineProperty(navigator, 'userAgentData', {
      get: function() {
        return {
          brands: brands,
          mobile: false,
          platform: 'macOS',
          getHighEntropyValues: function() {
            return Promise.resolve({
              brands: brands,
              fullVersionList: fullVersionList,
              mobile: false,
              platform: 'macOS',
              platformVersion: '15.0.0',
              architecture: 'arm',
              bitness: '64',
              model: '',
              uaFullVersion: '120.0.6099.56'
            });
          },
          toJSON: function() {
            return { brands: brands, mobile: false, platform: 'macOS' };
          }
        };
      },
      configurable: true
    });
  } catch(e) {}

  // === 2. 隐藏 webdriver 标识 ===
  // 配合 app.commandLine 的 disable-blink-features=AutomationControlled 双重保险
  try {
    Object.defineProperty(navigator, 'webdriver', {
      get: function() { return undefined; },
      configurable: true
    });
  } catch(e) {}
})();
