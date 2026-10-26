import { Numeric } from '../domain/Numeric.js';
import type { Shape } from '../domain/Shape.js';

/** Positive uniform affine transform. SVG lists multiply left to right. */
export class SvgTransform {
  constructor(private readonly factor = 1, private readonly dx = 0, private readonly dy = 0) {
    Numeric.positive(factor, 'transform scale');
    Numeric.finite(dx, 'transform dx'); Numeric.finite(dy, 'transform dy');
  }

  static parse(source: string): SvgTransform {
    let result = new SvgTransform();
    let rest = source.trim();
    while (rest) {
      // Grammar recognition, not shape-name or command-name dispatch.
      const match = /^(?:translate\s*\(([^)]*)\)|scale\s*\(([^)]*)\))[\s,]*/u.exec(rest);
      if (!match) throw new Error(`unsupported SVG transform: ${rest}`);
      const numbers = (match[1] ?? match[2] ?? '').trim().split(/[\s,]+/u).filter(Boolean)
        .map(value => Numeric.parse(value, 'transform'));
      if (numbers.length < 1 || numbers.length > 2) throw new Error('transform expects one or two numbers');
      const first = numbers[0]!;
      if (match[1] !== undefined) result = result.compose(new SvgTransform(1, first, numbers[1] ?? 0));
      else {
        if (numbers[1] !== undefined && first !== numbers[1]) throw new Error('non-uniform SVG scale is not supported');
        result = result.compose(new SvgTransform(first));
      }
      rest = rest.slice(match[0].length);
    }
    return result;
  }

  compose(local: SvgTransform): SvgTransform {
    return new SvgTransform(
      this.factor * local.factor,
      this.dx + this.factor * local.dx,
      this.dy + this.factor * local.dy,
    );
  }

  apply(shape: Shape, effective: Readonly<Record<string, string>>): void {
    if (shape.asGroup()) return; // descendants receive the accumulated transform.
    shape.scale(this.factor); shape.move(this.dx, this.dy);
    if (this.factor === 1) return;
    if (/(?:^|;)\s*(?:font-size|stroke-width|vector-effect)\s*:/iu.test(effective['style'] ?? '')) {
      throw new Error('scaled SVG with CSS font-size/stroke-width/vector-effect is not supported');
    }
    if (effective['vector-effect'] !== 'non-scaling-stroke') {
      const width = Numeric.nonNegative(this.length(effective['stroke-width'] ?? '1', 'stroke-width'), 'stroke-width');
      shape.setAttribute('stroke-width', String(Numeric.finite(width * this.factor, 'stroke-width')));
    }
    if (shape.textContent() !== null) {
      const size = Numeric.nonNegative(this.length(effective['font-size'] ?? '16', 'font-size'), 'font-size');
      shape.importPresentation({ 'font-size': String(Numeric.finite(size * this.factor, 'font-size')) });
    }
  }

  private length(value: string, name: string): number { return Numeric.parse(value.trim().replace(/px$/u, ''), name); }
}
