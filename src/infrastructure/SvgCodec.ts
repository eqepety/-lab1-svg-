import { DOMImplementation, DOMParser, XMLSerializer } from '@xmldom/xmldom';
import type { Document as XmlDocument, Element as XmlElement } from '@xmldom/xmldom';
import { SvgDocument } from '../domain/SvgDocument.js';
import { Numeric } from '../domain/Numeric.js';
import type { Shape } from '../domain/Shape.js';
import type { LoadedSvg } from '../application/SvgStore.js';
import type { ShapeFactory } from '../application/ShapeFactory.js';
import { SvgTransform } from './SvgTransform.js';

export class SvgCodec {
  private static readonly namespace = 'http://www.w3.org/2000/svg';
  constructor(private readonly factory: ShapeFactory) {}

  decode(source: string): LoadedSvg {
    let xml: XmlDocument;
    try {
      xml = new DOMParser({ onError: (_level, message) => { throw new Error(message); } })
        .parseFromString(source, 'image/svg+xml');
    } catch (error) {
      throw new Error(`invalid SVG: ${error instanceof Error ? error.message : String(error)}`);
    }
    const root = xml.documentElement;
    if (!root || root.localName !== 'svg' || root.namespaceURI !== SvgCodec.namespace) throw new Error('invalid SVG: expected <svg> root');
    if (xml.doctype) throw new Error('SVG document types are not supported');
    const all = [root, ...this.descendants(root)];
    const used = new Set<string>();
    for (const element of all) {
      if (element.namespaceURI !== SvgCodec.namespace) throw new Error(`unsupported SVG namespace: ${element.namespaceURI}`);
      if (element !== root && !this.factory.supports(this.name(element))) {
        throw new Error(`unknown shape type: ${element.localName} (is the plugin loaded?)`);
      }
      const id = element.getAttribute('id');
      if (id) {
        if (used.has(id)) throw new Error(`id already exists: ${id}`);
        used.add(id);
      }
    }
    const rootAttrs = this.attributes(root);
    const width = this.length(rootAttrs['width'] ?? '800', 'width');
    const height = this.length(rootAttrs['height'] ?? '600', 'height');
    if (rootAttrs['viewBox']) {
      const box = rootAttrs['viewBox'].trim().split(/[\s,]+/u).map(v => Numeric.parse(v, 'viewBox'));
      if (box.length !== 4 || box[0] !== 0 || box[1] !== 0 || box[2] !== width || box[3] !== height) {
        throw new Error('unsupported viewBox: expected 0 0 width height');
      }
    }
    const document = new SvgDocument(width, height);
    const presentation = { ...rootAttrs };
    for (const name of ['xmlns', 'width', 'height', 'viewBox', 'transform']) delete presentation[name];
    if (!presentation['id']) delete presentation['id'];
    document.importRootAttributes(presentation);
    const warnings: string[] = [];
    const counters = new Map<string, number>();
    const rootTransform = SvgTransform.parse(rootAttrs['transform'] ?? '');
    const importElement = (element: XmlElement, parent: string | undefined, inherited: SvgTransform, inheritedAttrs: Readonly<Record<string, string>>): void => {
      const attrs = this.attributes(element);
      let id = attrs['id'];
      if (!id) {
        let serial = counters.get(this.name(element)) ?? 0;
        do { id = this.name(element) + ++serial; } while (used.has(id));
        counters.set(this.name(element), serial);
        used.add(id); attrs['id'] = id;
        warnings.push(`warning: assigned id ${id} to unnamed <${element.localName}>`);
      }
      const transform = inherited.compose(SvgTransform.parse(attrs['transform'] ?? ''));
      delete attrs['transform'];
      const effective = { ...inheritedAttrs, ...attrs, style: [inheritedAttrs['style'], attrs['style']].filter(Boolean).join(';') };
      const shape = this.factory.fromSvg(this.name(element), id, attrs, element.textContent ?? '');
      const children = this.elements(element);
      if (children.length && !shape.asGroup()) throw new Error(`unsupported nested content in <${element.localName}>`);
      transform.apply(shape, effective);
      document.add(shape, parent);
      for (const child of children) importElement(child, id, transform, effective);
      if (shape.textContent() === null) this.assertNoLooseText(element);
    };
    for (const element of this.elements(root)) importElement(element, undefined, rootTransform, rootAttrs);
    this.assertNoLooseText(root);
    return { document, warnings };
  }

  encode(document: SvgDocument): string {
    const xml = new DOMImplementation().createDocument(SvgCodec.namespace, 'svg', null);
    const root = xml.documentElement!;
    for (const [key, value] of Object.entries(document.rootAttributes())) root.setAttribute(key, value);
    root.setAttribute('xmlns', SvgCodec.namespace);
    root.setAttribute('width', String(document.width));
    root.setAttribute('height', String(document.height));
    root.setAttribute('viewBox', `0 0 ${document.width} ${document.height}`);
    for (const shape of document.children()) {
      root.appendChild(xml.createTextNode('\n  '));
      root.appendChild(this.element(xml, shape, 1));
    }
    if (document.children().length) root.appendChild(xml.createTextNode('\n'));
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(root) + '\n';
  }

  private element(xml: XmlDocument, shape: Shape, depth: number): XmlElement {
    const element = xml.createElementNS(SvgCodec.namespace, shape.type);
    for (const [key, value] of Object.entries(shape.attributes())) element.setAttribute(key, value);
    const text = shape.textContent();
    if (text !== null) element.appendChild(xml.createTextNode(text));
    for (const child of shape.children()) {
      element.appendChild(xml.createTextNode('\n' + '  '.repeat(depth + 1)));
      element.appendChild(this.element(xml, child, depth + 1));
    }
    if (shape.children().length) element.appendChild(xml.createTextNode('\n' + '  '.repeat(depth)));
    return element;
  }

  private name(element: XmlElement): string { return element.localName ?? element.tagName; }

  private attributes(element: XmlElement): Record<string, string> {
    return Object.fromEntries(Array.from({ length: element.attributes.length }, (_, i) => {
      const attribute = element.attributes.item(i)!;
      return [attribute.name, attribute.value];
    }));
  }

  private elements(element: XmlElement): XmlElement[] {
    return Array.from({ length: element.childNodes.length }, (_, i) => element.childNodes.item(i)!)
      .filter(node => node.nodeType === 1) as XmlElement[];
  }

  private descendants(element: XmlElement): XmlElement[] {
    return this.elements(element).flatMap(child => [child, ...this.descendants(child)]);
  }

  private assertNoLooseText(element: XmlElement): void {
    for (let i = 0; i < element.childNodes.length; i++) {
      const node = element.childNodes.item(i)!;
      if ((node.nodeType === 3 || node.nodeType === 4) && node.nodeValue?.trim()) throw new Error(`unexpected text in <${element.localName}>`);
    }
  }

  private length(value: string, name: string): number { return Numeric.parse(value.trim().replace(/px$/u, ''), name); }
}
