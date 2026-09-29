import type { Page } from 'playwright';
import { Profile, Report } from '../types';
import { tryFillSelector } from '../fill';

const FIELDS: Array<[string, (p: Profile) => string]> = [
  ['input[name="name"]', p => p.personal.fullName],
  ['input[name="email"]', p => p.personal.email],
  ['input[name="phone"]', p => p.personal.phone],
  ['input[name="urls[LinkedIn]"]', p => p.personal.linkedin],
  ['input[name="urls[GitHub]"]', p => p.personal.github],
  ['input[name="urls[Portfolio]"]', p => p.personal.portfolio || p.personal.website],
  ['input[name="location"]',
    p => `${p.personal.location.city}, ${p.personal.location.state}, ${p.personal.location.country}`],
];

export async function fillLever(page: Page, profile: Profile, report: Report) {
  for (const [sel, get] of FIELDS) await tryFillSelector(page, sel, get(profile), report);
}
