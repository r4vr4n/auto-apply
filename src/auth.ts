import fsp from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import type { Browser, BrowserContextOptions, Page } from 'playwright';
import { RunOptions } from './types';

const AUTH_DIR = path.resolve('auth');
fs.mkdirSync(AUTH_DIR, { recursive: true });

/** How long a headed, non-interactive run (web UI / Electron) waits for a manual login. */
const LOGIN_WAIT_MS = 5 * 60_000;

const stateFile = (url: string) =>
  path.join(AUTH_DIR, new URL(url).hostname.replace(/[^a-z0-9.-]/gi, '_') + '.json');

export async function hasSession(url: string): Promise<boolean> {
  try { await fsp.access(stateFile(url)); return true; } catch { return false; }
}
export async function deleteSession(url: string): Promise<void> {
  await fsp.rm(stateFile(url), { force: true });
}

/** Merge into browser.newContext() — loads saved cookies for this host if present. */
export async function withSession(
  url: string,
  opts: BrowserContextOptions = {}
): Promise<BrowserContextOptions> {
  return (await hasSession(url)) ? { ...opts, storageState: stateFile(url) } : opts;
}

const WALLS: Record<string, (p: Page) => Promise<boolean>> = {
  workday: async p =>
    (await p.locator('[data-automation-id="signInLink"], :is(a,button):has-text("Sign In")').count()) > 0,
  icims: async p =>
    (await p.locator('form[action*="login" i], :is(a,button):has-text("Sign in")').count()) > 0,
  generic: async p => {
    try { if (/\/(login|signin|auth)/.test(new URL(p.url()).pathname)) return true; } catch { /* ignore */ }
    return (await p.locator('form[action*="login" i], form[action*="signin" i]').count()) > 0;
  },
};

export async function isLoginWall(page: Page, provider: string): Promise<boolean> {
  try { return await (WALLS[provider] ?? WALLS.generic)(page); } catch { return false; }
}

async function waitForEnter(prompt: string) {
  const rl = readline.createInterface({ input: stdin, output: stdout });
  await rl.question(prompt);
  rl.close();
}

/** Polls until the login wall is gone (the user logs in in the visible browser). */
async function waitForLogin(page: Page, provider: string): Promise<boolean> {
  const deadline = Date.now() + LOGIN_WAIT_MS;
  while (Date.now() < deadline) {
    if (page.isClosed()) return false;
    if (!(await isLoginWall(page, provider))) return true;
    await page.waitForTimeout(2000).catch(() => {});
  }
  return false;
}

/**
 * Called by the runner after page load.
 * Saved session reload -> human login in headed browser (passwords/2FA stay manual)
 * -> fail with instructions.
 */
export async function handleAuthWall(
  page: Page, url: string, provider: string, opts: RunOptions
): Promise<'ok' | 'needs-login'> {
  if (!(await isLoginWall(page, provider))) return 'ok';

  if (await hasSession(url)) {
    await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
    if (!(await isLoginWall(page, provider))) return 'ok';
    await deleteSession(url); // expired
  }

  if (!opts.headed) return 'needs-login';

  const host = new URL(url).hostname;
  if (opts.interactive) {
    console.log(`\n🔒 Login required for ${host}. Complete it in the browser window.`);
    await waitForEnter('Press <Enter> after logging in… ');
  } else {
    console.log(`🔒 Login required for ${host}. Waiting up to ${LOGIN_WAIT_MS / 60_000} min for login in the browser window…`);
    if (!(await waitForLogin(page, provider))) return 'needs-login';
  }
  await page.context().storageState({ path: stateFile(url) });
  console.log(`✅ Session saved -> ${stateFile(url)}`);
  return (await isLoginWall(page, provider)) ? 'needs-login' : 'ok';
}

/** Standalone: `npm run login -- <url>` — log in once, reuse forever. */
export async function interactiveLogin(browser: Browser, url: string): Promise<void> {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  console.log('\n──────────────────────────────────────────────');
  console.log('👉 Log in in the browser window (password, 2FA).');
  console.log('──────────────────────────────────────────────');
  await waitForEnter('Press <Enter> after logging in… ');
  await ctx.storageState({ path: stateFile(url) });
  console.log(`✅ Session saved -> ${stateFile(url)}`);
  await browser.close();
}
