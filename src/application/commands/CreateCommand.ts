import { EditCommand } from '../EditCommand.js';
import type { ShapeFactory } from '../ShapeFactory.js';
import type { SvgDocument } from '../../domain/SvgDocument.js';

export class CreateCommand extends EditCommand {
  constructor(
    private readonly factory: ShapeFactory, private readonly type: string,
    private readonly id: string, private readonly values: readonly string[], private readonly containerId?: string,
  ) { super('create'); }
  protected apply(document: SvgDocument): string {
    const shape = this.factory.create(this.type, this.id, this.values);
    document.add(shape, this.containerId);
    return `${shape.label} created${this.containerId === undefined ? '' : ' in g#' + this.containerId}`;
  }
  protected override undoSummary(): string { return `${this.type}#${this.id} removed`; }
}
