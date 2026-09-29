import type { Page } from 'playwright';
import { Profile, Report } from '../types';
import { fillAllFrames, maybeSubmit, setTextField } from '../fill';
import { norm } from '../text';

const WA = (id: string) => `[data-automation-id="${id}"]`;

const TEXT: Array<[string, (p: Profile) => string]> = [
  [WA('legalNameSection_firstName'), p => p.personal.firstName],
  [WA('legalNameSection_lastName'), p => p.personal.lastName],
  [WA('phone'), p => p.personal.phone],
  [WA('email'), p => p.personal.email],
];

/** Workday custom dropdown: click widget, pick matching [role=option]. Skips if already set. */
async function dropdown(page: Page, containerSel: string, value: string, report: Report) {
  if (!value) return false;
  const trigger = page.locator(containerSel).first();
  if (!(await trigger.count())) return false;
  const shown = await trigger.innerText({ timeout: 1500 }).catch(() => '');
  if (norm(shown).includes(norm(value))) return true;
  try { await trigger.click({ timeout: 2500 }); } catch { return false; }
  await page.waitForTimeout(500);
  try {
    await page.locator('[role="option"], [data-automation-id="selectOption"]', { hasText: value })
      .first().click({ timeout: 3000 });
    report.filled.push({ field: containerSel, value });
    return true;
  } catch {
    await page.keyboard.press('Escape').catch(() => {});
    return false;
  }
}

/** Typeahead (e.g. "Where are you located?"): type -> pick first suggestion. Skips if already set. */
async function typeahead(page: Page, sel: string, value: string, report: Report) {
  if (!value) return false;
  const inp = page.locator(sel).first();
  if (!(await inp.count())) return false;
  const cur = await inp.inputValue({ timeout: 1500 }).catch(() => null);
  if (cur === null || cur.trim()) return false; // not an input, or already filled
  await inp.click({ timeout: 2000 }).catch(() => {});
  await inp.fill(value, { timeout: 2500 }).catch(() => {});
  await page.waitForTimeout(800);
  try {
    await page.locator('[role="option"], [data-automation-id="selectOption"]').first()
      .click({ timeout: 3000 });
    report.filled.push({ field: sel, value });
    return true;
  } catch { return false; }
}

export async function workdayFlow(page: Page, profile: Profile, report: Report) {
  // Job description page -> enter the flow
  const apply = page.locator('button[data-automation-id="applyButton"], button:has-text("Apply")').first();
  if (await apply.count().catch(() => 0)) {
    await apply.click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(2000);
  }

  // Multi-step: fill -> Next -> fill -> Next …
  for (let step = 0; step < 12; step++) {
    for (const [sel, get] of TEXT) {
      const loc = page.locator(sel).first();
      if (!(await loc.count().catch(() => 0))) continue;
      try {
        const cur = await loc.inputValue({ timeout: 1500 });
        if (cur && cur.trim()) continue;
      } catch { continue; }
      await setTextField(loc, get(profile));
      report.filled.push({ field: sel, value: get(profile) });
    }

    await fillAllFrames(page, profile, report); // generic engine covers the rest

    // Resume upload widget (hidden file input)
    if (!report.uploaded.length && profile.documents.resume) {
      const inputs = page.locator('input[type="file"]');
      const n = Math.min(await inputs.count().catch(() => 0), 3);
      for (let i = 0; i < n; i++) {
        try {
          await inputs.nth(i).setInputFiles(profile.documents.resume);
          report.uploaded.push(`workday file input #${i}`);
          break;
        } catch { /* try next */ }
      }
    }

    // Only acts on steps that actually render these widgets, and leaves set values alone
    const L = profile.personal.location;
    if (await dropdown(page, WA('addressSection_country'), L.country, report))
      await page.waitForTimeout(300); // state list reloads after country
    await dropdown(page, WA('addressSection_state'), L.state, report);
    await typeahead(page, 'input[aria-label*="ocation" i]', `${L.city}, ${L.state}`, report);

    const next = page.locator('button[data-automation-id="nextButton"], button:has-text("Next")').first();
    if ((await next.count().catch(() => 0)) && (await next.isVisible().catch(() => false))) {
      report.filled.push({ field: '__step__', value: `advanced step ${step + 1}` });
      await next.click().catch(() => {});
      await page.waitForTimeout(1500);
      continue;
    }
    break;
  }

  await maybeSubmit(page, profile, report);
}
