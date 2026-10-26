import { Shape } from './Shape.js';

export class Rect extends Shape {
  constructor(id: string, x: number, y: number, width: number, height: number) {
    super('rect', id, { x, y, width, height }, ['width', 'height']);
  }
  move(dx: number, dy: number): void { this.translate(dx, dy, ['x'], ['y']); }
  geometrySummary(): string {
    return `x=${this.number('x')} y=${this.number('y')} w=${this.number('width')} h=${this.number('height')}`;
  }
  clone(): Rect {
    const copy = new Rect(this.id, this.number('x'), this.number('y'), this.number('width'), this.number('height'));
    this.copyPresentationTo(copy);
    return copy;
  }
}
