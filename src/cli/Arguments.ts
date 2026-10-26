import { Numeric } from '../domain/Numeric.js';
import type { Token } from './Tokenizer.js';

export class Arguments {
  constructor(private readonly tokens: readonly Token[], private readonly usage: string) {}
  get length(): number { return this.tokens.length; }
  value(index: number): string {
    const token = this.tokens[index];
    if (!token) throw new Error(`usage: ${this.usage}`);
    return token.value;
  }
  number(index: number, name: string): number { return Numeric.parse(this.value(index), name); }
  expect(minimum: number, maximum = minimum): void {
    if (this.length < minimum || this.length > maximum) throw new Error(`usage: ${this.usage}`);
  }
  values(start = 0, end = this.length): string[] { return this.tokens.slice(start, end).map(token => token.value); }
  isUnquoted(index: number, value: string): boolean {
    const token = this.tokens[index];
    return token !== undefined && !token.quoted && token.value === value;
  }
}
