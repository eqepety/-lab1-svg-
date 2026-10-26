import { ShapeFactory } from './application/ShapeFactory.js';
import { EditorSession } from './application/EditorSession.js';
import { SvgCodec } from './infrastructure/SvgCodec.js';
import { FileSvgStore } from './infrastructure/FileSvgStore.js';
import { CommandDispatcher } from './cli/CommandDispatcher.js';
import { Repl } from './cli/Repl.js';

const factory = new ShapeFactory();
const store = new FileSvgStore(new SvgCodec(factory));
const session = new EditorSession(store);
await new Repl(new CommandDispatcher(session, factory)).run();
