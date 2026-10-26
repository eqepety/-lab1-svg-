import { createInterface } from 'node:readline';
import type { Readable, Writable } from 'node:stream';
import type { CommandDispatcher } from './CommandDispatcher.js';

export class Repl {
  constructor(
    private readonly dispatcher: CommandDispatcher,
    private readonly input: Readable = process.stdin,
    private readonly output: Writable = process.stdout,
    private readonly interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY),
  ) {}

  async run(): Promise<void> {
    const lines = createInterface({ input: this.input, output: this.output, terminal: this.interactive, prompt: 'svg> ' });
    this.output.write("svg-editor 0.1 — type 'help' for commands\n");
    if (this.interactive) lines.prompt();
    for await (const line of lines) {
      const messages = await this.dispatcher.execute(line);
      if (messages.length) this.output.write(messages.join('\n') + '\n');
      if (this.interactive) lines.prompt();
    }
  }
}
