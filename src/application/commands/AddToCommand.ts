import { EditCommand } from '../EditCommand.js';
import type { SvgDocument } from '../../domain/SvgDocument.js';

export class AddToCommand extends EditCommand {
  constructor(private readonly containerId: string, private readonly id: string) { super('addto'); }
  protected apply(document: SvgDocument): string {
    document.addTo(this.containerId, this.id);
    return `${document.require(this.id).label} added to g#${this.containerId}`;
  }
}
