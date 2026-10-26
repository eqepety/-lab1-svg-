import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ShapeFactory } from '../src/application/ShapeFactory.js';
import { EditorSession } from '../src/application/EditorSession.js';
import { CommandDispatcher } from '../src/cli/CommandDispatcher.js';
import { SvgCodec } from '../src/infrastructure/SvgCodec.js';
import { FileSvgStore } from '../src/infrastructure/FileSvgStore.js';
import { SvgDocument } from '../src/domain/SvgDocument.js';

const factory = new ShapeFactory();
const codec = new SvgCodec(factory);
const svg = (body: string, attrs = '') => `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" ${attrs}>${body}</svg>`;
function view(document: SvgDocument): unknown {
  return { width: document.width, height: document.height, root: document.rootAttributes(),
    shapes: document.allShapes().map(shape => ({ type: shape.type, attrs: shape.attributes(), text: shape.textContent(), parent: document.parentLabel(shape.id) })) };
}
test('all types, nested groups, Unicode, XML escaping and default appearance round-trip', () => {
  const source = svg(`<g id="g" fill="red"><rect id="r" x="1" y="2" width="3" height="4"/>
    <circle id="c" cx="5" cy="6" r="7"/><ellipse id="e" cx="1" cy="2" rx="3" ry="4"/>
    <line id="l" x1="1" y1="2" x2="3" y2="4" stroke="black"/>
    <g id="nested"><text id="t" x="2" y="3" text-anchor="middle" font-size="16">开始 &amp; &lt;end&gt; "hi"</text></g></g>`);
  const first = codec.decode(source).document;
  assert.equal(first.require('r').attribute('fill'), undefined);
  const encoded = codec.encode(first);
  assert.match(encoded, /&amp;/); assert.match(encoded, /&lt;end&gt;/);
  const second = codec.decode(encoded);
  assert.deepEqual(view(second.document), view(first));
  assert.equal(second.document.require('t').textContent(), '开始 & <end> "hi"');
  assert.equal(second.document.require('t').attribute('text-anchor'), 'middle');
});
test('missing ids skip all explicit ids, including later declarations and root id', () => {
  const result = codec.decode(svg('<rect/><rect id="rect1"/><rect/><g><circle/><circle id="circle1"/></g>', 'id="g1"'));
  assert.deepEqual(result.warnings, [
    'warning: assigned id rect2 to unnamed <rect>',
    'warning: assigned id rect3 to unnamed <rect>',
    'warning: assigned id g2 to unnamed <g>',
    'warning: assigned id circle2 to unnamed <circle>',
  ]);
  assert.equal(new Set(result.document.allShapes().map(s => s.id)).size, 6);
});
test('duplicate ids, malformed XML, unsupported elements and nesting fail explicitly', () => {
  for (const source of [
    svg('<rect id="r"/><g id="r"/>'),
    '<svg><g></svg>',
    '<svg><rect id=r/></svg>',
    svg('<polygon id="p"/>'),
    svg('<rect id="r"><circle id="c"/></rect>'),
    svg('<g id="g">loose text</g>'),
    svg('<g xmlns="urn:other" id="g"/>'),
    svg('', 'viewBox="0 0 100 100"'),
    '<!DOCTYPE svg><svg xmlns="http://www.w3.org/2000/svg"/>',
  ]) assert.throws(() => codec.decode(source), source);
});
test('px lengths normalize; finite and nonnegative geometry is enforced', () => {
  const doc = codec.decode(svg('<rect id="r" x="1px" width="2px" stroke-width="3px"/>')).document;
  assert.equal(doc.require('r').attribute('x'), '1'); assert.equal(doc.require('r').attribute('stroke-width'), '3');
  assert.throws(() => codec.decode(svg('<circle id="c" r="-1"/>')), /non-negative/);
  assert.throws(() => codec.decode(svg('<rect id="r" width="NaN"/>')), /invalid number/);
});
test('nested translate/scale normalize geometry and rendering metrics', () => {
  const doc = codec.decode(svg(`<g id="diagram" transform="translate(60,40)">
    <g id="nodeB" transform="translate(200,0) scale(0.8)">
      <rect id="r" x="0" y="0" width="120" height="60" fill="#f5a623"/>
      <text id="t" x="60" y="38" text-anchor="middle" font-size="16">End</text>
    </g></g>`)).document;
  const rect = doc.require('r');
  assert.equal(rect.attribute('x'), '260'); assert.equal(rect.attribute('y'), '40');
  assert.equal(rect.attribute('width'), '96');
  assert.equal(doc.require('t').attribute('x'), '308');
  assert.equal(doc.require('t').attribute('font-size'), '12.8');
  assert.equal(doc.require('nodeB').attribute('transform'), undefined);
  const before = view(doc); assert.deepEqual(view(codec.decode(codec.encode(doc)).document), before);
  doc.require('nodeB').move(10, 20); assert.equal(doc.require('r').attribute('x'), '270');
});
test('transform multiplication order and inherited font/stroke metrics match SVG', () => {
  const doc = codec.decode(svg('<g id="g" transform="scale(2) translate(5,3)"><text id="t" x="1" y="1">x</text></g>', 'font-size="14" stroke-width="2"')).document;
  assert.equal(doc.require('t').attribute('x'), '12'); assert.equal(doc.require('t').attribute('y'), '8');
  assert.equal(doc.require('t').attribute('font-size'), '28');
  assert.equal(doc.require('t').attribute('stroke-width'), '4');
  const vector = codec.decode(svg('<line id="l" stroke-width="2" vector-effect="non-scaling-stroke" transform="scale(2)"/>')).document;
  assert.equal(vector.require('l').attribute('stroke-width'), '2');
});
test('unsupported transforms and ambiguous CSS metrics are rejected, not silently dropped', () => {
  for (const transform of ['rotate(20)', 'matrix(1 0 0 1 0 0)', 'scale(2,3)', 'scale(-1)', 'translate()', 'translate(1) garbage']) {
    assert.throws(() => codec.decode(svg(`<rect id="r" transform="${transform}"/>`)));
  }
  assert.throws(() => codec.decode(svg('<text id="t" style="font-size:2em" transform="scale(2)">x</text>')), /CSS/);
});
test('real file save/read supports spaced paths and atomic replacement', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'svg-io-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = new FileSvgStore(codec); const path = join(directory, '有 空格.svg');
  const doc = codec.decode(svg('<rect id="r" width="3"/>')).document;
  await store.write(doc, path);
  assert.deepEqual(view((await store.read(path)).document), view(doc));
  doc.require('r').move(4, 5); await store.write(doc, path);
  assert.equal((await store.read(path)).document.require('r').attribute('x'), '4');
  assert.deepEqual(await readdir(directory), ['有 空格.svg']);
});
test('file errors and partial import retain document, history and save path', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'svg-failure-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const s = new EditorSession(new FileSvgStore(codec)); const cli = new CommandDispatcher(s, factory);
  await cli.execute('init'); await cli.execute('create g old');
  const bad = join(directory, 'bad.svg');
  await writeFile(bad, svg('<rect/><circle id="bad" r="-1"/>'));
  const result = await cli.execute(`read "${bad}"`);
  assert.equal(result.length, 1); assert.ok(result[0]?.startsWith('error: '));
  assert.ok(s.document().find('old')); s.undo(); assert.equal(s.document().find('old'), undefined); s.redo();
  await assert.rejects(s.save(join(directory, 'missing', 'new.svg')), /cannot write file/);
  assert.deepEqual(await readdir(directory), ['bad.svg']);
  s.undo(); assert.equal(s.document().find('old'), undefined);
  await assert.rejects(s.read(join(directory, 'absent.svg')), /cannot read file/);
});
test('read path becomes implicit save target and successful save locks undo', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'svg-session-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, 'drawing.svg'); await writeFile(path, svg('<circle id="c"/>'));
  const s = new EditorSession(new FileSvgStore(codec)); const cli = new CommandDispatcher(s, factory);
  await s.read(path); await cli.execute('move c 3 4'); await s.save();
  assert.equal(codec.decode(await readFile(path, 'utf8')).document.require('c').attribute('cx'), '3');
  assert.throws(() => s.undo(), /undo not allowed after io command/);
});
