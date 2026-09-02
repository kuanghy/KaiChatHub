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
  formatLoadFailureMessage
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
