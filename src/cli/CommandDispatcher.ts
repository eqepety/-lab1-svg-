import type { EditorSession } from '../application/EditorSession.js';
import type { ShapeFactory } from '../application/ShapeFactory.js';
import { CreateCommand } from '../application/commands/CreateCommand.js';
import { DeleteCommand } from '../application/commands/DeleteCommand.js';
import { MoveCommand } from '../application/commands/MoveCommand.js';
import { ScaleCommand } from '../application/commands/ScaleCommand.js';
import { SetCommand } from '../application/commands/SetCommand.js';
import { GroupCommand } from '../application/commands/GroupCommand.js';
import { UngroupCommand } from '../application/commands/UngroupCommand.js';
import { AddToCommand } from '../application/commands/AddToCommand.js';
import { FrontCommand } from '../application/commands/FrontCommand.js';
import { BackCommand } from '../application/commands/BackCommand.js';
import { Arguments } from './Arguments.js';
import { Tokenizer } from './Tokenizer.js';
import { TreeFormatter } from './TreeFormatter.js';

interface CommandDefinition {
  readonly usage: string;
  readonly needsDocument: boolean;
  readonly run: (args: Arguments) => readonly string[] | Promise<readonly string[]>;
}

/** The single command-name dispatch point. Future work: plugin registrations. */
export class CommandDispatcher {
  private readonly commands = new Map<string, CommandDefinition>();
  private readonly tokenizer = new Tokenizer();
  private readonly formatter = new TreeFormatter();

  constructor(private readonly session: EditorSession, factory: ShapeFactory) {
    this.register('init', 'init [w] [h]', a => {
      a.expect(0, 2);
      return [session.init(a.length > 0 ? a.number(0, 'width') : 800, a.length > 1 ? a.number(1, 'height') : 600)];
    }, false);
    this.register('read', 'read <file.svg>', async a => { a.expect(1); return session.read(a.value(0)); }, false);
    this.register('save', 'save [file.svg]', async a => {
      a.expect(0, 1); return [await session.save(a.length ? a.value(0) : undefined)];
    });
    this.register('canvas', 'canvas [w h]', a => {
      if (!a.length) return [`canvas ${session.document().width}x${session.document().height}`];
      a.expect(2); return [session.resize(a.number(0, 'width'), a.number(1, 'height'))];
    });
    this.register('create', 'create <type> <id> [params...] [in <containerId>]', a => {
      a.expect(2, Infinity);
      const hasParent = a.length >= 4 && a.isUnquoted(a.length - 2, 'in');
      const values = a.values(2, hasParent ? a.length - 2 : a.length);
      const parent = hasParent ? a.value(a.length - 1) : undefined;
      return [session.edit(new CreateCommand(factory, a.value(0), a.value(1), values, parent))];
    });
    this.register('delete', 'delete <id>', a => { a.expect(1); return [session.edit(new DeleteCommand(a.value(0)))]; });
    this.register('move', 'move <id> <dx> <dy>', a => {
      a.expect(3); return [session.edit(new MoveCommand(a.value(0), a.number(1, 'dx'), a.number(2, 'dy')))];
    });
    this.register('scale', 'scale <id> <factor>', a => {
      a.expect(2); return [session.edit(new ScaleCommand(a.value(0), a.number(1, 'factor')))];
    });
    this.register('set', 'set <id> <attr> <value>', a => {
      a.expect(3); return [session.edit(new SetCommand(a.value(0), a.value(1), a.value(2)))];
    });
    this.register('group', 'group <newGid> <id1> [id2...]', a => {
      a.expect(2, Infinity); return [session.edit(new GroupCommand(a.value(0), a.values(1)))];
    });
    this.register('ungroup', 'ungroup <gid>', a => { a.expect(1); return [session.edit(new UngroupCommand(a.value(0)))]; });
    this.register('addto', 'addto <gid> <id>', a => { a.expect(2); return [session.edit(new AddToCommand(a.value(0), a.value(1)))]; });
    this.register('front', 'front <id>', a => { a.expect(1); return [session.edit(new FrontCommand(a.value(0)))]; });
    this.register('back', 'back <id>', a => { a.expect(1); return [session.edit(new BackCommand(a.value(0)))]; });
    this.register('tree', 'tree [id]', a => {
      a.expect(0, 1); return this.formatter.tree(session.document(), a.length ? a.value(0) : undefined);
    });
    this.register('show', 'show <id>', a => { a.expect(1); return this.formatter.show(session.document(), a.value(0)); });
    this.register('undo', 'undo', a => { a.expect(0); return [session.undo()]; });
    this.register('redo', 'redo', a => { a.expect(0); return [session.redo()]; });
    this.register('help', 'help', a => {
      a.expect(0);
      return [...this.commands.values()].map(definition => definition.usage).concat([
        'create rect <id> <x> <y> <w> <h> [fill] [in <containerId>]',
        'create circle <id> <cx> <cy> <r> [fill] [in <containerId>]',
        'create ellipse <id> <cx> <cy> <rx> <ry> [fill] [in <containerId>]',
        'create line <id> <x1> <y1> <x2> <y2> [stroke] [in <containerId>]',
        'create text <id> <x> <y> "content" [in <containerId>]',
        'create g <id> [in <containerId>]',
      ]);
    }, false);
  }

  async execute(line: string): Promise<readonly string[]> {
    try {
      const tokens = this.tokenizer.tokenize(line);
      if (!tokens.length) return [];
      const name = tokens[0]!.value;
      const definition = this.commands.get(name);
      if (!definition) throw new Error(`unknown command: ${name}`);
      if (definition.needsDocument) this.session.document();
      return await definition.run(new Arguments(tokens.slice(1), definition.usage));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return [`error: ${message.replace(/[\r\n]+/gu, ' ')}`];
    }
  }

  private register(name: string, usage: string, run: CommandDefinition['run'], needsDocument = true): void {
    this.commands.set(name, { usage, run, needsDocument });
  }
}
