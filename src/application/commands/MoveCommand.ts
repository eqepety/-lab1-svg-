import { EditCommand } from '../EditCommand.js';
import type { SvgDocument } from '../../domain/SvgDocument.js';

export class MoveCommand extends EditCommand {
  constructor(private readonly id: string, private readonly dx: number, private readonly dy: number) { super('move'); }
  protected apply(document: SvgDocument): string {
    const shape = document.require(this.id);
    shape.move(this.dx, this.dy);
    return `${shape.label} moved by (${this.dx},${this.dy})`;
  }
  protected override undoSummary(document: SvgDocument): string {
    return `${document.require(this.id).label} moved back by (${-this.dx},${-this.dy})`;
  }
}
