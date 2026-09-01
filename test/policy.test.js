const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  isPermissionAllowed,
  resolveNavigationAction,
  shouldShowNewViewImmediately,
  getSidebarPaddingTop,
  shouldUseHiddenTitleBar,
  darwinHideMenuRoles
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
