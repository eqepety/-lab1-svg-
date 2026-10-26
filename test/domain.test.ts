import test from 'node:test';
import assert from 'node:assert/strict';
import { Rect } from '../src/domain/Rect.js';
import { Circle } from '../src/domain/Circle.js';
import { Ellipse } from '../src/domain/Ellipse.js';
import { Line } from '../src/domain/Line.js';
import { Text } from '../src/domain/Text.js';
import { Group } from '../src/domain/Group.js';
import { SvgDocument } from '../src/domain/SvgDocument.js';

test('all six types clone independently, move and scale geometry polymorphically', () => {
  const group = new Group('scene');
  group.insert(new Rect('r', 10, 20, 100, 50));
  group.insert(new Circle('c', 10, 20, 3));
  group.insert(new Ellipse('e', 10, 20, 3, 4));
  group.insert(new Line('l', 10, 20, 30, 40));
  group.insert(new Text('t', 10, 20, '开始'));
  const copy = group.clone();
  copy.move(5, -2); copy.scale(2);
  assert.equal(copy.children()[0]?.attribute('x'), '30');
  assert.equal(copy.children()[0]?.attribute('width'), '200');
  assert.equal(copy.children()[1]?.attribute('cx'), '30');
  assert.equal(copy.children()[2]?.attribute('ry'), '8');
  assert.equal(copy.children()[3]?.attribute('x2'), '70');
  assert.equal(copy.children()[4]?.attribute('text'), '开始');
  assert.equal(group.children()[0]?.attribute('x'), '10');
});

test('attributes validate geometry and whitelist; default appearance stays absent', () => {
  const rect = new Rect('r', 0, 0, 2, 3);
  assert.equal(rect.attribute('fill'), undefined);
  rect.setAttribute('fill', '#ffffff');
  assert.throws(() => rect.setAttribute('id', 'other'), /unknown attribute: id/);
  for (const value of ['NaN', 'Infinity', '-1', '0x10', '']) {
    assert.throws(() => rect.setAttribute('width', value));
    assert.equal(rect.attribute('width'), '2');
  }
  assert.throws(() => rect.scale(0), /scale factor must be positive/);
  assert.throws(() => rect.move(Infinity, 0), /finite/);
});

test('document enforces globally unique case-sensitive ids and nested deletion', () => {
  const doc = new SvgDocument();
  doc.add(new Group('g')); doc.add(new Rect('r', 0, 0, 1, 1), 'g');
  assert.throws(() => doc.add(new Circle('r', 0, 0, 1)), /id already exists: r/);
  doc.add(new Circle('R', 0, 0, 1));
  assert.equal(doc.parentLabel('r'), 'g#g');
  const copy = doc.clone(); copy.delete('g');
  assert.equal(copy.find('r'), undefined);
  assert.ok(doc.find('r'));
});

test('group preserves document order; ungroup keeps slot and forbids top-level', () => {
  const doc = new SvgDocument(); doc.add(new Group('scene'));
  for (const id of ['a', 'b', 'c', 'd']) doc.add(new Rect(id, 0, 0, 1, 1), 'scene');
  doc.group('pair', ['c', 'a']);
  assert.deepEqual(doc.requireGroup('pair').children().map(s => s.id), ['a', 'c']);
  assert.deepEqual(doc.requireGroup('scene').children().map(s => s.id), ['pair', 'b', 'd']);
  doc.ungroup('pair');
  assert.deepEqual(doc.requireGroup('scene').children().map(s => s.id), ['a', 'c', 'b', 'd']);
  assert.throws(() => doc.ungroup('scene'), /cannot ungroup top-level container: scene/);
});

test('cross-parent grouping uses LCA; cycles are rejected without mutation', () => {
  const doc = new SvgDocument();
  for (const id of ['left', 'right']) doc.add(new Group(id));
  doc.add(new Circle('a', 0, 0, 1), 'left'); doc.add(new Circle('b', 0, 0, 1), 'right');
  assert.throws(() => doc.group('bad', ['a', 'left']), /cannot group a container into its own descendant: left/);
  doc.group('pair', ['b', 'a']);
  assert.deepEqual(doc.children().map(s => s.id), ['pair', 'left', 'right']);
  assert.throws(() => doc.addTo('pair', 'pair'), /descendant/);
  assert.equal(doc.parentLabel('a'), 'g#pair');
});

test('z-order and reparenting are sibling-local', () => {
  const doc = new SvgDocument(); doc.add(new Group('g'));
  for (const id of ['a', 'b', 'c']) doc.add(new Circle(id, 0, 0, 1));
  doc.reorder('a', true);
  assert.deepEqual(doc.children().map(s => s.id), ['g', 'b', 'c', 'a']);
  doc.reorder('a', false); doc.addTo('g', 'a');
  assert.equal(doc.parentLabel('a'), 'g#g');
  assert.throws(() => doc.addTo('a', 'b'), /not a container: a/);
});
