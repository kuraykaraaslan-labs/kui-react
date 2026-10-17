/**
 * The browser-side check of an automation script (09 §9.7, SC-50): it only reads the text, it never runs it (LF #27),
 * so it finds what a reader can see — brackets that do not close, a string, template or comment left open, names the
 * sandbox does not have (06 §6.4) and a script over 8 KiB. The real check is the sidecar's compile at test and deploy.
 * Positions are 1-based lines and columns, the kui `CodeEditor` marker shape.
 */

export type ScriptProblem = { line: number; column: number; severity: 'error' | 'warning'; message: string; code: string };

/** names the sandbox does not offer (phase 06 §6.4); `import(` is matched as a call */
export const SANDBOX_MISSING = ['require', 'eval', 'Function', 'fetch', 'setTimeout', 'setInterval', 'setImmediate', 'process', 'Buffer', 'WebAssembly', 'SharedArrayBuffer', 'XMLHttpRequest', 'util'] as const;

/** the size past which a script gets a warning (06 §6.2) */
export const SCRIPT_WARN_BYTES = 8 * 1024;

const PAIR: Record<string, string> = { ')': '(', ']': '[', '}': '{' };
/** after these a `/` starts a regular expression, not a division */
const REGEX_BEFORE = new Set(['', '(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '<', '>', '~', '^']);
const REGEX_WORDS = new Set(['return', 'typeof', 'case', 'do', 'else', 'in', 'of', 'new', 'delete', 'void', 'throw', 'yield', 'await']);

type Text = { line: number; column: number };

export function lintScript(code: string, o: { missing?: readonly string[]; warnBytes?: number } = {}): ScriptProblem[] {
  const out: ScriptProblem[] = [];
  const stack: { ch: string; at: Text }[] = [];
  let line = 1, col = 1, i = 0;
  let lastSig = '';   // the last significant character (for the regex rule)
  let lastWord = '';  // the last identifier (for `return /x/`)
  const at = (): Text => ({ line, column: col });
  const step = (n = 1) => { for (let k = 0; k < n && i < code.length; k++) { if (code[i] === '\n') { line++; col = 1; } else col++; i++; } };
  const missing = new Set(o.missing ?? SANDBOX_MISSING);

  while (i < code.length) {
    const c = code[i];
    const next = code[i + 1];
    if (c === '/' && next === '/') { while (i < code.length && code[i] !== '\n') step(); continue; }
    if (c === '/' && next === '*') {
      const start = at();
      step(2);
      while (i < code.length && !(code[i] === '*' && code[i + 1] === '/')) step();
      if (i >= code.length) { out.push({ ...start, severity: 'error', code: 'unclosed_comment', message: 'This comment is never closed (*/ is missing).' }); break; }
      step(2);
      continue;
    }
    if (c === '"' || c === "'") {
      const start = at();
      step();
      while (i < code.length && code[i] !== c && code[i] !== '\n') step(code[i] === '\\' ? 2 : 1);
      if (code[i] !== c) out.push({ ...start, severity: 'error', code: 'unclosed_string', message: 'This string is not closed on its line.' });
      else step();
      lastSig = c; lastWord = '';
      continue;
    }
    if (c === '`') {
      const start = at();
      step();
      while (i < code.length && code[i] !== '`') step(code[i] === '\\' ? 2 : 1);
      if (i >= code.length) { out.push({ ...start, severity: 'error', code: 'unclosed_template', message: 'This template string is never closed (` is missing).' }); break; }
      step();
      lastSig = '`'; lastWord = '';
      continue;
    }
    if (c === '/' && (REGEX_BEFORE.has(lastSig) || REGEX_WORDS.has(lastWord))) {
      // a regular expression literal: skip to its closing slash (a slash inside [...] does not close it)
      const start = at();
      step();
      let inClass = false;
      while (i < code.length && code[i] !== '\n' && (inClass || code[i] !== '/')) {
        if (code[i] === '\\') { step(2); continue; }
        if (code[i] === '[') inClass = true;
        else if (code[i] === ']') inClass = false;
        step();
      }
      if (code[i] !== '/') out.push({ ...start, severity: 'error', code: 'unclosed_regex', message: 'This regular expression is not closed on its line.' });
      else { step(); while (/[a-z]/i.test(code[i] ?? '')) step(); }
      lastSig = '/'; lastWord = '';
      continue;
    }
    if (/[A-Za-z_$]/.test(c)) {
      const start = at();
      let w = '';
      while (i < code.length && /[\w$]/.test(code[i])) { w += code[i]; step(); }
      const isProperty = lastSig === '.';
      if (!isProperty && missing.has(w)) out.push({ ...start, severity: 'warning', code: 'sandbox_missing', message: `${w} is not available in the script sandbox.` });
      if (!isProperty && w === 'import' && /^\s*\(/.test(code.slice(i))) out.push({ ...start, severity: 'warning', code: 'sandbox_missing', message: 'import() is not available in the script sandbox.' });
      lastWord = w; lastSig = 'a';
      continue;
    }
    if (c === '(' || c === '[' || c === '{') stack.push({ ch: c, at: at() });
    else if (c === ')' || c === ']' || c === '}') {
      const top = stack.at(-1);
      if (!top || top.ch !== PAIR[c]) {
        out.push({ ...at(), severity: 'error', code: 'unexpected_close', message: top ? `${c} does not close the ${top.ch} of line ${top.at.line}.` : `${c} closes nothing.` });
        if (top && Object.values(PAIR).includes(top.ch) && stack.some((s) => s.ch === PAIR[c])) {
          // recover: drop the brackets this one skipped
          while (stack.length && stack.at(-1)!.ch !== PAIR[c]) stack.pop();
          stack.pop();
        }
      } else stack.pop();
    }
    if (!/\s/.test(c)) { lastSig = c; lastWord = ''; }
    step();
  }
  for (const s of stack) out.push({ ...s.at, severity: 'error', code: 'unclosed_bracket', message: `This ${s.ch} is never closed.` });
  const bytes = new TextEncoder().encode(code).length;
  if (bytes > (o.warnBytes ?? SCRIPT_WARN_BYTES)) out.push({ line: 1, column: 1, severity: 'warning', code: 'long_script', message: `The script is ${bytes} bytes, more than ${o.warnBytes ?? SCRIPT_WARN_BYTES}: a long script is slow to check and to run.` });
  return out.sort((a, b) => a.line - b.line || a.column - b.column);
}

/**
 * Tidy (the code field's Format button): every line is indented two spaces per open bracket and loses its trailing
 * spaces. A line that starts inside a template string or a block comment is left exactly as it is, so the text of a
 * string never changes. Nothing else is rewritten.
 */
export function tidyScript(code: string, unit = '  '): string {
  const lines = code.split('\n');
  const out: string[] = [];
  let depth = 0;
  let mode: 'code' | 'template' | 'comment' = 'code';
  for (const raw of lines) {
    const startMode = mode;
    const body = startMode === 'code' ? raw.trim() : raw.replace(/\s+$/, '');
    let lead = 0;
    if (startMode === 'code') { const m = /^[)\]}]+/.exec(body); lead = m ? m[0].length : 0; }
    out.push(startMode === 'code' ? (body ? unit.repeat(Math.max(0, depth - lead)) + body : '') : body);
    // walk the line to find the depth and the mode at its end
    for (let i = 0; i < raw.length; i++) {
      const c = raw[i], n = raw[i + 1];
      if (mode === 'comment') { if (c === '*' && n === '/') { mode = 'code'; i++; } continue; }
      if (mode === 'template') { if (c === '\\') i++; else if (c === '`') mode = 'code'; continue; }
      if (c === '/' && n === '/') break;
      if (c === '/' && n === '*') { mode = 'comment'; i++; continue; }
      if (c === '`') { mode = 'template'; continue; }
      if (c === '"' || c === "'") { i++; while (i < raw.length && raw[i] !== c) { if (raw[i] === '\\') i++; i++; } continue; }
      if (c === '(' || c === '[' || c === '{') depth++;
      else if (c === ')' || c === ']' || c === '}') depth = Math.max(0, depth - 1);
    }
  }
  return out.join('\n');
}
