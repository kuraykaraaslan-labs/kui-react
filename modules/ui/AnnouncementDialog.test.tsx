import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AnnouncementDialog } from './AnnouncementDialog';
import { AlertBanner } from './AlertBanner';

describe('AnnouncementDialog', () => {
  it('renders nothing when closed', () => {
    render(<AnnouncementDialog open={false} title="Hidden" onAcknowledge={() => {}} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows the title, the body, the meta, the link and the position, and acknowledges with OK', async () => {
    const onAcknowledge = vi.fn();
    const user = userEvent.setup();
    render(
      <AnnouncementDialog
        open
        title="Planned maintenance"
        body={'Saturday 02:00-04:00.\nSaving is paused.'}
        meta="Platform team"
        link={{ href: 'https://status.example.com', label: 'Status page', external: true }}
        position="1 of 2"
        onAcknowledge={onAcknowledge}
      />,
    );
    const dialog = screen.getByRole('dialog');
    expect(document.getElementById(dialog.getAttribute('aria-labelledby')!)?.textContent).toBe('Planned maintenance');
    expect(document.getElementById(dialog.getAttribute('aria-describedby')!)?.textContent).toContain('Saving is paused.');
    expect(screen.getByText('Platform team')).toBeInTheDocument();
    expect(screen.getByText('1 of 2')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /Status page/ });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    await user.click(screen.getByRole('button', { name: 'OK' }));
    expect(onAcknowledge).toHaveBeenCalledTimes(1);
  });

  it('dismisses through the close button and Escape when not required', async () => {
    const onDismiss = vi.fn();
    const onAcknowledge = vi.fn();
    const user = userEvent.setup();
    render(<AnnouncementDialog open title="News" onAcknowledge={onAcknowledge} onDismiss={onDismiss} closeLabel="Close" />);
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await user.keyboard('{Escape}');
    expect(onDismiss).toHaveBeenCalledTimes(2);
    expect(onAcknowledge).not.toHaveBeenCalled();
  });

  it('falls back to onAcknowledge when closed without an onDismiss', async () => {
    const onAcknowledge = vi.fn();
    const user = userEvent.setup();
    render(<AnnouncementDialog open title="News" onAcknowledge={onAcknowledge} />);
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onAcknowledge).toHaveBeenCalledTimes(1);
  });

  it('a critical announcement must be acknowledged: an alert dialog with no close button, Escape does nothing', async () => {
    const onDismiss = vi.fn();
    const onAcknowledge = vi.fn();
    const user = userEvent.setup();
    render(
      <AnnouncementDialog open severity="critical" severityLabel="Critical" title="Outage" onAcknowledge={onAcknowledge} onDismiss={onDismiss} />,
    );
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveAttribute('data-severity', 'critical');
    expect(screen.getByText('Critical')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(onDismiss).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'OK' }));
    expect(onAcknowledge).toHaveBeenCalledTimes(1);
  });

  it('required overrides the severity default', () => {
    render(<AnnouncementDialog open required title="Terms changed" onAcknowledge={() => {}} />);
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
  });

  it('busy locks the acknowledgement and the way out', async () => {
    const onAcknowledge = vi.fn();
    const onDismiss = vi.fn();
    const user = userEvent.setup();
    render(<AnnouncementDialog open busy title="News" acknowledgeLabel="Got it" onAcknowledge={onAcknowledge} onDismiss={onDismiss} />);
    expect(screen.getByRole('button', { name: /Got it/ })).toBeDisabled();
    await user.keyboard('{Escape}');
    expect(onDismiss).not.toHaveBeenCalled();
  });
});

describe('AlertBanner onDismiss', () => {
  it('tells the host when the person dismisses it', async () => {
    const onDismiss = vi.fn();
    const user = userEvent.setup();
    render(<AlertBanner dismissible onDismiss={onDismiss} message="Maintenance on Saturday" />);
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Maintenance on Saturday')).not.toBeInTheDocument();
  });
});
