import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SvgCodec } from '../src/infrastructure/SvgCodec.js';
import { ShapeFactory } from '../src/application/ShapeFactory.js';

const entry = fileURLToPath(new URL('../src/main.js', import.meta.url));
const examples = fileURLToPath(new URL('../../examples/', import.meta.url));
const codec = new SvgCodec(new ShapeFactory());
async function replay(script: string, cwd: string): Promise<string> {
  const child = spawn(process.execPath, [entry], { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
  let output = ''; let errors = '';
  child.stdout.setEncoding('utf8').on('data', chunk => { output += String(chunk); });
  child.stderr.setEncoding('utf8').on('data', chunk => { errors += String(chunk); });
  const done = new Promise<number | null>((resolve, reject) => {
    child.once('error', reject); child.once('close', resolve);
  });
  child.stdin.end(script);
  assert.equal(await done, 0, errors);
  assert.equal(errors, '');
  return output;
}
test('assignment transcript runs in a real process with exactly its two intentional errors', { timeout: 15000 }, async t => {
  const directory = await mkdtemp(join(tmpdir(), 'svg-transcript-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const script = (await readFile(join(examples, 'transcript.txt'), 'utf8'))
    .replace('read examples/other.svg', `read "${join(examples, 'other.svg')}"`);
  const output = await replay(script, directory);
  assert.deepEqual(output.split('\n').filter(line => line.startsWith('error:')), [
    'error: cannot group a container into its own descendant: markers',
    'error: undo not allowed after io command',
  ]);
  assert.match(output, /warning: assigned id rect1 to unnamed <rect>/);
  assert.match(output, /\(7 elements\)/);
  const doc = codec.decode(await readFile(join(directory, 'demo.svg'), 'utf8')).document;
  assert.equal(doc.allShapes().length, 5);
  assert.equal(doc.require('c1').attribute('cx'), '130');
  assert.equal(doc.require('title').textContent(), 'My Diagram');
  assert.equal(doc.parentLabel('box'), 'g#markers');
});
test('assignment two-node flowchart runs end-to-end and produces eight SVG elements', { timeout: 15000 }, async t => {
  const directory = await mkdtemp(join(tmpdir(), 'svg-flowchart-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(join(directory, 'examples'));
  const output = await replay(await readFile(join(examples, 'flowchart.txt'), 'utf8'), directory);
  assert.doesNotMatch(output, /^error:/mu);
  const doc = codec.decode(await readFile(join(directory, 'examples', 'flowchart.svg'), 'utf8')).document;
  assert.equal(doc.allShapes().length, 8);
  assert.equal(doc.require('process').attribute('y'), '100');
  assert.equal(doc.require('process-label').textContent(), '处理数据 v2');
  assert.equal(doc.parentLabel('arrow1'), 'g#flowchart');
  assert.equal(doc.require('arrow1').attribute('stroke'), 'black');
});
test('real CLI handles editing, IO barriers and recovery across EOF', { timeout: 15000 }, async t => {
  const directory = await mkdtemp(join(tmpdir(), 'svg-command-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const output = await replay([
    'help', 'init', 'create g scene', 'create g nested in scene',
    'create rect r 10 20 30 40 in nested', 'create circle c 1 2 3 in scene',
    'create ellipse e 1 2 3 4', 'create text t 0 1 ""', 'create line l 0 1 2 3 black',
    'set scene fill red', 'scale scene 2', 'move scene 0.5 -1',
    'group pair c nested', 'undo', 'redo', 'ungroup pair', 'undo',
    'addto scene l', 'front nested', 'back nested', 'show r', 'canvas', 'save out.svg',
    'undo', 'move r 1 1', 'undo', 'redo', 'save', 'read out.svg',
    'delete scene', 'undo', 'tree', '',
  ].join('\n'), directory);
  assert.deepEqual(output.split('\n').filter(line => line.startsWith('error:')), ['error: undo not allowed after io command']);
  assert.match(output, /text#t.*""/);
  assert.match(output, /rect#r.*x=21.5 y=40/);
});
