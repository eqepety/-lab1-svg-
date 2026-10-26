import { EditCommand } from '../EditCommand.js';
import type { SvgDocument } from '../../domain/SvgDocument.js';

export class FrontCommand extends EditCommand {
  constructor(private readonly id: string) { super('front'); }
  protected apply(document: SvgDocument): string {
    document.reorder(this.id, true);
    return `${document.require(this.id).label} moved to front`;
  }
}
