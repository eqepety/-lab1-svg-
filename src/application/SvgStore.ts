import type { SvgDocument } from '../domain/SvgDocument.js';

export interface LoadedSvg {
  readonly document: SvgDocument;
  readonly warnings: readonly string[];
}

/** Port: application knows nothing about files, DOM or XML dependencies. */
export interface SvgStore {
  read(path: string): Promise<LoadedSvg>;
  write(document: SvgDocument, path: string): Promise<void>;
}
