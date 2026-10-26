import { Shape } from './Shape.js';

export class Ellipse extends Shape {
  constructor(id: string, cx: number, cy: number, rx: number, ry: number) { super('ellipse', id, { cx, cy, rx, ry }, ['rx', 'ry']); }
  move(dx: number, dy: number): void { this.translate(dx, dy, ['cx'], ['cy']); }
  geometrySummary(): string {
    return `cx=${this.number('cx')} cy=${this.number('cy')} rx=${this.number('rx')} ry=${this.number('ry')}`;
  }
  clone(): Ellipse {
    const copy = new Ellipse(this.id, this.number('cx'), this.number('cy'), this.number('rx'), this.number('ry'));
    this.copyPresentationTo(copy);
    return copy;
  }
}
