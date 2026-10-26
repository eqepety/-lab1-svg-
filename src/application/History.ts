import type { EditCommand } from './EditCommand.js';
import type { EditorSession } from './EditorSession.js';

export class History {
  private readonly undoStack: EditCommand[] = [];
  private readonly redoStack: EditCommand[] = [];
  private locked = false;

  execute(command: EditCommand, session: EditorSession): string {
    const message = command.execute(session);
    this.undoStack.push(command);
    this.redoStack.length = 0;
    this.locked = false;
    return message;
  }

  undo(session: EditorSession): string {
    this.assertAllowed();
    const command = this.undoStack.at(-1);
    if (!command) throw new Error('nothing to undo');
    const message = command.undo(session);
    this.undoStack.pop();
    this.redoStack.push(command);
    return message;
  }

  redo(session: EditorSession): string {
    this.assertAllowed();
    const command = this.redoStack.at(-1);
    if (!command) throw new Error('nothing to redo');
    const message = command.redo(session);
    this.redoStack.pop();
    this.undoStack.push(command);
    return message;
  }

  barrier(): void {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    this.locked = true;
  }

  private assertAllowed(): void {
    if (this.locked) throw new Error('undo not allowed after io command');
  }
}
