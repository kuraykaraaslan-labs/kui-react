'use client';
import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/libs/utils/cn';
import { Avatar } from '@/modules/ui/Avatar';
import { TypingDots } from './ChatBubble';

export type ChatTypingIndicatorProps = {
  /** "Ada is typing…", already worded by the caller. */
  label: string;
  /** Whose avatar leads the row (the first typer). */
  name?: string;
  avatarUrl?: string | null;
  avatar?: ReactNode;
  showAvatar?: boolean;
} & Omit<HTMLAttributes<HTMLDivElement>, 'children'>;

/** Someone (or something) is writing: an avatar, who, and three pulsing dots in a bubble. */
export function ChatTypingIndicator({
  label,
  name,
  avatarUrl,
  avatar,
  showAvatar = true,
  className,
  ...rest
}: ChatTypingIndicatorProps) {
  return (
    <div {...rest} className={cn('mt-3 flex items-end gap-2', className)} data-part="typing">
      {showAvatar && (
        <div className="w-8 shrink-0" aria-hidden="true">
          {avatar ?? <Avatar src={avatarUrl} name={name || '?'} size="sm" />}
        </div>
      )}
      <div className="flex flex-col items-start">
        <span className="mb-0.5 px-1 text-[11px] font-medium text-text-secondary">{label}</span>
        <div data-part="typing-bubble" className="rounded-2xl rounded-bl-sm bg-surface-overlay px-3.5 py-2.5 text-text-secondary">
          <TypingDots />
        </div>
      </div>
    </div>
  );
}
