// 千问 BrowserView 预加载脚本
// 在页面脚本执行前运行，替换可能导致 Electron 渲染进程崩溃 (SIGSEGV) 的浏览器 API
// 影响范围：千问 BrowserView 主框架（www.qianwen.com）
//
// 背景：千问的 AWSC/Baxia 安全验证 SDK 会进行激进的设备指纹采集
// （音频指纹、GPU 指纹、传感器探测等），这些操作在 Electron 桌面环境中
// 会触发 Chromium 渲染引擎的底层 bug，导致渲染进程以 SIGSEGV 崩溃
//
// 注意：此 preload 仅作用于千问主框架。passport.qianwen.com 登录 iframe 中的
// AWSC 脚本通过 onBeforeRequest 拦截阻止加载（见 main.js），两者配合防止崩溃
(function() {
  'use strict';

  // === 1. 替换 AudioContext 为安全的空实现 ===
  // AWSC SDK 使用 ScriptProcessorNode（已废弃）进行音频指纹采集
  // 该操作是导致渲染进程崩溃的最可疑触发点（崩溃前的最后一条日志就是 ScriptProcessorNode 警告）
  function createNoopNode() {
    return {
      connect: function() { return this; },
      disconnect: function() {},
      addEventListener: function() {},
      removeEventListener: function() {},
      start: function() {},
      stop: function() {}
    };
  }

  function SafeAudioContext() {
    this.destination = createNoopNode();
    this.sampleRate = 44100;
    this.currentTime = 0;
    this.state = 'running';
  }

  SafeAudioContext.prototype.createScriptProcessor = function() {
    var node = createNoopNode();
    node.onaudioprocess = null;
    node.bufferSize = 4096;
    return node;
  };
  SafeAudioContext.prototype.createOscillator = function() {
    var node = createNoopNode();
    node.frequency = { value: 440, setValueAtTime: function() {} };
    node.type = 'sine';
    return node;
  };
  SafeAudioContext.prototype.createDynamicsCompressor = function() {
    var node = createNoopNode();
    node.threshold = { value: -24 };
    node.knee = { value: 30 };
    node.ratio = { value: 12 };
    node.attack = { value: 0.003 };
    node.release = { value: 0.25 };
    return node;
  };
  SafeAudioContext.prototype.createGain = function() {
    var node = createNoopNode();
    node.gain = { value: 1, setValueAtTime: function() {} };
    return node;
  };
  SafeAudioContext.prototype.createAnalyser = function() {
    var node = createNoopNode();
    node.fftSize = 2048;
    node.frequencyBinCount = 1024;
    node.getByteFrequencyData = function() {};
    node.getByteTimeDomainData = function() {};
    node.getFloatFrequencyData = function() {};
    node.getFloatTimeDomainData = function() {};
    return node;
  };
  SafeAudioContext.prototype.createBuffer = function(channels, length) {
    return { getChannelData: function() { return new Float32Array(length || 0); } };
  };
  SafeAudioContext.prototype.createBufferSource = function() {
    var node = createNoopNode();
    node.buffer = null;
    return node;
  };
  SafeAudioContext.prototype.createBiquadFilter = function() {
    var node = createNoopNode();
    node.frequency = { value: 350, setValueAtTime: function() {} };
    node.Q = { value: 1 };
    node.type = 'lowpass';
    return node;
  };
  SafeAudioContext.prototype.close = function() { return Promise.resolve(); };
  SafeAudioContext.prototype.resume = function() { return Promise.resolve(); };
  SafeAudioContext.prototype.suspend = function() { return Promise.resolve(); };
  SafeAudioContext.prototype.decodeAudioData = function() { return Promise.resolve(null); };

  window.AudioContext = SafeAudioContext;
  window.webkitAudioContext = SafeAudioContext;

  // === 2. 移除传感器 API ===
  // Electron 桌面环境无实际传感器硬件，AWSC 强行访问可能导致未定义行为
  var sensorAPIs = [
    'Accelerometer', 'Gyroscope', 'LinearAccelerationSensor',
    'Magnetometer', 'AbsoluteOrientationSensor', 'RelativeOrientationSensor'
  ];
  sensorAPIs.forEach(function(name) {
    try { window[name] = undefined; } catch(e) {}
  });

  // === 3. 禁用 WebGL（保留 2D Canvas 用于验证码/滑块） ===
  // WebGL 操作可能触发 GPU 进程与渲染进程之间的资源竞争 (SharedImageManager 崩溃)
  var _getContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function(type) {
    if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') {
      return null;
    }
    return _getContext.apply(this, arguments);
  };

})();
