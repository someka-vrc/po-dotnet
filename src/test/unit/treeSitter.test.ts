import * as assert from 'assert';
const proxyquire: any = require('proxyquire');

suite('TreeSitterSourceParser (unit)', () => {
  test('init success and parsing yields calls', async () => {
    let loadedUrl: string | null = null;
    // Mock web-tree-sitter
    const MockParser = function (this: any) {
      this.setLanguage = () => {};
      this.parse = (_text: string) => ({ rootNode: {} });
    } as any;
    const MockQuery = function (this: any, _lang: any, _q: string) {
      this.captures = (_root: any) => [
        { name: 'func-name', node: { text: 'G', startIndex: 0 } },
        { name: 'args', node: { startIndex: 2, endIndex: 9 } },
      ];
    } as any;
    const MockWTS = {
      init: async () => {},
      Language: {
        load: async (url: string) => {
          loadedUrl = url;
          return {};
        },
      },
      Parser: MockParser,
      Query: MockQuery,
    };

    const { TreeSitterSourceParser } = require('../../parsers/treeSitterSourceParser') as any;

    const p = new TreeSitterSourceParser('csharp', MockWTS);
    // Explicitly run init to ensure readiness and surface errors
    try {
      await (p as any).init();
    } catch (e) {
      assert.fail('init failed: ' + String(e));
    }

    const calls = p.findAllLocalizationCalls('G("hello")');
    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0].msgid, 'hello');
    // assert that Language.load was called with CDN URL (default base + wasm name)
    assert.ok(typeof loadedUrl === 'string' && (loadedUrl as string).endsWith('tree-sitter-c_sharp.wasm'));
  });

  test('member call captured and filtered', async () => {
    const MockParser = function (this: any) { this.setLanguage = () => {}; this.parse = (_text: string) => ({ rootNode: {} }); } as any;
    const MockQuery = function (this: any) { this.captures = (_: any) => [
      { name: 'func-name', node: { text: 't', startIndex: 0 } },
      // set args range to match i18n.t("hello") -> '(' at 6, inside starts at 7, closing ')' at 14
      { name: 'args', node: { startIndex: 7, endIndex: 14 } },
    ]; } as any;
    const MockWTS = {
      init: async () => {},
      Language: { load: async (url: string) => { return {}; } },
      Parser: MockParser,
      Query: MockQuery,
    };

    const { TreeSitterSourceParser } = require('../../parsers/treeSitterSourceParser') as any;

    const p = new TreeSitterSourceParser('javascript', MockWTS);
    try {
      await (p as any).init();
    } catch (e) {
      assert.fail('init failed: ' + String(e));
    }

    const callsT = p.findAllLocalizationCalls('i18n.t("hello")', ['t']);
    assert.strictEqual(callsT.length, 1);
    assert.strictEqual(callsT[0].funcName, 't');

    const callsG = p.findAllLocalizationCalls('i18n.t("hello")', ['G']);
    assert.strictEqual(callsG.length, 0);
  });

  test('optional chaining captured and filtered', async () => {
    const MockParser = function (this: any) { this.setLanguage = () => {}; this.parse = (_text: string) => ({ rootNode: {} }); } as any;
    const MockQuery = function (this: any) { this.captures = (_: any) => [
      { name: 'func-name', node: { text: 't', startIndex: 0 } },
      // foo?.i18n?.t("hello") -> '(' at 12, inside starts at 13, closing ')' at 20
      { name: 'args', node: { startIndex: 13, endIndex: 20 } },
    ]; } as any;
    const MockWTS = {
      init: async () => {},
      Language: { load: async (url: string) => { return {}; } },
      Parser: MockParser,
      Query: MockQuery,
    };

    const { TreeSitterSourceParser } = require('../../parsers/treeSitterSourceParser') as any;

    const p = new TreeSitterSourceParser('javascript', MockWTS);
    try {
      await (p as any).init();
    } catch (e) {
      assert.fail('init failed: ' + String(e));
    }

    const callsT = p.findAllLocalizationCalls('foo?.i18n?.t("hello")', ['t']);
    assert.strictEqual(callsT.length, 1);
    assert.strictEqual(callsT[0].funcName, 't');

    const callsG = p.findAllLocalizationCalls('foo?.i18n?.t("hello")', ['G']);
    assert.strictEqual(callsG.length, 0);
  });

  test('init failure leaves parser unready and throws on use', async () => {
    // Mock web-tree-sitter where init throws
    const MockWTS = {
      init: async () => { throw new Error('no wts'); },
    };
    const { TreeSitterSourceParser } = require('../../parsers/treeSitterSourceParser') as any;

    const p = new TreeSitterSourceParser('csharp', MockWTS);
    // await initPromise to allow constructor's init to run
    try { await (p as any).initPromise; } catch (_) { /* ignored */ }

    assert.throws(() => p.findAllLocalizationCalls('G("x")'), /Tree-sitter parser not ready/);
  });

  test('uses configured CDN base URL for loading wasm', async () => {
    let loadedUrl: string | null = null;
    const MockParser = function (this: any) { this.setLanguage = () => {}; this.parse = (_: string) => ({ rootNode: {} }); } as any;
    const MockQuery = function (this: any) { this.captures = (_: any) => []; } as any;
    const MockWTS = {
      init: async () => {},
      Language: {
        load: async (url: string) => { loadedUrl = url; return {}; },
      },
      Parser: MockParser,
      Query: MockQuery,
    };
    const MockVscode = {
      workspace: {
        getConfiguration: () => ({ get: (_k: string) => 'https://example.com/' }),
      },
    };

    const { TreeSitterSourceParser } = require('../../parsers/treeSitterSourceParser') as any;

    const p = new TreeSitterSourceParser('csharp', MockWTS, MockVscode);
    try {
      await (p as any).init();
    } catch (e) {
      assert.fail('init failed: ' + String(e));
    }
    assert.ok(typeof loadedUrl === 'string' && (loadedUrl as string).startsWith('https://example.com/'));
  });

  test('unsupported language results in not-ready parser', async () => {
    const { TreeSitterSourceParser } = require('../../parsers/treeSitterSourceParser') as any;

    const p = new TreeSitterSourceParser('no-such-lang');
    assert.throws(() => p.findAllLocalizationCalls('G("x")'), /Tree-sitter parser not ready/);
  });

  test('csharp member_access captured and filtered', async () => {
    const MockParser = function (this: any) { this.setLanguage = () => {}; this.parse = (_text: string) => ({ rootNode: {} }); } as any;
    const MockQuery = function (this: any) { this.captures = (_: any) => [
      { name: 'func-name', node: { text: 'GetString', startIndex: 0 } },
      // localizer.GetString("hello") -> '(' at 19, inside starts at 20, closing ')' at 27
      { name: 'args', node: { startIndex: 20, endIndex: 27 } },
    ]; } as any;
    const MockWTS = {
      init: async () => {},
      Language: { load: async (url: string) => { return {}; } },
      Parser: MockParser,
      Query: MockQuery,
    };

    const { TreeSitterSourceParser } = require('../../parsers/treeSitterSourceParser') as any;

    const p = new TreeSitterSourceParser('csharp', MockWTS);
    try {
      await (p as any).init();
    } catch (e) {
      assert.fail('init failed: ' + String(e));
    }

    const calls = p.findAllLocalizationCalls('localizer.GetString("hello")', ['GetString']);
    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0].funcName, 'GetString');
  });

  test('javascript plain call captured', async () => {
    const MockParser = function (this: any) { this.setLanguage = () => {}; this.parse = (_text: string) => ({ rootNode: {} }); } as any;
    const MockQuery = function (this: any) { this.captures = (_: any) => [
      { name: 'func-name', node: { text: 'G', startIndex: 0 } },
      { name: 'args', node: { startIndex: 2, endIndex: 9 } },
    ]; } as any;
    const MockWTS = {
      init: async () => {},
      Language: { load: async (url: string) => { return {}; } },
      Parser: MockParser,
      Query: MockQuery,
    };

    const { TreeSitterSourceParser } = require('../../parsers/treeSitterSourceParser') as any;

    const p = new TreeSitterSourceParser('javascript', MockWTS);
    try {
      await (p as any).init();
    } catch (e) {
      assert.fail('init failed: ' + String(e));
    }

    const calls = p.findAllLocalizationCalls('G("hello")', ['G']);
    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0].funcName, 'G');
  });

  test('typescript optional chaining captured and filtered', async () => {
    const MockParser = function (this: any) { this.setLanguage = () => {}; this.parse = (_text: string) => ({ rootNode: {} }); } as any;
    const MockQuery = function (this: any) { this.captures = (_: any) => [
      { name: 'func-name', node: { text: 't', startIndex: 0 } },
      // foo?.i18n?.t("hello") -> '(' at 12, inside starts at 13, closing ')' at 20
      { name: 'args', node: { startIndex: 13, endIndex: 20 } },
    ]; } as any;
    const MockWTS = {
      init: async () => {},
      Language: { load: async (url: string) => { return {}; } },
      Parser: MockParser,
      Query: MockQuery,
    };

    const { TreeSitterSourceParser } = require('../../parsers/treeSitterSourceParser') as any;

    const p = new TreeSitterSourceParser('typescript', MockWTS);
    try {
      await (p as any).init();
    } catch (e) {
      assert.fail('init failed: ' + String(e));
    }

    const callsT = p.findAllLocalizationCalls('foo?.i18n?.t("hello")', ['t']);
    assert.strictEqual(callsT.length, 1);
    assert.strictEqual(callsT[0].funcName, 't');

    const callsG = p.findAllLocalizationCalls('foo?.i18n?.t("hello")', ['G']);
    assert.strictEqual(callsG.length, 0);
  });

  test('python attribute and nested attribute captured', async () => {
    const MockParser = function (this: any) { this.setLanguage = () => {}; this.parse = (_text: string) => ({ rootNode: {} }); } as any;
    const MockQueryAttr = function (this: any) { this.captures = (_: any) => [
      { name: 'func-name', node: { text: 'translate', startIndex: 0 } },
      // obj.translate("hello") -> '(' at 13, inside starts at 14, closing ')' at 21
      { name: 'args', node: { startIndex: 14, endIndex: 21 } },
    ]; } as any;
    const MockQueryNested = function (this: any) { this.captures = (_: any) => [
      { name: 'func-name', node: { text: 'translate', startIndex: 0 } },
      // obj.attr.translate("hello") -> '(' at 18, inside starts at 19, closing ')' at 26
      { name: 'args', node: { startIndex: 19, endIndex: 26 } },
    ]; } as any;
    const MockWTSAttr = {
      init: async () => {},
      Language: { load: async (url: string) => { return {}; } },
      Parser: MockParser,
      Query: MockQueryAttr,
    };
    const MockWTSNested = {
      init: async () => {},
      Language: { load: async (url: string) => { return {}; } },
      Parser: MockParser,
      Query: MockQueryNested,
    };

    const { TreeSitterSourceParser } = require('../../parsers/treeSitterSourceParser') as any;

    const p1 = new TreeSitterSourceParser('python', MockWTSAttr);
    try { await (p1 as any).init(); } catch (e) { assert.fail('init failed: ' + String(e)); }
    const calls1 = p1.findAllLocalizationCalls('obj.translate("hello")', ['translate']);
    assert.strictEqual(calls1.length, 1);
    assert.strictEqual(calls1[0].funcName, 'translate');

    const p2 = new TreeSitterSourceParser('python', MockWTSNested);
    try { await (p2 as any).init(); } catch (e) { assert.fail('init failed: ' + String(e)); }
    const calls2 = p2.findAllLocalizationCalls('obj.attr.translate("hello")', ['translate']);
    assert.strictEqual(calls2.length, 1);
    assert.strictEqual(calls2[0].funcName, 'translate');
  });
});
