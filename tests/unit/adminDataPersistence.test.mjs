import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { getBuddyOption } from '../../src/data/buddies.ts';

const source = readFileSync(new URL('../../src/context/AdminDataContext.tsx', import.meta.url), 'utf8');
const sourceFile = ts.createSourceFile('AdminDataContext.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const helper = sourceFile.statements.find((statement) => (
  ts.isFunctionDeclaration(statement)
  && statement.name?.text === 'persistContentMutation'
));

if (!helper) throw new Error('persistContentMutation helper was not found.');

const javascript = ts.transpile(helper.getText(sourceFile), {
  module: ts.ModuleKind.CommonJS,
  target: ts.ScriptTarget.ES2022,
});
const helperModule = { exports: {} };
vm.runInNewContext(javascript, { module: helperModule, exports: helperModule.exports });
const { persistContentMutation } = helperModule.exports;

test('maps stored profile Buddy IDs to the shared Player avatar catalog', () => {
  assert.equal(getBuddyOption('Cat')?.emoji, '🐱');
  assert.equal(getBuddyOption('Bear')?.emoji, '🐻');
  assert.equal(getBuddyOption('Unknown'), null);
});

test('reports save failure and does not attempt catalog refresh', async () => {
  const saveError = new Error('write rejected');
  let saveCalls = 0;
  let refreshCalls = 0;

  const result = await persistContentMutation(async () => {
    saveCalls += 1;
    throw saveError;
  }, async () => {
    refreshCalls += 1;
  });

  assert.equal(result.status, 'save_failed');
  assert.equal(result.error, saveError);
  assert.equal(saveCalls, 1);
  assert.equal(refreshCalls, 0);
});

test('reports save and refresh success', async () => {
  let saveCalls = 0;
  let refreshCalls = 0;

  const result = await persistContentMutation(async () => {
    saveCalls += 1;
  }, async () => {
    refreshCalls += 1;
  });

  assert.equal(result.status, 'saved_and_refreshed');
  assert.equal(saveCalls, 1);
  assert.equal(refreshCalls, 1);
});

test('reports saved data when catalog refresh fails without retrying the save', async () => {
  const refreshError = new Error('catalog unavailable');
  let saveCalls = 0;
  let refreshCalls = 0;

  const result = await persistContentMutation(async () => {
    saveCalls += 1;
  }, async () => {
    refreshCalls += 1;
    throw refreshError;
  });

  assert.equal(result.status, 'saved_refresh_failed');
  assert.equal(result.error, refreshError);
  assert.equal(saveCalls, 1);
  assert.equal(refreshCalls, 1);
});