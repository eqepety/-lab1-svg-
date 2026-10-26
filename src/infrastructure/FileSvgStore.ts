import { readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { basename, dirname, join } from 'node:path';
import type { SvgDocument } from '../domain/SvgDocument.js';
import type { SvgStore, LoadedSvg } from '../application/SvgStore.js';
import type { SvgCodec } from './SvgCodec.js';

export class FileSvgStore implements SvgStore {
  constructor(private readonly codec: SvgCodec) {}

  async read(path: string): Promise<LoadedSvg> {
    let source: string;
    try { source = await readFile(path, 'utf8'); }
    catch { throw new Error(`cannot read file: ${path}`); }
    return this.codec.decode(source);
  }

  async write(document: SvgDocument, path: string): Promise<void> {
    const temporary = join(dirname(path), `.${basename(path)}.${randomUUID()}.tmp`);
    try {
      const xml = this.codec.encode(document);
      await writeFile(temporary, xml, { encoding: 'utf8', flag: 'wx' });
      await rename(temporary, path);
    } catch {
      await unlink(temporary).catch(() => {});
      throw new Error(`cannot write file: ${path}`);
    }
  }
}
