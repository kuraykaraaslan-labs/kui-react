'use client';
import { ChatTypingIndicator } from '@/modules/ui/ChatThread';

type TypingIndicatorProps = {
  name: string;
  avatarUrl?: string | null;
  className?: string;
};

/** "Ada is typing…": the kit's `ChatTypingIndicator` as its own live region. */
export function TypingIndicator({ name, avatarUrl, className }: TypingIndicatorProps) {
  return (
    <ChatTypingIndicator
      label={`${name} is typing…`}
      name={name}
      avatarUrl={avatarUrl}
      className={className}
      aria-live="polite"
      aria-label={`${name} is typing`}
    />
  );
}
