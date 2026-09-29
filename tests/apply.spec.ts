import { test } from '@playwright/test';
import { chromium } from 'playwright';
import { loadProfile } from '../src/profile';
import { printReport, runApplication } from '../src/runner';
import { withSession } from '../src/auth';

test('auto-fills a job application from profile.json', async () => {
  const url = process.env.JOB_URL;
  test.skip(!url, 'Set JOB_URL=<application url> to run. Add HEADED=1 to watch.');
  if (!url) return;

  const headed = process.env.HEADED === '1';
  const profile = loadProfile(process.env.PROFILE_PATH);
  if (process.env.AUTO_SUBMIT === '1') profile.settings.submit = true;

  const browser = await chromium.launch({ headless: !headed, slowMo: 30 });
  const context = await browser.newContext(
    await withSession(url, { viewport: { width: 1440, height: 900 } })
  );
  const page = await context.newPage();

  // Playwright's runner has no usable stdin, so never block on <Enter>
  const report = await runApplication(page, profile, url, { headed, interactive: false });

  printReport(report);
  if (!report.submitted && !report.needsLogin)
    console.log('\n(Left unsubmitted for your review — AUTO_SUBMIT=1 to change.)');

  await browser.close();
});
