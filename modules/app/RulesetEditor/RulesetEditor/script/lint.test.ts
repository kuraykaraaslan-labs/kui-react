import { describe, expect, it } from 'vitest';
import { lintScript, tidyScript } from './lint';
import { scriptHover, scriptSuggestions, SCRIPT_API_ITEMS } from './api';

const codes = (src: string) => lintScript(src).map((p) => `${p.line}:${p.column} ${p.code}`);

describe('lintScript (reads, never runs)', () => {
  it('passes a normal script', () => {
    expect(lintScript('const t = msg.payload.temp;\nif (t > 30) { node.warn(`hot ${t}`); }\nreturn [msg, null];\n')).toEqual([]);
  });
  it('finds brackets that do not close or close the wrong one', () => {
    expect(codes('if (a {\n}')).toEqual(['1:4 unclosed_bracket']);
    expect(codes('return x]')).toEqual(['1:9 unexpected_close']);
    expect(codes('const a = [1, 2;')).toEqual(['1:11 unclosed_bracket']);
  });
  it('finds strings, templates and comments left open', () => {
    expect(codes('const s = "abc\nreturn s;')).toEqual(['1:11 unclosed_string']);
    expect(codes('const s = `abc')).toEqual(['1:11 unclosed_template']);
    expect(codes('/* note\nreturn msg;')).toEqual(['1:1 unclosed_comment']);
  });
  it('is not fooled by brackets in strings, comments and regular expressions', () => {
    expect(lintScript('const a = "(";\n// )\nconst r = /[)(]/g;\nreturn a.replace(r, "");')).toEqual([]);
    expect(lintScript('const half = total / 2 / (n || 1);')).toEqual([]);
  });
  it('warns about names the sandbox does not have, but not about properties', () => {
    expect(codes('const fs = require("fs");\nsetTimeout(f, 1);\nreturn msg.process;')).toEqual(['1:12 sandbox_missing', '2:1 sandbox_missing']);
    expect(codes('const m = import("x");')).toEqual(['1:11 sandbox_missing']);
  });
  it('warns about a script over 8 KiB', () => {
    expect(codes(`// ${'x'.repeat(9000)}`)).toEqual(['1:1 long_script']);
  });
});

describe('script completion and hover', () => {
  it('offers the API names with their help', () => {
    const s = scriptSuggestions();
    expect(s.map((x) => x.label)).toEqual(expect.arrayContaining(['msg.payload', 'node.send', 'context.get', 'env.get', 'bytes.toHex', 'time.format']));
    expect(s.find((x) => x.label === 'node.send')?.insertText).toBe('node.send(');
    expect(new Set(SCRIPT_API_ITEMS.map((i) => i.label)).size).toBe(SCRIPT_API_ITEMS.length);
  });
  it('explains a name, or its first part', () => {
    expect(scriptHover('msg.payload')).toContain('body');
    expect(scriptHover('msg.payload.temp')).toContain('body');
    expect(scriptHover('bytes')).toContain('fromHex');
    expect(scriptHover('foo')).toBeNull();
  });
});

describe('tidyScript', () => {
  it('indents by bracket depth and trims trailing spaces', () => {
    expect(tidyScript('if (a) {\nreturn [\n1,\n2\n];   \n}')).toBe('if (a) {\n  return [\n    1,\n    2\n  ];\n}');
  });
  it('leaves a template string and a block comment as they are', () => {
    const src = 'const t = `a\n   b {\n`;\n/* x\n    y */\nreturn t;';
    expect(tidyScript(src)).toBe(src);
  });
});
