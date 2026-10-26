import { EditCommand } from '../EditCommand.js';
import type { SvgDocument } from '../../domain/SvgDocument.js';

export class SetCommand extends EditCommand {
  constructor(private readonly id: string, private readonly attribute: string, private readonly value: string) { super('set'); }
  protected apply(document: SvgDocument): string {
    const shape = document.require(this.id);
    shape.setAttribute(this.attribute, this.value);
    return this.summary(document);
  }
  protected override undoSummary(document: SvgDocument): string { return this.summary(document); }
  private summary(document: SvgDocument): string {
    const shape = document.require(this.id);
    return `${shape.label} updated: ${this.attribute}=${JSON.stringify(shape.attribute(this.attribute))}`;
  }
}
