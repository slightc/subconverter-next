const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

// Compile the TypeScript parser in memory so tests can run with Node alone.
const source = fs.readFileSync(path.join(__dirname, '../src/lib/parsers/ruleset.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const moduleUnderTest = { exports: {} };
new Function('require', 'module', 'exports', compiled)(
  (id) => {
    if (id === '../utils/fetch') return { fetchText: async () => '' };
    throw new Error(`Unexpected dependency: ${id}`);
  },
  moduleUnderTest,
  moduleUnderTest.exports
);
const { parseRulesetContent, loadAllRulesets } = moduleUnderTest.exports;

test('preserves AND rule with nested commas from YAML list', () => {
  assert.deepEqual(
    parseRulesetContent('# QUIC\\n- AND,((NETWORK,UDP),(DST-PORT,443))', '🔗 QUIC'),
    ['AND,((NETWORK,UDP),(DST-PORT,443)),🔗 QUIC']
  );
});

test('preserves nested OR and NOT logical expressions', () => {
  assert.deepEqual(
    parseRulesetContent('OR,((NETWORK,TCP),(AND,((NETWORK,UDP),(DST-PORT,443))))\\nNOT,((NETWORK,UDP))', 'REJECT'),
    [
      'OR,((NETWORK,TCP),(AND,((NETWORK,UDP),(DST-PORT,443)))),REJECT',
      'NOT,((NETWORK,UDP)),REJECT',
    ]
  );
});

test('supports quoted YAML entries and case insensitive logical types', () => {
  assert.deepEqual(
    parseRulesetContent("- 'and,((NETWORK,UDP),(DST-PORT,443))'", 'REJECT'),
    ['AND,((NETWORK,UDP),(DST-PORT,443)),REJECT']
  );
});

test('does not change existing domain and IP rules', () => {
  assert.deepEqual(
    parseRulesetContent('example.com\\nDOMAIN-SUFFIX,example.org\\nIP-CIDR,10.0.0.0/8', 'DIRECT'),
    [
      'DOMAIN-SUFFIX,example.com,DIRECT',
      'DOMAIN-SUFFIX,example.org,DIRECT',
      'IP-CIDR,10.0.0.0/8,DIRECT,no-resolve',
    ]
  );
});

test('skips unknown rules and malformed logical expressions', () => {
  assert.deepEqual(parseRulesetContent('UNKNOWN,value\\nAND,NETWORK,UDP', 'REJECT'), []);
});

test('supports inline logical rules in ACL4SSR config', async () => {
  assert.deepEqual(
    await loadAllRulesets([{ group: '🔗 QUIC', ruleset: '[]AND,((NETWORK,UDP),(DST-PORT,443))' }]),
    ['AND,((NETWORK,UDP),(DST-PORT,443)),🔗 QUIC']
  );
});
