'use client';
import { Fragment, isValidElement } from 'react';
import { cn } from '@/libs/utils/cn';
import { sortByOrder } from '@/libs/utils/orderItems';

/** One control in a top-bar region, e.g. a contributed notification bell. */
export type AppTopBarItem = {
  id: string;
  node: React.ReactNode;
  /** Position in the region, like CSS `order`: missing counts as 0, ties keep array order. */
  order?: number;
  hidden?: boolean;
};

/** A region takes ordered items or any node. */
export type AppTopBarRegion = AppTopBarItem[] | React.ReactNode;

type AppTopBarProps = {
  logo?: React.ReactNode;
  /** Controls right after the logo. */
  start?: AppTopBarRegion;
  /** Controls pushed to the far end of the bar. */
  end?: AppTopBarRegion;
  children?: React.ReactNode;
  className?: string;
} & React.HTMLAttributes<HTMLDivElement>;

function isItemList(region: AppTopBarRegion): region is AppTopBarItem[] {
  return (
    Array.isArray(region) &&
    region.length > 0 &&
    region.every((r) => r !== null && typeof r === 'object' && !isValidElement(r) && 'id' in r && 'node' in r)
  );
}

function Region({ name, region }: { name: 'start' | 'end'; region: AppTopBarRegion }) {
  if (region === null || region === undefined || region === false) return null;
  if (Array.isArray(region) && region.length === 0) return null;
  let content: React.ReactNode = region as React.ReactNode;
  if (isItemList(region)) {
    const visible = sortByOrder(region.filter((item) => !item.hidden));
    if (visible.length === 0) return null;
    content = visible.map((item) => <Fragment key={item.id}>{item.node}</Fragment>);
  }
  return (
    <div data-region={name} className={cn('flex items-center gap-2', name === 'end' && 'ml-auto shrink-0')}>
      {content}
    </div>
  );
}

export function AppTopBar({
  logo,
  start,
  end,
  children,
  className,
  ...rest
}: AppTopBarProps) {
  return (
    // min-w-0: in a narrow header the bar shrinks with it instead of keeping its content's width, so a
    // flex-1 child (a search box) gives up its room before the end controls are pushed out of view.
    <div className={cn('flex min-w-0 items-center gap-3 flex-1', className)} {...rest}>
      {logo && <div className="shrink-0">{logo}</div>}
      <Region name="start" region={start} />
      {children}
      <Region name="end" region={end} />
    </div>
  );
}
