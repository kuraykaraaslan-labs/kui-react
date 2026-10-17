'use client';
// modules/ui/CodeEditor/parts/Toolbar.tsx
//
// CodeEditor toolbar (M2): the language, then find, format (when the editor
// has a `format`), copy and fullscreen. Icon buttons with labels for screen
// readers; the bar sits above the field.

import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCopy, faCheck, faMagnifyingGlass, faMaximize, faMinimize, faWandMagicSparkles } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import type { CodeEditorMessages, CodeEditorProps } from '../types';

type ToolbarProps = Pick<CodeEditorProps, 'language' | 'theme' | 'readonly'> & {
  messages: CodeEditorMessages;
  onFind: () => void;
  findOpen?: boolean;
  onFormat?: () => void;
  onCopy: () => void;
  fullscreen: boolean;
  onFullscreen: () => void;
};

const btn = 'inline-flex h-7 w-7 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-surface-overlay hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus';

export function Toolbar({ language, readonly, messages, onFind, findOpen, onFormat, onCopy, fullscreen, onFullscreen }: ToolbarProps) {
  const [copied, setCopied] = useState(false);
  return (
    <div
      data-kui-codeeditor-toolbar
      role="toolbar"
      aria-label={messages.toolbarLabel}
      className="flex items-center gap-1 rounded-t-md border border-b-0 border-border bg-surface-raised px-2 py-1 text-xs text-text-secondary"
    >
      <span className="font-mono">{language}</span>
      {readonly && <span className="font-mono opacity-60">· {messages.readOnlyLabel}</span>}
      <span className="flex-1" />
      <button type="button" className={cn(btn, findOpen && 'bg-primary-subtle text-primary')} aria-label={messages.find} title={messages.find} aria-pressed={findOpen} onClick={onFind}>
        <FontAwesomeIcon icon={faMagnifyingGlass} className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      {onFormat && !readonly && (
        <button type="button" className={btn} aria-label={messages.format} title={messages.format} onClick={onFormat}>
          <FontAwesomeIcon icon={faWandMagicSparkles} className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
      <button type="button" className={btn} aria-label={copied ? messages.copied : messages.copy} title={copied ? messages.copied : messages.copy}
        onClick={() => { onCopy(); setCopied(true); window.setTimeout(() => setCopied(false), 1500); }}>
        <FontAwesomeIcon icon={copied ? faCheck : faCopy} className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      <button type="button" className={btn} aria-label={fullscreen ? messages.exitFullscreen : messages.fullscreen} title={fullscreen ? messages.exitFullscreen : messages.fullscreen}
        aria-pressed={fullscreen} onClick={onFullscreen}>
        <FontAwesomeIcon icon={fullscreen ? faMinimize : faMaximize} className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}
