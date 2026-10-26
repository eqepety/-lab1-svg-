import { Numeric } from './Numeric.js';
import type { Group } from './Group.js';

export abstract class Shape {
  private readonly values = new Map<string, number>();
  private readonly appearance = new Map<string, string>();
  private readonly extra = new Map<string, string>();

  protected constructor(
    private readonly shapeType: string,
    private readonly shapeId: string,
    geometry: Readonly<Record<string, number>>,
    private readonly nonNegativeKeys: readonly string[] = [],
  ) {
    if (!shapeId || /\s/u.test(shapeId)) throw new Error('id must be non-empty and contain no whitespace');
    for (const [key, value] of Object.entries(geometry)) this.values.set(key, this.validate(key, value));
  }

  get id(): string { return this.shapeId; }
  get type(): string { return this.shapeType; }
  get label(): string { return `${this.type}#${this.id}`; }

  abstract move(dx: number, dy: number): void;
  abstract clone(): Shape;
  abstract geometrySummary(): string;

  scale(factor: number): void {
    Numeric.positive(factor, 'scale factor');
    const next = [...this.values].map(([key, value]) => [key, this.validate(key, value * factor)] as const);
    for (const [key, value] of next) this.values.set(key, value);
  }

  setAttribute(name: string, value: string): void {
    if (this.values.has(name)) {
      this.values.set(name, this.validate(name, Numeric.parse(value, name)));
      return;
    }
    if (name === 'fill' || name === 'stroke' || name === 'stroke-width') {
      if (name === 'stroke-width') Numeric.nonNegative(Numeric.parse(value, name), name);
      this.appearance.set(name, value);
      return;
    }
    throw new Error(`unknown attribute: ${name}`);
  }

  attribute(name: string): string | undefined {
    if (name === 'id') return this.id;
    const value = this.values.get(name);
    return value === undefined ? this.appearance.get(name) ?? this.extra.get(name) : String(value);
  }

  /** Detached serialization view, never exposes mutable internal collections. */
  attributes(): Readonly<Record<string, string>> {
    return Object.fromEntries([
      ['id', this.id], ...[...this.values].map(([key, value]) => [key, String(value)]),
      ...this.appearance, ...this.extra,
    ]);
  }

  importPresentation(attributes: Readonly<Record<string, string>>): void {
    for (const [key, value] of Object.entries(attributes)) {
      if (key === 'id' || this.values.has(key)) continue;
      if (key === 'fill' || key === 'stroke' || key === 'stroke-width') this.setAttribute(key, value);
      else this.extra.set(key, value);
    }
  }

  children(): readonly Shape[] { return []; }
  asGroup(): Group | null { return null; }
  textContent(): string | null { return null; }

  summary(): string {
    return [this.label, this.geometrySummary(), ...[...this.appearance].map(([k, v]) => `${k}=${v}`)]
      .filter(Boolean).join('  ');
  }

  protected number(name: string): number {
    const value = this.values.get(name);
    if (value === undefined) throw new Error(`missing geometry: ${name}`);
    return value;
  }

  protected translate(dx: number, dy: number, xs: readonly string[], ys: readonly string[]): void {
    Numeric.finite(dx, 'dx');
    Numeric.finite(dy, 'dy');
    const next = [...xs.map(k => [k, this.validate(k, this.number(k) + dx)] as const),
      ...ys.map(k => [k, this.validate(k, this.number(k) + dy)] as const)];
    for (const [key, value] of next) this.values.set(key, value);
  }

  protected copyPresentationTo(copy: Shape): void {
    copy.importPresentation(Object.fromEntries([...this.appearance, ...this.extra]));
  }

  private validate(name: string, value: number): number {
    return this.nonNegativeKeys.includes(name) ? Numeric.nonNegative(value, name) : Numeric.finite(value, name);
  }
}
