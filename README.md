# KaiChatHub

一站式 AI 大模型聊天应用，将多个 AI 模型网页版整合到一个桌面应用中。

## 支持的 AI 模型

| 序号 | AI 模型 | 网址 | 代理 |
|------|---------|------|------|
| 1 | 🟢 **腾讯元宝** | https://yuanbao.tencent.com/ | ❌ |
| 2 | 🔵 **文心一言** | https://yiyan.baidu.com/ | ❌ |
| 3 | 🩵 **字节豆包** | https://www.doubao.com/ | ❌ |
| 4 | 🔷 **深度求索** | https://chat.deepseek.com/ | ❌ |
| 5 | 🌙 **月之暗面 Kimi** | https://www.kimi.com/ | ❌ |
| 6 | 🌿 **ChatGPT** | https://chatgpt.com/ | ✅ |
| 7 | ✨ **Google Gemini** | https://gemini.google.com/ | ✅ |
| 8 | 🧡 **Claude** | https://claude.ai/ | ✅ |

## 快速开始

### 安装依赖

```bash
npm install
```

### 运行应用

```bash
npm start
```

### 打包应用

```bash
# macOS
npm run build:mac

# Windows
npm run build:win

# Linux
npm run build:linux
```

## 快捷键

- `Cmd/Ctrl + R` - 刷新当前页面
- `Cmd/Ctrl + Shift + I` - 打开开发者工具
- `Escape` - 关闭设置面板

## 特性

- 🎨 现代化深色主题界面
- ⚡ 快速切换不同 AI 模型
- 🌐 代理支持（ChatGPT、Gemini、Claude）
- 💾 独立会话存储，各平台登录状态互不影响
- ⌨️ 支持键盘快捷键
- 🖥️ 跨平台支持 (macOS, Windows, Linux)

## 技术栈

- Electron 28
- 原生 HTML/CSS/JavaScript
