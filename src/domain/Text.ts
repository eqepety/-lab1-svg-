import { Shape } from './Shape.js';

export class Text extends Shape {
  constructor(id: string, x: number, y: number, private content: string) { super('text', id, { x, y }); }
  move(dx: number, dy: number): void { this.translate(dx, dy, ['x'], ['y']); }
  override setAttribute(name: string, value: string): void {
    if (name === 'text') this.content = value;
    else super.setAttribute(name, value);
  }
  override textContent(): string { return this.content; }
  override attribute(name: string): string | undefined { return name === 'text' ? this.content : super.attribute(name); }
  geometrySummary(): string { return `(${this.number('x')},${this.number('y')}) ${JSON.stringify(this.content)}`; }
  clone(): Text {
    const copy = new Text(this.id, this.number('x'), this.number('y'), this.content);
    this.copyPresentationTo(copy);
    return copy;
  }
}
