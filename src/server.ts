import path from 'node:path';
import express from 'express';
import { chromium } from 'playwright';
import { loadProfile } from './profile';
import { errorReport, runApplication } from './runner';
import { withSession } from './auth';
import { Report } from './types';

const app = express();
app.use(express.json());
app.use(express.static(path.resolve('public')));

app.post('/api/apply', async (req, res) => {
  const { urls = [], headed = false, submit = false } = req.body ?? {};
  const out: Report[] = [];
  try {
    const profile = loadProfile();
    if (submit) profile.settings.submit = true;
    const browser = await chromium.launch({ headless: !headed, slowMo: 30 });
    try {
      for (const url of urls as string[]) {
        const ctx = await browser.newContext(
          await withSession(url, { viewport: { width: 1440, height: 900 } })
        );
        const page = await ctx.newPage();
        // No terminal here: headed runs wait for the login wall to clear instead of <Enter>
        out.push(await runApplication(page, profile, url, { headed, interactive: false })
          .catch(e => errorReport(url, e)));
        await ctx.close();
      }
    } finally {
      await browser.close();
    }
    res.json(out);
  } catch (e: any) {
    res.status(500).json({ error: String(e?.message ?? e), results: out });
  }
});

const port = Number(process.env.PORT ?? 5173);
app.listen(port, () => console.log(`Auto Apply UI -> http://localhost:${port}`));
