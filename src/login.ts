import { chromium } from 'playwright';
import { interactiveLogin } from './auth';

const url = process.argv[2];
if (!url) {
  console.error('Usage: npm run login -- "<job-url>"');
  process.exit(1);
}
await interactiveLogin(await chromium.launch({ headless: false }), url);
