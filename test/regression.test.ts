import test from 'node:test';
import assert from 'node:assert/strict';
import { ShapeFactory } from '../src/application/ShapeFactory.js';
import { EditorSession } from '../src/application/EditorSession.js';
import { CommandDispatcher } from '../src/cli/CommandDispatcher.js';
import { SvgCodec } from '../src/infrastructure/SvgCodec.js';

const factory = new ShapeFactory();
const codec = new SvgCodec(factory);
test('root SVG id remains reserved for subsequent create and group commands', async () => {
  const doc = codec.decode('<svg xmlns="http://www.w3.org/2000/svg" id="canvas"><rect id="r"/></svg>').document;
  const s = new EditorSession({ async read() { return { document: doc, warnings: [] }; }, async write() {} });
  const cli = new CommandDispatcher(s, factory); await s.read('root.svg');
  assert.deepEqual(await cli.execute('create g canvas'), ['error: id already exists: canvas']);
  assert.deepEqual(await cli.execute('group canvas r'), ['error: id already exists: canvas']);
  assert.equal(s.document().allShapes().length, 1);
});
test('non-text leaves reject loose text rather than dropping it during save', () => {
  assert.throws(() => codec.decode('<svg xmlns="http://www.w3.org/2000/svg"><rect id="r">lost</rect></svg>'), /unexpected text/);
});
test('unknown box markers degrade to ordinary g without enabling create box', () => {
  const doc = codec.decode('<svg xmlns="http://www.w3.org/2000/svg"><g id="scene"><g id="n" data-kind="box"><rect id="r"/></g></g></svg>').document;
  assert.equal(doc.require('n').type, 'g');
  assert.equal(doc.require('n').attribute('data-kind'), 'box');
  assert.equal(doc.ungroup('n'), 1);
  assert.equal(doc.parentLabel('r'), 'g#scene');
  assert.throws(() => factory.create('box', 'b', []), /unknown shape type: box/);
});
