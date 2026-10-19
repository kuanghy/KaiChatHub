// name: 显示名称  defaultEnabled: 首次运行时是否默认显示在侧边栏（用户可在设置中随时开启/关闭）
const AI_TABS = {
  doubao: { name: '字节豆包', url: 'https://www.doubao.com/', partition: 'persist:doubao', useProxy: false, defaultEnabled: true },
  yuanbao: { name: '腾讯元宝', url: 'https://yuanbao.tencent.com/', partition: 'persist:yuanbao', useProxy: false, defaultEnabled: true },
  qwen: { name: '通义千问', url: 'https://www.qianwen.com/', partition: 'persist:qwen', useProxy: false, defaultEnabled: true },
  chatglm: { name: '智谱清言', url: 'https://chatglm.cn/', partition: 'persist:chatglm', useProxy: false, defaultEnabled: false },
  deepseek: { name: '深度求索', url: 'https://chat.deepseek.com/', partition: 'persist:deepseek', useProxy: false, defaultEnabled: true },
  kimi: { name: 'Kimi', url: 'https://www.kimi.com/', partition: 'persist:kimi', useProxy: false, defaultEnabled: true },
  yiyan: { name: '文心一言', url: 'https://yiyan.baidu.com/', partition: 'persist:yiyan', useProxy: false, defaultEnabled: true },
  antafu: { name: '蚂蚁阿福', url: 'https://chat.antafu.com/', partition: 'persist:antafu', useProxy: false, defaultEnabled: true },
  chatgpt: { name: 'ChatGPT', url: 'https://chatgpt.com/', partition: 'persist:chatgpt', useProxy: true, defaultEnabled: false },
  gemini: { name: 'Gemini', url: 'https://gemini.google.com/', partition: 'persist:gemini', useProxy: true, defaultEnabled: false },
  claude: { name: 'Claude', url: 'https://claude.ai/', partition: 'persist:claude', useProxy: true, defaultEnabled: false },
  grok: { name: 'Grok', url: 'https://grok.com/', partition: 'persist:grok', useProxy: true, defaultEnabled: false },
  perplexity: { name: 'Perplexity', url: 'https://www.perplexity.ai/', partition: 'persist:perplexity', useProxy: true, defaultEnabled: false }
};

module.exports = { AI_TABS };
