const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  isPermissionAllowed,
  resolveNavigationAction,
  shouldShowNewViewImmediately,
  getSidebarPaddingTop,
  shouldUseHiddenTitleBar,
  darwinHideMenuRoles,
  shouldReloadAfterRenderGone,
  formatLoadFailureMessage,
  formatRenderGoneFailureMessage,
  getLoadingOverlayState,
  shouldKeepViewOffscreen,
  shouldHideViewOnFailLoad
} = require('../lib/policy');

const GROK_AUTH_HOSTS = [
  'grok.com',
  'accounts.x.ai',
  'x.com',
  'twitter.com',
  'accounts.google.com',
  'appleid.apple.com'
];

describe('isPermissionAllowed', () => {
  it('rejects geolocation and device permissions', () => {
    assert.equal(isPermissionAllowed('geolocation'), false);
    assert.equal(isPermissionAllowed('hid'), false);
    assert.equal(isPermissionAllowed('serial'), false);
    assert.equal(isPermissionAllowed('usb'), false);
    assert.equal(isPermissionAllowed('midi'), false);
    assert.equal(isPermissionAllowed('midiSysex'), false);
  });

  it('keeps media so voice input still works', () => {
    assert.equal(isPermissionAllowed('media'), true);
    assert.equal(isPermissionAllowed('notifications'), true);
    assert.equal(isPermissionAllowed('clipboard-sanitized-write'), true);
  });
});

describe('resolveNavigationAction', () => {
  const chatgpt = {
    tabUrl: 'https://chatgpt.com/',
    tabName: 'chatgpt',
    grokAuthHosts: GROK_AUTH_HOSTS
  };

  it('denies file javascript and data URLs', () => {
    assert.equal(resolveNavigationAction('file:///etc/passwd', chatgpt).action, 'deny');
    assert.equal(resolveNavigationAction('javascript:alert(1)', chatgpt).action, 'deny');
    assert.equal(resolveNavigationAction('data:text/html,hi', chatgpt).action, 'deny');
  });

  it('loads same-site popups in the current view', () => {
    assert.equal(
      resolveNavigationAction('https://chatgpt.com/backend-api/foo', { ...chatgpt, kind: 'window-open' }).action,
      'load'
    );
    assert.equal(
      resolveNavigationAction('https://www.chatgpt.com/share', { ...chatgpt, kind: 'navigate' }).action,
      'load'
    );
  });

  it('opens off-site http(s) links in the system browser', () => {
    assert.equal(
      resolveNavigationAction('https://platform.openai.com/docs', { ...chatgpt, kind: 'window-open' }).action,
      'external'
    );
  });

  it('opens Grok auth hosts in an in-app popup', () => {
    const grok = {
      tabUrl: 'https://grok.com/',
      tabName: 'grok',
      grokAuthHosts: GROK_AUTH_HOSTS,
      kind: 'window-open'
    };
    assert.equal(resolveNavigationAction('https://accounts.x.ai/login', grok).action, 'popup');
    assert.equal(
      resolveNavigationAction('https://accounts.google.com/o/oauth', { ...grok, kind: 'navigate' }).action,
      'load'
    );
  });
});

describe('shouldShowNewViewImmediately', () => {
  it('shows immediately when loading already finished', () => {
    assert.equal(shouldShowNewViewImmediately(false), true);
    assert.equal(shouldShowNewViewImmediately(true), false);
  });
});

describe('platform chrome', () => {
  it('uses traffic-light padding and hidden title bar only on macOS', () => {
    assert.equal(getSidebarPaddingTop('darwin'), 60);
    assert.equal(getSidebarPaddingTop('win32'), 20);
    assert.equal(shouldUseHiddenTitleBar('darwin'), true);
    assert.equal(shouldUseHiddenTitleBar('linux'), false);
    assert.deepEqual(darwinHideMenuRoles('darwin'), ['hide', 'hideOthers', 'unhide']);
    assert.deepEqual(darwinHideMenuRoles('win32'), []);
  });
});

describe('shouldReloadAfterRenderGone', () => {
  it('reloads after crash or kill on any tab', () => {
    assert.equal(shouldReloadAfterRenderGone('crashed'), true);
    assert.equal(shouldReloadAfterRenderGone('killed'), true);
  });

  it('does not reload on clean or unknown exits', () => {
    assert.equal(shouldReloadAfterRenderGone('clean-exit'), false);
    assert.equal(shouldReloadAfterRenderGone('oom'), false);
    assert.equal(shouldReloadAfterRenderGone(''), false);
  });

  it('stops auto-reload after three consecutive crashes', () => {
    assert.equal(shouldReloadAfterRenderGone('crashed', 2), true);
    assert.equal(shouldReloadAfterRenderGone('killed', 3), false);
  });
});

