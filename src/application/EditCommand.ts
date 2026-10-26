import type { SvgDocument } from '../domain/SvgDocument.js';
import type { EditorSession } from './EditorSession.js';

/** Template method: subclasses only implement behavior on an isolated draft. */
export abstract class EditCommand {
  private before: SvgDocument | null = null;
  private after: SvgDocument | null = null;
  private message = '';

  protected constructor(private readonly action: string) {}

  execute(session: EditorSession): string {
    const before = session.document().clone();
    const draft = before.clone();
    const message = this.apply(draft);
    this.before = before;
    this.after = draft.clone();
    this.message = message;
    session.replaceDocument(draft);
    return message;
  }

  undo(session: EditorSession): string {
    if (!this.before) throw new Error('command has not been executed');
    const restored = this.before.clone();
    session.replaceDocument(restored);
    return this.undoSummary(restored);
  }

  redo(session: EditorSession): string {
    if (!this.after) throw new Error('command has not been executed');
    session.replaceDocument(this.after.clone());
    return this.message;
  }

  protected abstract apply(document: SvgDocument): string;
  protected undoSummary(_document: SvgDocument): string { return `${this.action} undone`; }
}
