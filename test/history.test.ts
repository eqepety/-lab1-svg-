import test from 'node:test';
import assert from 'node:assert/strict';
import { EditorSession } from '../src/application/EditorSession.js';
import { ShapeFactory } from '../src/application/ShapeFactory.js';
import type { SvgStore } from '../src/application/SvgStore.js';
import type { EditCommand } from '../src/application/EditCommand.js';
import { CreateCommand } from '../src/application/commands/CreateCommand.js';
import { MoveCommand } from '../src/application/commands/MoveCommand.js';
import { ScaleCommand } from '../src/application/commands/ScaleCommand.js';
import { DeleteCommand } from '../src/application/commands/DeleteCommand.js';
import { SetCommand } from '../src/application/commands/SetCommand.js';
import { GroupCommand } from '../src/application/commands/GroupCommand.js';
import { UngroupCommand } from '../src/application/commands/UngroupCommand.js';
import { AddToCommand } from '../src/application/commands/AddToCommand.js';
import { FrontCommand } from '../src/application/commands/FrontCommand.js';
import { BackCommand } from '../src/application/commands/BackCommand.js';
import { SvgDocument } from '../src/domain/SvgDocument.js';

const factory = new ShapeFactory();
const store: SvgStore = {
  async read() { return { document: new SvgDocument(400, 300), warnings: [] }; },
  async write() {},
};
function session(): EditorSession { const s = new EditorSession(store); s.init(); return s; }
function create(s: EditorSession, type: string, id: string, values: string[] = [], parent?: string): void {
  s.edit(new CreateCommand(factory, type, id, values, parent));
}
function view(s: EditorSession): string {
  return JSON.stringify(s.document().allShapes().map(shape => ({
    attrs: shape.attributes(), text: shape.textContent(), parent: s.document().parentLabel(shape.id),
  })));
}

test('undo/redo snapshots restore geometry exactly and new edits discard redo', () => {
  const s = session(); create(s, 'rect', 'r', ['0.1', '2', '3', '4']);
  s.edit(new MoveCommand('r', 0.2, 0)); s.undo();
  assert.equal(s.document().require('r').attribute('x'), '0.1');
  s.redo(); s.undo();
  s.edit(new SetCommand('r', 'fill', 'red'));
  assert.throws(() => s.redo(), /nothing to redo/);
});

test('failed nested operations publish neither partial document nor history', () => {
  const s = session(); create(s, 'g', 'g');
  create(s, 'circle', 'a', ['1', '1', '1'], 'g');
  create(s, 'circle', 'b', ['1e308', '1', '1'], 'g');
  const before = view(s);
  assert.throws(() => s.edit(new MoveCommand('g', 1e308, 0)), /finite/);
  assert.equal(view(s), before);
  s.undo();
  assert.equal(s.document().find('b'), undefined);
});

test('each structural edit is one undo unit preserving parent and exact z-order', () => {
  const commands: EditCommand[] = [
    new DeleteCommand('g'), new GroupCommand('pair', ['b', 'a']),
    new UngroupCommand('nested'), new AddToCommand('g', 'c'),
    new FrontCommand('a'), new BackCommand('b'), new ScaleCommand('g', 1.5),
  ];
  for (const command of commands) {
    const s = session(); create(s, 'g', 'g'); create(s, 'g', 'nested', [], 'g');
    create(s, 'rect', 'a', ['1', '2', '3', '4'], 'nested');
    create(s, 'circle', 'b', ['5', '6', '7'], 'nested');
    create(s, 'text', 'c', ['10', '20', '开始']);
    const before = view(s); s.edit(command); const after = view(s);
    assert.notEqual(after, before);
    s.undo(); assert.equal(view(s), before);
    s.redo(); assert.equal(view(s), after);
  }
});

test('failed edit after undo keeps redo; failed edit does not unlock IO barrier', () => {
  const s = session();
  assert.throws(() => s.edit(new CreateCommand(factory, 'box', 'n', [])), /unknown shape type: box/);
  assert.throws(() => s.undo(), /undo not allowed after io command/);
  create(s, 'rect', 'a', ['0', '0', '1', '1']); s.undo();
  assert.throws(() => s.edit(new MoveCommand('missing', 1, 1)), /no such shape/);
  s.redo(); assert.ok(s.document().find('a'));
});

test('IO barriers only apply on success; save remembers its path', async () => {
  let fail = true;
  let lastPath = '';
  const s = new EditorSession({
    async read() { if (fail) throw new Error('cannot read file: bad.svg'); return store.read('ok'); },
    async write(_doc, path) { if (fail) throw new Error('cannot write file: bad.svg'); lastPath = path; },
  });
  s.init(); create(s, 'g', 'g');
  await assert.rejects(s.read('bad.svg')); await assert.rejects(s.save('bad.svg'));
  s.undo(); assert.equal(s.document().find('g'), undefined); s.redo();
  fail = false; await s.save('ok.svg');
  assert.throws(() => s.undo(), /undo not allowed after io command/);
  create(s, 'g', 'h'); await s.save(); assert.equal(lastPath, 'ok.svg');
  await s.read('other.svg'); assert.equal(s.document().width, 400);
  assert.throws(() => s.redo(), /undo not allowed after io command/);
});

test('invalid init/resize leave old document and history intact', () => {
  const s = session(); create(s, 'g', 'g');
  assert.throws(() => s.init(-1, 2)); assert.throws(() => s.resize(1, 0));
  assert.ok(s.document().find('g')); s.undo(); assert.equal(s.document().find('g'), undefined);
  s.resize(100, 200); assert.throws(() => s.undo(), /io command/);
});

test('factory defaults, text content and optional style follow SVG semantics', () => {
  assert.equal(factory.create('rect', 'r', ['0', '0', '1', '1']).attribute('fill'), undefined);
  assert.equal(factory.create('line', 'l', ['0', '0', '1', '1', 'black']).attribute('stroke'), 'black');
  assert.equal(factory.create('text', 't', ['0', '1', '']).textContent(), '');
  assert.equal(factory.fromSvg('circle', 'c', {}, '').attribute('r'), '0');
  assert.throws(() => factory.create('g', 'g', ['extra']), /expects/);
});

test('uninitialized session reports the specified no-document error', () => {
  const s = new EditorSession(store);
  assert.throws(() => s.undo(), /no document. use 'init' or 'read' first/);
  assert.throws(() => s.edit(new MoveCommand('r', 1, 2)), /no document/);
});
