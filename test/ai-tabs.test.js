const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { AI_TABS } = require('../lib/ai-tabs');

describe('AI_TABS', () => {
  it('includes 蚂蚁阿福 between 文心一言 and ChatGPT without a proxy', () => {
    assert.deepEqual(AI_TABS.antafu, {
      name: '蚂蚁阿福',
      url: 'https://chat.antafu.com/',
      partition: 'persist:antafu',
      useProxy: false,
      defaultEnabled: true
    });
    const ids = Object.keys(AI_TABS);
    assert.ok(ids.indexOf('yiyan') < ids.indexOf('antafu'));
    assert.ok(ids.indexOf('antafu') < ids.indexOf('chatgpt'));
  });
});

describe('sidebar catalog', () => {
  it('renders a nav button for every AI tab', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'sidebar.html'), 'utf8');
    for (const id of Object.keys(AI_TABS)) {
      assert.match(html, new RegExp(`data-tab="${id}"`));
    }
  });

  it('draws 蚂蚁阿福 with an inline svg', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'sidebar.html'), 'utf8');
    const button = html.match(/<button class="nav-item" data-tab="antafu"[\s\S]*?<\/button>/);
    assert.ok(button);
    assert.match(button[0], /<svg[\s\S]*<\/svg>/);
    assert.doesNotMatch(button[0], /<img/);
  });
});
