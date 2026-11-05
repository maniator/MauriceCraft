import { describe, expect, it, vi } from 'vitest';
import { createCommandConsole } from '../../src/game/commands/command-console';

/** Minimal browser facade for command testing in the existing Node test runner. */
function fixture() {
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  type FakeNode = { textContent: string; className: string;
    value: string; disabled: boolean; placeholder: string;
    listeners: Record<string, (e: KeyboardEvent) => void>;
    children: FakeNode[]; classList: { remove: () => void };
    appendChild: (node: FakeNode) => void; remove: () => void;
    addEventListener: (type: string, listener: (event: KeyboardEvent) => void) => void; focus: () => void };
  function makeNode(): FakeNode {
    const node: FakeNode = {
      textContent: '', className: '', value: '', disabled: false, placeholder: '',
      listeners: {}, children: [],
      classList: { remove: () => undefined },
      appendChild(child) { node.children.push(child); },
      remove: () => undefined,
      addEventListener(type, listener) { node.listeners[type] = listener; },
      focus: () => undefined,
    };
    return node;
  }
  const nodes: Record<string, FakeNode> = {
    chatlog: makeNode(), cmdbar: makeNode(), cmdinput: makeNode(), btnCmd: makeNode(),
  };
  const doc = {
    getElementById: (id: string) => nodes[id],
    createElement: () => makeNode(),
    pointerLockElement: null,
  };
  const win = { addEventListener: () => undefined };
  Object.defineProperty(globalThis, 'document', { value: doc, configurable: true });
  Object.defineProperty(globalThis, 'window', { value: win, configurable: true });
  return {
    nodes,
    restore: () => {
      Object.defineProperty(globalThis, 'document', { value: originalDocument, configurable: true });
      Object.defineProperty(globalThis, 'window', { value: originalWindow, configurable: true });
    },
  };
}
describe('command registry', () => {
  it('supports aliases, command exceptions and normal messages', () => {
    const { nodes, restore } = fixture();
    try {
      // The HTML button instanceof check is deliberately avoided in this module.
      const system = createCommandConsole({
        onOpen: () => undefined, onClose: () => undefined, isDead: () => false,
        canOpen: () => true, isCommandOpen: () => false, isTouch: false,
      });
      system.defCmd(['hello', 'hi'], '/hello', 'Greet', () => 'Hello Maurice!');
      system.execute('/hi');
      system.execute('regular chat');
      system.execute('/missing');
      expect(nodes.chatlog.children.map(line => line.textContent)).toContain('Hello Maurice!');
      expect(nodes.chatlog.children.map(line => line.textContent)).toContain('[You] regular chat');
      expect(nodes.chatlog.children.map(line => line.textContent)).toContain('Unknown command "missing". Type /help for the list.');
    } finally { restore(); }
  });

  it('blocks command input until the on-demand command chunk is ready', async () => {
    const { nodes, restore } = fixture();
    let resolveLoad: (() => void) | undefined;
    const pending = new Promise<void>(resolve => { resolveLoad = resolve; });
    const loadCommands = vi.fn(() => pending);
    let commandOpen = false;
    try {
      const system = createCommandConsole({
        onOpen: () => { commandOpen = true; },
        onClose: () => { commandOpen = false; },
        isDead: () => false, canOpen: () => true,
        isCommandOpen: () => commandOpen, isTouch: false, loadCommands,
      });
      system.openCmd('/help');
      expect(loadCommands).toHaveBeenCalledOnce();
      expect(nodes.cmdinput.disabled).toBe(true);
      expect(nodes.cmdinput.placeholder).toBe('Loading commands…');
      expect(nodes.cmdinput.value).toBe('/help');
      resolveLoad?.();
      await pending;
      await Promise.resolve();
      expect(nodes.cmdinput.disabled).toBe(false);
      expect(nodes.cmdinput.placeholder).toBe('');
      expect(nodes.cmdinput.value).toBe('/help');
    } finally { restore(); }
  });
});
