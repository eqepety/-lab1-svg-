import { Group } from './Group.js';
import { Numeric } from './Numeric.js';
import type { Shape } from './Shape.js';

export class SvgDocument {
  private rootNode = new Group('$document');
  private canvasWidth: number;
  private canvasHeight: number;
  private rootPresentation: Readonly<Record<string, string>> = {};

  constructor(width = 800, height = 600) {
    this.canvasWidth = Numeric.positive(width, 'canvas width');
    this.canvasHeight = Numeric.positive(height, 'canvas height');
  }
  get width(): number { return this.canvasWidth; }
  get height(): number { return this.canvasHeight; }
  children(): readonly Shape[] { return this.rootNode.children(); }
  rootAttributes(): Readonly<Record<string, string>> { return { ...this.rootPresentation }; }
  importRootAttributes(attrs: Readonly<Record<string, string>>): void { this.rootPresentation = { ...attrs }; }
  resize(width: number, height: number): void {
    Numeric.positive(width, 'canvas width'); Numeric.positive(height, 'canvas height');
    this.canvasWidth = width; this.canvasHeight = height;
  }
  allShapes(): readonly Shape[] { return this.descendants(this.rootNode); }
  find(id: string): Shape | undefined { return this.allShapes().find(shape => shape.id === id); }
  require(id: string): Shape {
    const shape = this.find(id);
    if (!shape) throw new Error(`no such shape: ${id}`);
    return shape;
  }
  requireGroup(id: string): Group {
    const shape = this.find(id);
    if (!shape) throw new Error(`no such container: ${id}`);
    const group = shape.asGroup();
    if (!group) throw new Error(`not a container: ${id}`);
    return group;
  }
  parentOf(id: string): Group {
    const shape = this.require(id);
    return this.parentOfShape(shape);
  }
  parentLabel(id: string): string {
    const parent = this.parentOf(id);
    return parent === this.rootNode ? 'svg' : parent.label;
  }
  add(shape: Shape, containerId?: string): void {
    const parent = containerId === undefined ? this.rootNode : this.requireGroup(containerId);
    const ids = new Set(this.allShapes().map(node => node.id));
    for (const node of [shape, ...this.descendants(shape)]) {
      if (ids.has(node.id)) throw new Error(`id already exists: ${node.id}`);
      ids.add(node.id);
    }
    parent.insert(shape);
  }
  delete(id: string): Shape {
    const shape = this.require(id);
    this.parentOfShape(shape).remove(shape);
    return shape;
  }
  group(id: string, selectedIds: readonly string[]): Group {
    if (this.find(id)) throw new Error(`id already exists: ${id}`);
    if (selectedIds.length === 0) throw new Error('group needs at least one shape');
    if (new Set(selectedIds).size !== selectedIds.length) throw new Error('duplicate shape in group selection');
    for (const selectedId of selectedIds) this.require(selectedId);
    const selected = this.allShapes().filter(shape => selectedIds.includes(shape.id));
    for (const shape of selected) {
      if (selected.some(other => other !== shape && shape.asGroup()?.contains(other))) {
        throw new Error(`cannot group a container into its own descendant: ${shape.id}`);
      }
    }
    const paths = selected.map(shape => this.pathToParent(shape));
    let parent = this.rootNode;
    for (let depth = 0; ; depth++) {
      const candidate = paths[0]?.[depth];
      if (!candidate || !paths.every(path => path[depth] === candidate)) break;
      parent = candidate;
    }
    const insertion = parent.children().findIndex(child => selected.some(shape => child === shape || child.asGroup()?.contains(shape)));
    const group = new Group(id);
    for (const shape of selected) { this.parentOfShape(shape).remove(shape); group.insert(shape); }
    parent.insert(group, insertion);
    return group;
  }
  ungroup(id: string): number {
    const group = this.requireGroup(id);
    const parent = this.parentOfShape(group);
    if (parent === this.rootNode) throw new Error(`cannot ungroup top-level container: ${id}`);
    const index = parent.children().indexOf(group);
    const children = group.children();
    parent.remove(group);
    children.forEach((shape, offset) => { group.remove(shape); parent.insert(shape, index + offset); });
    return children.length;
  }
  addTo(containerId: string, id: string): void {
    const target = this.requireGroup(containerId);
    const shape = this.require(id);
    if (shape === target || shape.asGroup()?.contains(target)) throw new Error(`cannot add a container into its own descendant: ${id}`);
    this.parentOfShape(shape).remove(shape);
    target.insert(shape);
  }
  reorder(id: string, front: boolean): void {
    const shape = this.require(id);
    const parent = this.parentOfShape(shape);
    parent.remove(shape);
    parent.insert(shape, front ? parent.children().length : 0);
  }
  clone(): SvgDocument {
    const copy = new SvgDocument(this.width, this.height);
    copy.rootNode = this.rootNode.clone();
    copy.rootPresentation = { ...this.rootPresentation };
    return copy;
  }
  private descendants(shape: Shape): Shape[] {
    return shape.children().flatMap(child => [child, ...this.descendants(child)]);
  }
  private parentOfShape(shape: Shape): Group {
    const parent = [this.rootNode, ...this.allShapes().flatMap(node => node.asGroup() ?? [])]
      .find(group => group.children().includes(shape));
    if (!parent) throw new Error(`no parent for shape: ${shape.id}`);
    return parent;
  }
  private pathToParent(shape: Shape): Group[] {
    const parent = this.parentOfShape(shape);
    return parent === this.rootNode ? [parent] : [...this.pathToParent(parent), parent];
  }
}
