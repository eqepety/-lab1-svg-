/** Numeric rules shared by every shape; never silently accept NaN or hexadecimal. */
export class Numeric {
  static parse(value: string, name: string): number {
    if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/iu.test(value)) {
      throw new Error(`invalid number for ${name}: ${value}`);
    }
    return this.finite(Number(value), name);
  }

  static finite(value: number, name: string): number {
    if (!Number.isFinite(value)) throw new Error(`${name} must be finite`);
    return Object.is(value, -0) ? 0 : value;
  }

  static nonNegative(value: number, name: string): number {
    this.finite(value, name);
    if (value < 0) throw new Error(`${name} must be non-negative`);
    return value;
  }

  static positive(value: number, name: string): number {
    this.finite(value, name);
    if (value <= 0) throw new Error(`${name} must be positive`);
    return value;
  }
}
