import { SvgDocument } from '../domain/SvgDocument.js';
import { History } from './History.js';
import type { EditCommand } from './EditCommand.js';
import type { SvgStore } from './SvgStore.js';

export class EditorSession {
  private current: SvgDocument | null = null;
  private currentPath: string | undefined;
  private readonly history = new History();

  constructor(private readonly store: SvgStore) {}

  document(): SvgDocument {
    if (!this.current) throw new Error("no document. use 'init' or 'read' first");
    return this.current;
  }

  replaceDocument(document: SvgDocument): void { this.current = document; }

  init(width = 800, height = 600): string {
    const document = new SvgDocument(width, height);
    this.current = document;
    this.currentPath = undefined;
    this.history.barrier();
    return `canvas ${width}x${height} created`;
  }

  resize(width: number, height: number): string {
    const draft = this.document().clone();
    draft.resize(width, height);
    this.current = draft;
    this.history.barrier();
    return `canvas resized to ${width}x${height}`;
  }

  async read(path: string): Promise<readonly string[]> {
    const loaded = await this.store.read(path);
    this.current = loaded.document;
    this.currentPath = path;
    this.history.barrier();
    return [...loaded.warnings, `read ${path} (${loaded.document.allShapes().length} elements)`];
  }

  async save(path?: string): Promise<string> {
    const document = this.document();
    const target = path ?? this.currentPath;
    if (!target) throw new Error("no save path. use 'save <file.svg>'");
    await this.store.write(document, target);
    this.currentPath = target;
    this.history.barrier();
    return `saved to ${target} (${document.allShapes().length} elements)`;
  }

  edit(command: EditCommand): string { return this.history.execute(command, this); }
  undo(): string { this.document(); return this.history.undo(this); }
  redo(): string { this.document(); return this.history.redo(this); }
}