describe('formatLoadFailureMessage', () => {
  it('uses the same Chinese mapping for every tab', () => {
    assert.equal(formatLoadFailureMessage(-106, 'net::ERR_INTERNET_DISCONNECTED'), '无网络连接 (-106)');
    assert.equal(formatLoadFailureMessage(-130, 'net::ERR_PROXY_CONNECTION_FAILED'), '代理连接失败 (-130)');
  });

  it('falls back to the Chromium description for unknown codes', () => {
    assert.equal(formatLoadFailureMessage(-3, 'net::ERR_ABORTED'), 'net::ERR_ABORTED (-3)');
  });
});

describe('getLoadingOverlayState', () => {
  it('keeps a load error visible with retry and does not auto-hide', () => {
    assert.deepEqual(
      getLoadingOverlayState({
        tab: 'chatgpt',
        currentTab: 'chatgpt',
        loading: false,
        error: '无网络连接 (-106)'
      }),
      {
        apply: true,
        visible: true,
        kind: 'error',
        retry: true,
        persist: true,
        text: '加载失败: 无网络连接 (-106)'
      }
    );
  });

  it('ignores status from a background tab', () => {
    assert.deepEqual(
      getLoadingOverlayState({
        tab: 'chatgpt',
        currentTab: 'yuanbao',
        loading: false,
        error: '连接超时'
      }),
      { apply: false }
    );
  });

  it('shows loading and hides retry when a new load starts', () => {
    const state = getLoadingOverlayState({
      tab: 'chatgpt',
      currentTab: 'chatgpt',
      loading: true,
      tabLabel: 'ChatGPT'
    });
    assert.equal(state.visible, true);
    assert.equal(state.kind, 'loading');
    assert.equal(state.retry, false);
    assert.equal(state.persist, false);
    assert.equal(state.text, '正在加载 ChatGPT...');
  });

  it('hides the overlay when loading finishes without error', () => {
    assert.deepEqual(
      getLoadingOverlayState({ tab: 'chatgpt', currentTab: 'chatgpt', loading: false }),
      { apply: true, visible: false, kind: 'idle', retry: false, persist: false }
    );
  });

  it('keeps a persisted error when a later idle event arrives', () => {
    const state = getLoadingOverlayState({
      tab: 'chatgpt',
      currentTab: 'chatgpt',
      loading: false,
      currentKind: 'error'
    });
    assert.equal(state.apply, true);
    assert.equal(state.visible, true);
    assert.equal(state.kind, 'error');
    assert.equal(state.retry, true);
    assert.equal(state.persist, true);
  });

  it('clears a persisted error when a new load starts', () => {
    const state = getLoadingOverlayState({
      tab: 'chatgpt',
      currentTab: 'chatgpt',
      loading: true,
      currentKind: 'error',
      tabLabel: 'ChatGPT'
    });
    assert.equal(state.kind, 'loading');
    assert.equal(state.retry, false);
  });
});

describe('shouldKeepViewOffscreen', () => {
  it('keeps the view offscreen while settings or an error overlay needs the content area', () => {
    assert.equal(shouldKeepViewOffscreen(false, false), false);
    assert.equal(shouldKeepViewOffscreen(true, false), true);
    assert.equal(shouldKeepViewOffscreen(false, true), true);
    assert.equal(shouldKeepViewOffscreen(true, true), true);
  });
});

describe('shouldHideViewOnFailLoad', () => {
  it('hides the view during proxy auto-retry so Chromium error pages cannot flash', () => {
    assert.equal(shouldHideViewOnFailLoad({ isMainFrame: true, errorCode: -106, willAutoRetry: true }), true);
  });

  it('hides the view on a final main-frame failure', () => {
    assert.equal(shouldHideViewOnFailLoad({ isMainFrame: true, errorCode: -106, willAutoRetry: false }), true);
  });

  it('does not hide on aborted loads or subframe failures', () => {
    assert.equal(shouldHideViewOnFailLoad({ isMainFrame: true, errorCode: -3, willAutoRetry: false }), false);
    assert.equal(shouldHideViewOnFailLoad({ isMainFrame: false, errorCode: -106, willAutoRetry: false }), false);
  });
});
