import { chromium } from 'playwright';
import { loadProfile } from './profile';
import { errorReport, printReport, runApplication } from './runner';
import { withSession } from './auth';

const args = process.argv.slice(2);
const urls = args.filter(a => !a.startsWith('--'));
const headed = args.includes('--headed');
const submit = args.includes('--submit');

if (!urls.length) {
  console.error('Usage: npm run cli -- <url...> [--headed] [--submit]');
  process.exit(1);
}

const profile = loadProfile();
if (submit) profile.settings.submit = true;

const browser = await chromium.launch({ headless: !headed, slowMo: 25 });

for (const url of urls) {
  const context = await browser.newContext(
    await withSession(url, { viewport: { width: 1440, height: 900 } })
  );
  const page = await context.newPage();
  const report = await runApplication(page, profile, url, { headed, interactive: true })
    .catch(e => errorReport(url, e));
  printReport(report);
  await context.close();
}

await browser.close();
