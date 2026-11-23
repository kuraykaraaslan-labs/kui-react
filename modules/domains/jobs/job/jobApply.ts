import type { JobApplyLink, JobApplyMode } from '../types';

/**
 * Job boards and recruiting systems by address, for a link's name when it has none. A key with a dot matches that
 * domain and its subdomains; a key without one matches any of its country domains (stepstone.de, stepstone.co.uk).
 * Kept identical to kui-wordpress-saas plugin/kui-jobs (Jobs::PLATFORMS).
 */
const PLATFORMS: ReadonlyArray<readonly [string, string]> = [
  ['linkedin.com', 'LinkedIn'],
  ['indeed.com', 'Indeed'],
  ['glassdoor.com', 'Glassdoor'],
  ['xing.com', 'XING'],
  ['stepstone', 'StepStone'],
  ['monster', 'Monster'],
  ['welcometothejungle.com', 'Welcome to the Jungle'],
  ['wellfound.com', 'Wellfound'],
  ['angel.co', 'Wellfound'],
  ['otta.com', 'Otta'],
  ['kariyer.net', 'Kariyer.net'],
  ['secretcv.com', 'Secret CV'],
  ['youthall.com', 'Youthall'],
  ['naukri.com', 'Naukri'],
  ['seek.com', 'SEEK'],
  ['infojobs', 'InfoJobs'],
  ['pracuj.pl', 'Pracuj.pl'],
  ['jobs.ch', 'jobs.ch'],
  ['bayt.com', 'Bayt'],
  ['workable.com', 'Workable'],
  ['greenhouse.io', 'Greenhouse'],
  ['lever.co', 'Lever'],
  ['ashbyhq.com', 'Ashby'],
  ['smartrecruiters.com', 'SmartRecruiters'],
  ['personio', 'Personio'],
  ['recruitee.com', 'Recruitee'],
  ['teamtailor.com', 'Teamtailor'],
  ['bamboohr.com', 'BambooHR'],
  ['myworkdayjobs.com', 'Workday'],
  ['join.com', 'JOIN'],
  ['github.com', 'GitHub'],
];

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A platform's name from its address: a known job board or recruiting system, else the host without "www.". */
export function jobPlatformName(url: string): string {
  let host = '';
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return url;
  }
  host = host.replace(/^www\./, '');
  for (const [needle, name] of PLATFORMS) {
    if (host === needle || host.endsWith(`.${needle}`)) return name;
    if (!needle.includes('.') && new RegExp(`(^|\\.)${escape(needle)}\\.`).test(host)) return name;
  }
  return host;
}

/** The button name for one link: its own label, else the platform. */
export function jobApplyLinkName(link: JobApplyLink): string {
  return link.label?.trim() || jobPlatformName(link.url);
}

/**
 * How a job takes applications. Without links only the form is left (or nothing, when the host has no form);
 * without a form only the links; no choice with links means the links. Same rules as kui-jobs' Jobs::apply_mode.
 */
export function resolveJobApplyMode(
  mode: JobApplyMode | null | undefined,
  hasLinks: boolean,
  hasForm = true,
): JobApplyMode | 'NONE' {
  if (!hasLinks) return hasForm ? 'FORM' : 'NONE';
  if (!hasForm || (mode !== 'FORM' && mode !== 'BOTH')) return 'LINKS';
  return mode;
}
