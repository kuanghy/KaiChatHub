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
  normalizeTabOrder,
  normalizeTabState,
  moveTabOrder,
  resolveTabStateCommit,
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

describe('moveTabOrder', () => {
  const order = ['yuanbao', 'chatgpt', 'grok'];

  it('moves items up or down and leaves boundary items in place', () => {
    assert.deepEqual(moveTabOrder(order, 'chatgpt', -1), ['chatgpt', 'yuanbao', 'grok']);
    assert.deepEqual(moveTabOrder(order, 'chatgpt', 1), ['yuanbao', 'grok', 'chatgpt']);
    assert.deepEqual(moveTabOrder(order, 'yuanbao', -1), order);
    assert.deepEqual(moveTabOrder(order, 'grok', 1), order);
  });

  it('ignores directions other than one step up or down', () => {
    const longOrder = ['a', 'b', 'c', 'd'];
    const result = moveTabOrder(longOrder, 'a', 2);
    assert.deepEqual(result, longOrder);
    assert.notEqual(result, longOrder);
  });
});

describe('normalizeTabOrder', () => {
  it('keeps stored relative order while dropping unknown and duplicate ids', () => {
    assert.deepEqual(
      normalizeTabOrder(
        ['yuanbao', 'chatgpt', 'grok'],
        ['grok', 'unknown', 'grok', 'yuanbao']
      ),
      ['chatgpt', 'grok', 'yuanbao']
    );
  });

  it('inserts new ids before the next stored default successor or at the end', () => {
    assert.deepEqual(
      normalizeTabOrder(
        ['a', 'b', 'c', 'd', 'e'],
        ['d', 'a', 'e']
      ),
      ['b', 'c', 'd', 'a', 'e']
    );
    assert.deepEqual(
      normalizeTabOrder(['a', 'b', 'c'], ['b', 'a']),
      ['b', 'a', 'c']
    );
  });
});

describe('normalizeTabState', () => {
  const allTabs = [
    { id: 'a', defaultEnabled: true },
    { id: 'b', defaultEnabled: false },
    { id: 'c', defaultEnabled: true },
    { id: 'd', defaultEnabled: true }
  ];

  it('uses the built-in order when legacy config has no tabOrder', () => {
    assert.deepEqual(
      normalizeTabState(allTabs, { enabledTabs: ['c', 'unknown', 'c', 'a'] }),
      {
        ok: true,
        tabOrder: ['a', 'b', 'c', 'd'],
        enabledTabs: ['a', 'c']
      }
    );
  });

  it('keeps new ids disabled for users with an existing enabled list', () => {
    assert.deepEqual(
      normalizeTabState(allTabs, {
        tabOrder: ['c', 'a'],
        enabledTabs: ['a', 'c']
      }),
      {
        ok: true,
        tabOrder: ['b', 'c', 'a', 'd'],
        enabledTabs: ['c', 'a']
      }
    );
  });

  it('uses defaultEnabled on first run', () => {
    assert.deepEqual(
      normalizeTabState(allTabs, {}),
      {
        ok: true,
        tabOrder: ['a', 'b', 'c', 'd'],
        enabledTabs: ['a', 'c', 'd']
      }
    );
  });

  it('enables the first ordered tab when stored enabled ids are all invalid', () => {
    assert.deepEqual(
      normalizeTabState(allTabs, {
        tabOrder: ['c', 'a', 'b', 'd'],
        enabledTabs: ['unknown']
      }),
      {
        ok: true,
        tabOrder: ['c', 'a', 'b', 'd'],
        enabledTabs: ['c']
      }
    );
  });

  it('rejects an empty enabled list when normalizing for write', () => {
    assert.deepEqual(
      normalizeTabState(
        allTabs,
        { tabOrder: ['c', 'a', 'b', 'd'], enabledTabs: [] },
        { forWrite: true }
      ),
      { ok: false, message: 'At least one tab must stay enabled' }
    );
  });

  it('rejects write payloads missing either required array', () => {
    for (const payload of [{}, { tabOrder: [] }, null]) {
      const result = normalizeTabState(allTabs, payload, { forWrite: true });
      assert.equal(result.ok, false);
      assert.equal(typeof result.message, 'string');
    }
  });
});

describe('resolveTabStateCommit', () => {
  const previous = {
    enabledTabs: ['a', 'b'],
    tabOrder: ['a', 'b', 'c'],
    currentTab: 'a'
  };

  it('keeps the next state after a successful save', () => {
    const next = {
      enabledTabs: ['a', 'c'],
      tabOrder: ['c', 'a', 'b'],
      currentTab: 'a'
    };
    assert.deepEqual(resolveTabStateCommit(previous, next, { success: true }), next);
  });

  it('selects the first enabled ordered tab after disabling the current tab', () => {
    const next = {
      enabledTabs: ['c', 'b'],
      tabOrder: ['a', 'b', 'c'],
      currentTab: 'a'
    };
    assert.deepEqual(
      resolveTabStateCommit(previous, next, { success: true }),
      {
        enabledTabs: ['c', 'b'],
        tabOrder: ['a', 'b', 'c'],
        currentTab: 'b'
      }
    );
  });

  it('restores the complete snapshot for failed or thrown saves', () => {
    const next = {
      enabledTabs: ['c'],
      tabOrder: ['c', 'b', 'a'],
      currentTab: 'c'
    };
    for (const saveResult of [{ success: false }, null, new Error('disk full')]) {
      assert.deepEqual(resolveTabStateCommit(previous, next, saveResult), previous);
    }
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
