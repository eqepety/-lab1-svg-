import { Shape } from './Shape.js';

export class Circle extends Shape {
  constructor(id: string, cx: number, cy: number, r: number) { super('circle', id, { cx, cy, r }, ['r']); }
  move(dx: number, dy: number): void { this.translate(dx, dy, ['cx'], ['cy']); }
  geometrySummary(): string { return `cx=${this.number('cx')} cy=${this.number('cy')} r=${this.number('r')}`; }
  clone(): Circle {
    const copy = new Circle(this.id, this.number('cx'), this.number('cy'), this.number('r'));
    this.copyPresentationTo(copy);
    return copy;
  }
}
