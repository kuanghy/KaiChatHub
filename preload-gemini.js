// Gemini 专用 preload - 由于 Trusted Types 限制，这里只做最基础的设置
// 主要的脚本注入由 main.js 通过 executeJavaScript 完成

const { contextBridge } = require('electron');

// 暴露一个简单的 API 给页面（如果需要的话）
contextBridge.exposeInMainWorld('KaiChatHub', {
  isGemini: true
});
