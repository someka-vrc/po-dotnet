import * as assert from 'assert';
import { normalizeTarget, normalizeTargets, DEFAULT_SETTINGS } from '../../models/settings';

suite('Settings model', () => {
  test('normalizeTarget fills defaults', () => {
    const raw: any = {};
    const t = normalizeTarget(raw);
    // defaults from DEFAULT_SETTINGS: languages => csharp, sourceDirs => ['.'] etc
    assert.ok(Array.isArray(t.languages));
    assert.ok(t.languages.length > 0);
    assert.ok(Array.isArray(t.sourceDirs));
    assert.ok(t.sourceDirs.length > 0);
    assert.ok(Array.isArray(t.poDirs));
    assert.ok(Array.isArray(t.funcNames));
  });

  test('normalizeTargets returns empty array for invalid input', () => {
    const t = normalizeTargets(undefined);
    assert.deepStrictEqual(t, []);
  });
});
