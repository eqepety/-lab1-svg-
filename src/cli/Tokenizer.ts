export interface Token {
  readonly value: string;
  readonly quoted: boolean;
}

export class Tokenizer {
  tokenize(line: string): readonly Token[] {
    const input = line.replace(/^\uFEFF/u, '').trim();
    if (!input || input.startsWith('#')) return [];
    const tokens: Token[] = [];
    let value = '';
    let quoted = false;
    let inQuotes = false;
    let started = false;
    for (let index = 0; index < input.length; index++) {
      const char = input[index]!;
      if (inQuotes) {
        if (char === '\\' && (input[index + 1] === '"' || input[index + 1] === '\\')) value += input[++index];
        else if (char === '"') inQuotes = false;
        else value += char;
      } else if (/\s/u.test(char)) {
        if (started) tokens.push({ value, quoted });
        value = ''; quoted = false; started = false;
      } else if (char === '"') {
        if (started) throw new Error('double quotes must enclose the entire argument');
        started = true; quoted = true; inQuotes = true;
      } else {
        if (quoted) throw new Error('unexpected text after closing quote');
        started = true; value += char;
      }
    }
    if (inQuotes) throw new Error('unterminated double quote');
    if (started) tokens.push({ value, quoted });
    return tokens;
  }
}
