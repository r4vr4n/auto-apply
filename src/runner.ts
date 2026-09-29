import fs from 'node:fs';
import path from 'node:path';
import type { Page } from 'playwright';
import { Profile, Report, RunOptions } from './types';
import { detectProvider } from './detect';
import { fillAllFrames, maybeSubmit } from './fill';
import { handleAuthWall } from './auth';
import { workdayFlow } from './providers/workday';
import { fillGreenhouse } from './providers/greenhouse';
import { fillLever } from './providers/lever';

async function snapshot(page: Page, report: Report, on: boolean) {
  if (!on) return;
  fs.mkdirSync('runs', { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const shot = path.join('runs', `${ts}-${report.provider}.png`);
  await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
  report.screenshots.push(shot);
  fs.writeFileSync(
    path.join('runs', `${ts}-${report.provider}.json`),
    JSON.stringify(report, null, 2)
  );
}

export function errorReport(url: string, e: any): Report {
  return {
    provider: 'error', url, filled: [], skipped: [], uploaded: [],
    submitted: false, screenshots: [], errors: [String(e?.message ?? e)],
  };
}

export async function runApplication(
  page: Page, profile: Profile, url: string, opts: RunOptions
): Promise<Report> {
  const report: Report = {
    provider: 'generic', url,
    filled: [], skipped: [], uploaded: [],
    submitted: false, screenshots: [], errors: [],
  };

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(1500);

  report.provider = detectProvider(page.url());

  // ── Auth gate before any filling ──
  const auth = await handleAuthWall(page, url, report.provider, opts);
  if (auth === 'needs-login') {
    report.needsLogin = true;
    report.errors.push(`Login required. Run: npm run login -- "${url}"`);
    await snapshot(page, report, profile.settings.screenshots);
    return report;
  }

  if (report.provider === 'workday') {
    await workdayFlow(page, profile, report);
  } else {
    if (report.provider === 'greenhouse')
      await fillGreenhouse(page, profile, report).catch(e => report.errors.push(String(e)));
    if (report.provider === 'lever')
      await fillLever(page, profile, report).catch(e => report.errors.push(String(e)));

    await fillAllFrames(page, profile, report);

    // Nothing filled? Probably a job *description* page -> click Apply once and retry.
    if (!report.filled.length && !report.uploaded.length) {
      const apply = page.locator('a:has-text("Apply"), button:has-text("Apply")').first();
      if (await apply.count().catch(() => 0)) {
        await apply.click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(2500);
        await fillAllFrames(page, profile, report);
      }
    }
    await maybeSubmit(page, profile, report);
  }

  await snapshot(page, report, profile.settings.screenshots);
  return report;
}

export function printReport(report: Report) {
  console.log(`\n=== ${report.url} ===  provider=${report.provider}  submitted=${report.submitted}`);
  for (const f of report.filled) console.log(`  filled  ${f.field} = ${f.value}`);
  for (const s of report.skipped) console.log(`  skipped ${s}`);
  for (const u of report.uploaded) console.log(`  upload  ${u}`);
  for (const e of report.errors) console.log(`  ERROR   ${e}`);
}
