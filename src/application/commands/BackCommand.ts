import { EditCommand } from '../EditCommand.js';
import type { SvgDocument } from '../../domain/SvgDocument.js';

export class BackCommand extends EditCommand {
  constructor(private readonly id: string) { super('back'); }
  protected apply(document: SvgDocument): string {
    document.reorder(this.id, false);
    return `${document.require(this.id).label} moved to back`;
  }
}
