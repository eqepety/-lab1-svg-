import { Numeric } from './Numeric.js';
import { Shape } from './Shape.js';

export class Group extends Shape {
  private readonly nodes: Shape[] = [];
  constructor(id: string) { super('g', id, {}); }
  override children(): readonly Shape[] { return [...this.nodes]; }
  override asGroup(): Group { return this; }
  geometrySummary(): string { return ''; }
  contains(shape: Shape): boolean { return this.nodes.some(child => child === shape || child.asGroup()?.contains(shape)); }
  insert(shape: Shape, index = this.nodes.length): void {
    if (shape === this || shape.asGroup()?.contains(this)) throw new Error(`cannot add a container into its own descendant: ${shape.id}`);
    if (this.contains(shape)) throw new Error(`shape already in container: ${shape.id}`);
    this.nodes.splice(index, 0, shape);
  }
  remove(shape: Shape): void {
    const index = this.nodes.indexOf(shape);
    if (index < 0) throw new Error(`shape is not a direct child: ${shape.id}`);
    this.nodes.splice(index, 1);
  }
  move(dx: number, dy: number): void {
    Numeric.finite(dx, 'dx'); Numeric.finite(dy, 'dy');
    for (const child of this.nodes) child.move(dx, dy);
  }
  override scale(factor: number): void {
    Numeric.positive(factor, 'scale factor');
    for (const child of this.nodes) child.scale(factor);
  }
  clone(): Group {
    const copy = new Group(this.id);
    this.copyPresentationTo(copy);
    for (const child of this.nodes) copy.insert(child.clone());
    return copy;
  }
}
