import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { jobPlatformName, jobApplyLinkName, resolveJobApplyMode } from './jobApply';
import { JobApplyActions } from './JobApplyActions';

describe('platform names', () => {
  it('names known job boards and recruiting systems from the address', () => {
    expect(jobPlatformName('https://www.linkedin.com/jobs/view/1')).toBe('LinkedIn');
    expect(jobPlatformName('https://tr.linkedin.com/jobs/view/1')).toBe('LinkedIn');
    expect(jobPlatformName('https://www.stepstone.de/x')).toBe('StepStone');
    expect(jobPlatformName('https://www.stepstone.co.uk/x')).toBe('StepStone');
    expect(jobPlatformName('https://boards.greenhouse.io/acme/jobs/1')).toBe('Greenhouse');
    expect(jobPlatformName('https://acme.wd5.myworkdayjobs.com/x')).toBe('Workday');
  });

  it('keeps the host for anything else, and is not fooled by look-alikes', () => {
    expect(jobPlatformName('https://www.example.com/x')).toBe('example.com');
    expect(jobPlatformName('https://notmonster.com/x')).toBe('notmonster.com');
    expect(jobPlatformName('https://linkedin.com.example.com/x')).toBe('linkedin.com.example.com');
  });

  it('a link with its own label uses it', () => {
    expect(jobApplyLinkName({ url: 'https://de.indeed.com/x', label: ' Indeed DE ' })).toBe('Indeed DE');
    expect(jobApplyLinkName({ url: 'https://de.indeed.com/x', label: '' })).toBe('Indeed');
  });
});

describe('how a job takes applications', () => {
  it('follows the same rules as kui-jobs', () => {
    expect(resolveJobApplyMode(undefined, true)).toBe('LINKS');
    expect(resolveJobApplyMode('BOTH', true)).toBe('BOTH');
    expect(resolveJobApplyMode('FORM', true)).toBe('FORM');
    expect(resolveJobApplyMode('FORM', true, false)).toBe('LINKS');
    expect(resolveJobApplyMode('LINKS', false)).toBe('FORM');
    expect(resolveJobApplyMode('LINKS', false, false)).toBe('NONE');
  });
});

describe('JobApplyActions', () => {
  const links = [{ url: 'https://www.linkedin.com/jobs/view/1' }, { url: 'https://jobs.lever.co/acme/1', label: null }];

  it('applications elsewhere only: one button per platform, a new tab, and the note', () => {
    render(<JobApplyActions job={{ applyLinks: links }} />);
    const a = screen.getByRole('link', { name: /Apply on LinkedIn/ });
    expect(a).toHaveAttribute('href', 'https://www.linkedin.com/jobs/view/1');
    expect(a).toHaveAttribute('target', '_blank');
    expect(a).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByRole('link', { name: /Apply on Lever/ })).toBeInTheDocument();
    expect(screen.queryByText('Apply now')).toBeNull();
    expect(screen.getByText(/taken on the platform above/)).toBeInTheDocument();
  });

  it('both: the form button first, the platforms after it, no note', () => {
    render(<JobApplyActions job={{ applyMode: 'BOTH', applyLinks: links.slice(0, 1) }} applyHref="#apply" />);
    const all = screen.getAllByRole('link');
    expect(all[0]).toHaveTextContent('Apply now');
    expect(all[0]).toHaveAttribute('href', '#apply');
    expect(all[1]).toHaveTextContent(/Apply on LinkedIn/);
    expect(screen.queryByText(/taken on the platform above/)).toBeNull();
  });

  it('no links and no form: nothing', () => {
    const { container } = render(<JobApplyActions job={{}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('texts come from the host', () => {
    render(<JobApplyActions job={{ applyLinks: links.slice(0, 1) }} platformLabel={(n) => `${n} üzerinden başvurun`} note={null} />);
    expect(screen.getByRole('link', { name: /LinkedIn üzerinden başvurun/ })).toBeInTheDocument();
    expect(screen.queryByText(/platform above/)).toBeNull();
  });
});
