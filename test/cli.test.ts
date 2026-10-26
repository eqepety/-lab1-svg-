import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable, Writable } from 'node:stream';
import { Tokenizer } from '../src/cli/Tokenizer.js';
import { CommandDispatcher } from '../src/cli/CommandDispatcher.js';
import { Repl } from '../src/cli/Repl.js';
import { EditorSession } from '../src/application/EditorSession.js';
import { ShapeFactory } from '../src/application/ShapeFactory.js';
import { SvgDocument } from '../src/domain/SvgDocument.js';

function fixture(): { cli: CommandDispatcher; session: EditorSession } {
  const session = new EditorSession({
    async read() { return { document: new SvgDocument(), warnings: [] }; },
    async write() {},
  });
  return { cli: new CommandDispatcher(session, new ShapeFactory()), session };
}
test('tokenizer preserves colors, empty strings, quoted keywords and Windows paths', () => {
  const t = new Tokenizer();
  assert.deepEqual(t.tokenize('  # comment'), []);
  assert.deepEqual(t.tokenize('set r fill #ffffff').map(t => t.value), ['set', 'r', 'fill', '#ffffff']);
  assert.deepEqual(t.tokenize('set t text ""').at(-1), { value: '', quoted: true });
  assert.deepEqual(t.tokenize('create text t 0 0 "in"').at(-1), { value: 'in', quoted: true });
  assert.equal(t.tokenize(String.raw`read "C:\tmp\my file.svg"`).at(-1)?.value, String.raw`C:\tmp\my file.svg`);
  assert.equal(t.tokenize(String.raw`set t text "say \"hi\""`).at(-1)?.value, 'say "hi"');
  assert.throws(() => t.tokenize('set t text "bad'), /unterminated/);
  assert.throws(() => t.tokenize('set t text "a"b'), /unexpected text/);
});
test('help works before init, all other document operations enforce no-document error', async () => {
  const { cli } = fixture();
  const help = await cli.execute('help');
  for (const name of ['init', 'read', 'save', 'canvas', 'create', 'delete', 'move', 'scale', 'set', 'group', 'ungroup', 'addto', 'front', 'back', 'tree', 'show', 'undo', 'redo', 'help']) {
    assert.ok(help.some(line => line === name || line.startsWith(name + ' ')), name);
  }
  assert.deepEqual(await cli.execute('tree'), ["error: no document. use 'init' or 'read' first"]);
  assert.deepEqual(await cli.execute(''), []);
});
test('create suffix and text in keyword stay unambiguous', async () => {
  const { cli, session } = fixture();
  await cli.execute('init'); await cli.execute('create g scene');
  assert.deepEqual(await cli.execute('create text label 0 1 "in" in scene'), ['text#label created in g#scene']);
  await cli.execute('create text empty 0 0 ""');
  assert.equal(session.document().require('label').textContent(), 'in');
  assert.equal(session.document().require('empty').textContent(), '');
  assert.deepEqual(await cli.execute('create g bad in missing'), ['error: no such container: missing']);
  assert.deepEqual(await cli.execute('create g bad in label'), ['error: not a container: label']);
});
test('specified errors are exact and preserve state', async () => {
  const { cli, session } = fixture(); await cli.execute('init');
  await cli.execute('create rect r 10 20 30 40 #fff');
  for (const [command, expected] of [
    ['create circle r 0 0 1', 'id already exists: r'],
    ['move r9 1 1', 'no such shape: r9'],
    ['scale r 0', 'scale factor must be positive'],
    ['set r nope 1', 'unknown attribute: nope'],
    ['create box n 0 0 1 1 "x"', 'unknown shape type: box (is the plugin loaded?)'],
  ]) assert.deepEqual(await cli.execute(command!), ['error: ' + expected]);
  assert.equal(session.document().allShapes().length, 1);
  assert.equal(session.document().require('r').attribute('x'), '10');
});
test('tree includes geometry and parent; queries leave redo intact', async () => {
  const { cli } = fixture(); await cli.execute('init 400 300');
  await cli.execute('create g scene'); await cli.execute('create circle c 10 20 3 red in scene');
  const tree = (await cli.execute('tree')).join('\n');
  assert.match(tree, /svg \(400x300\)/); assert.match(tree, /└── g#scene/);
  assert.match(tree, /circle#c.*cx=10 cy=20 r=3.*fill=red/);
  assert.match((await cli.execute('show c')).join('\n'), /parent=g#scene/);
  await cli.execute('undo'); await cli.execute('canvas'); await cli.execute('help'); await cli.execute('tree');
  assert.deepEqual(await cli.execute('redo'), ['circle#c created in g#scene']);
});
test('bad arity, quoting and numeric syntax produce one error and allow subsequent commands', async () => {
  const { cli } = fixture(); await cli.execute('init');
  for (const command of ['move', 'undo extra', 'canvas 1', 'create rect r 0x10 1 2 3', 'set t text "bad', 'invalid']) {
    const result = await cli.execute(command);
    assert.equal(result.length, 1); assert.ok(result[0]?.startsWith('error: '));
  }
  assert.deepEqual(await cli.execute('create g ok'), ['g#ok created']);
});
test('REPL consumes piped scripts sequentially and keeps going after an error', async () => {
  const { cli } = fixture(); let transcript = '';
  const output = new Writable({ write(chunk, _encoding, done) { transcript += String(chunk); done(); } });
  await new Repl(cli, Readable.from(['init\ncreate g scene\nmove absent 1 1\ncreate text t 1 2 "开始" in scene\ntree\n']), output, false).run();
  assert.match(transcript, /svg-editor 0.1/);
  assert.match(transcript, /error: no such shape: absent/);
  assert.match(transcript, /text#t.*开始/);
});
