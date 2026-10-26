import { EditCommand } from '../EditCommand.js';
import type { SvgDocument } from '../../domain/SvgDocument.js';

export class UngroupCommand extends EditCommand {
  constructor(private readonly id: string) { super('ungroup'); }
  protected apply(document: SvgDocument): string {
    const count = document.ungroup(this.id);
    return `g#${this.id} ungrouped (${count} children promoted)`;
  }
}
