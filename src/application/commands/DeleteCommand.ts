import { EditCommand } from '../EditCommand.js';
import type { SvgDocument } from '../../domain/SvgDocument.js';

export class DeleteCommand extends EditCommand {
  constructor(private readonly id: string) { super('delete'); }
  protected apply(document: SvgDocument): string { return `${document.delete(this.id).label} deleted`; }
  protected override undoSummary(document: SvgDocument): string {
    return `${document.require(this.id).label} restored into ${document.parentLabel(this.id)}`;
  }
}
