import { Rect } from '../domain/Rect.js';
import { Circle } from '../domain/Circle.js';
import { Ellipse } from '../domain/Ellipse.js';
import { Line } from '../domain/Line.js';
import { Text } from '../domain/Text.js';
import { Group } from '../domain/Group.js';
import { Numeric } from '../domain/Numeric.js';
import type { Shape } from '../domain/Shape.js';

interface ShapeDefinition {
  readonly geometry: readonly string[];
  readonly content?: boolean;
  readonly color?: string;
  readonly build: (id: string, values: readonly number[], text: string) => Shape;
}

/** The single shape-name dispatch point. Future work: plugin-owned registrations. */
export class ShapeFactory {
  private readonly definitions = new Map<string, ShapeDefinition>([
    ['rect', { geometry: ['x', 'y', 'width', 'height'], color: 'fill',
      build: (id, n) => new Rect(id, n[0]!, n[1]!, n[2]!, n[3]!) }],
    ['circle', { geometry: ['cx', 'cy', 'r'], color: 'fill',
      build: (id, n) => new Circle(id, n[0]!, n[1]!, n[2]!) }],
    ['ellipse', { geometry: ['cx', 'cy', 'rx', 'ry'], color: 'fill',
      build: (id, n) => new Ellipse(id, n[0]!, n[1]!, n[2]!, n[3]!) }],
    ['line', { geometry: ['x1', 'y1', 'x2', 'y2'], color: 'stroke',
      build: (id, n) => new Line(id, n[0]!, n[1]!, n[2]!, n[3]!) }],
    ['text', { geometry: ['x', 'y'], content: true,
      build: (id, n, text) => new Text(id, n[0]!, n[1]!, text) }],
    ['g', { geometry: [], build: id => new Group(id) }],
  ]);

  create(type: string, id: string, values: readonly string[]): Shape {
    const definition = this.definition(type);
    const minimum = definition.geometry.length + (definition.content ? 1 : 0);
    const maximum = minimum + (definition.color ? 1 : 0);
    if (values.length < minimum || values.length > maximum) {
      throw new Error(`create ${type} expects ${minimum === maximum ? minimum : minimum + '-' + maximum} parameters after id`);
    }
    const numbers = definition.geometry.map((key, index) => Numeric.parse(values[index]!, key));
    const shape = definition.build(id, numbers, definition.content ? values[definition.geometry.length]! : '');
    if (definition.color && values[minimum] !== undefined) shape.setAttribute(definition.color, values[minimum]!);
    return shape;
  }

  fromSvg(type: string, id: string, attributes: Readonly<Record<string, string>>, content: string): Shape {
    const definition = this.definition(type);
    const numbers = definition.geometry.map(key => Numeric.parse(attributes[key] ?? '0', key));
    const shape = definition.build(id, numbers, content);
    shape.importPresentation(attributes);
    return shape;
  }

  supports(type: string): boolean { return this.definitions.has(type); }

  private definition(type: string): ShapeDefinition {
    const definition = this.definitions.get(type);
    if (!definition) throw new Error(`unknown shape type: ${type} (is the plugin loaded?)`);
    return definition;
  }
}
