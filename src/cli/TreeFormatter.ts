import type { Shape } from '../domain/Shape.js';
import type { SvgDocument } from '../domain/SvgDocument.js';

export class TreeFormatter {
  tree(document: SvgDocument, id?: string): readonly string[] {
    if (id !== undefined) {
      const shape = document.require(id);
      return [shape.summary(), ...this.children(shape.children(), '')];
    }
    return [`svg (${document.width}x${document.height})`, ...this.children(document.children(), '')];
  }
  show(document: SvgDocument, id: string): readonly string[] {
    const shape = document.require(id);
    const attributes = Object.entries(shape.attributes()).filter(([key]) => key !== 'id');
    return [
      `${shape.label}  parent=${document.parentLabel(id)}`,
      ...attributes.map(([key, value]) => `  ${key}=${value}`),
      ...(shape.textContent() === null ? [] : [`  text=${JSON.stringify(shape.textContent())}`]),
    ];
  }
  private children(shapes: readonly Shape[], prefix: string): string[] {
    return shapes.flatMap((shape, index) => {
      const last = index === shapes.length - 1;
      return [
        `${prefix}${last ? '└── ' : '├── '}${shape.summary()}`,
        ...this.children(shape.children(), prefix + (last ? '    ' : '│   ')),
      ];
    });
  }
}
