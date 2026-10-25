'use client';
import { ChatBubble, type ChatDeliveryStatus } from '@/modules/ui/ChatThread';

export type MessageDeliveryStatus = ChatDeliveryStatus;

type MessageBubbleProps = {
  side: 'incoming' | 'outgoing';
  authorName?: string;
  avatarUrl?: string | null;
  body: string;
  sentAt: Date | string;
  status?: MessageDeliveryStatus;
  groupedWithPrevious?: boolean;
  className?: string;
};

function shortTime(date: Date | string): string {
  return new Date(date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

/** A direct-message bubble: the kit's `ChatBubble` (see `ChatThread`) with the social feed's props. */
export function MessageBubble({
  side,
  authorName,
  avatarUrl,
  body,
  sentAt,
  status,
  groupedWithPrevious,
  className,
}: MessageBubbleProps) {
  return (
    <ChatBubble
      side={side === 'outgoing' ? 'own' : 'other'}
      authorName={authorName ?? ''}
      showAuthor={side === 'incoming' && !!authorName}
      avatarUrl={avatarUrl}
      body={body}
      time={shortTime(sentAt)}
      dateTime={new Date(sentAt).toISOString()}
      delivery={status}
      deliveryLabels={{ sent: 'Message sent', delivered: 'Message delivered', read: 'Message read' }}
      grouped={groupedWithPrevious}
      className={className}
    />
  );
}
