const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  normalizeProxyConfig,
  normalizeProxyConfigForProbe,
  normalizeTabProxyConfig,
  getEffectiveProxy,
  normalizeEnabledTabs,
  writeConfigAtomic
} = require('../lib/config');

describe('normalizeProxyConfig', () => {
  it('disables proxy when server is blank', () => {
    assert.deepEqual(
      normalizeProxyConfig({ enabled: true, server: '  ' }),
      { enabled: false, server: '', bypass: '' }
    );
  });
});

describe('normalizeProxyConfigForProbe', () => {
  it('probes with the filled server even when the toggle is off', () => {
    assert.deepEqual(
      normalizeProxyConfigForProbe({ enabled: false, server: ' http://127.0.0.1:7890 ' }),
      { enabled: true, server: 'http://127.0.0.1:7890', bypass: '' }
    );
  });

  it('does not enable a probe without a server', () => {
    assert.equal(normalizeProxyConfigForProbe({ enabled: true, server: '' }).enabled, false);
  });
});

describe('getEffectiveProxy', () => {
  it('prefers per-tab proxy over the global proxy', () => {
    const globalProxy = { enabled: true, server: 'http://127.0.0.1:7890' };
    assert.deepEqual(
      getEffectiveProxy('chatgpt', true, globalProxy, { chatgpt: 'socks5://127.0.0.1:1080' }),
      { enabled: true, server: 'socks5://127.0.0.1:1080' }
    );
  });
});

describe('normalizeTabProxyConfig', () => {
  it('drops empty servers', () => {
    assert.deepEqual(
      normalizeTabProxyConfig({ chatgpt: ' http://127.0.0.1:7890 ', grok: '' }),
      { chatgpt: 'http://127.0.0.1:7890' }
    );
  });
});

describe('normalizeEnabledTabs', () => {
  const allTabIds = ['yuanbao', 'chatgpt', 'grok'];

  it('rejects empty or unknown-only lists', () => {
    assert.equal(normalizeEnabledTabs(allTabIds, []).ok, false);
    assert.equal(normalizeEnabledTabs(allTabIds, ['nope']).ok, false);
    assert.equal(normalizeEnabledTabs(allTabIds, 'yuanbao').ok, false);
  });

  it('keeps known ids in order and drops duplicates', () => {
    const result = normalizeEnabledTabs(allTabIds, ['chatgpt', 'nope', 'chatgpt', 'yuanbao']);
    assert.equal(result.ok, true);
    assert.deepEqual(result.enabledTabs, ['chatgpt', 'yuanbao']);
  });
});

describe('writeConfigAtomic', () => {
  let dir;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kaichathub-config-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('replaces the target file via a temp rename', () => {
    const filePath = path.join(dir, 'config.json');
    assert.equal(writeConfigAtomic(filePath, { lastTab: 'yuanbao' }), true);
    assert.deepEqual(JSON.parse(fs.readFileSync(filePath, 'utf8')), { lastTab: 'yuanbao' });
    assert.equal(fs.existsSync(filePath + '.tmp'), false);
  });

  it('returns false when the write fails', () => {
    const filePath = path.join(dir, 'missing', 'config.json');
    assert.equal(writeConfigAtomic(filePath, { lastTab: 'yuanbao' }), false);
  });
});
