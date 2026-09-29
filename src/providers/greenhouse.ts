import type { Page } from 'playwright';
import { Profile, Report } from '../types';
import { tryFillSelector } from '../fill';

const FIELDS: Array<[string, (p: Profile) => string]> = [
  ['#first_name, input[name="job_application[first_name]"]', p => p.personal.firstName],
  ['#last_name, input[name="job_application[last_name]"]', p => p.personal.lastName],
  ['#email, input[name="job_application[email]"]', p => p.personal.email],
  ['#phone, input[name="job_application[phone]"]', p => p.personal.phone],
  ['input[name="job_application[location]"]',
    p => `${p.personal.location.city}, ${p.personal.location.state}`],
];

export async function fillGreenhouse(page: Page, profile: Profile, report: Report) {
  for (const [sel, get] of FIELDS) await tryFillSelector(page, sel, get(profile), report);
  // LinkedIn URL, custom questions, EEO, resume upload -> generic engine
}
