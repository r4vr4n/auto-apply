import fs from 'node:fs';
import path from 'node:path';
import type { Frame, Locator, Page } from 'playwright';
import { Profile, Report } from './types';
import { resolveValue } from './answer';
import { bestOptionIndex, norm } from './text';

/** Runs in the browser: describes every form control + tags it with a temp index. */
const DESCRIBE_JS = `() => {
  const els = Array.from(document.querySelectorAll('input, textarea, select'));
  const ownLabel = (el) => {
    let t = '';
    if (el.id && window.CSS && CSS.escape) {
      const l = document.querySelector('label[for="' + CSS.escape(el.id) + '"]');
      if (l) t += ' ' + l.innerText;
    }
    const wrap = el.closest('label'); if (wrap) t += ' ' + wrap.innerText;
    const lb = el.getAttribute('aria-labelledby');
    if (lb) lb.split(/\\s+/).forEach(id => { const n = document.getElementById(id); if (n) t += ' ' + n.innerText; });
    t += ' ' + (el.getAttribute('aria-label') || '');
    return t.replace(/\\s+/g, ' ').trim();
  };
  const question = (el) => {
    const fs2 = el.closest('fieldset');
    if (fs2) { const lg = fs2.querySelector('legend'); if (lg && lg.innerText.trim()) return lg.innerText.trim(); }
    let node = el.closest('div,section,li,td');
    for (let i = 0; i < 4 && node; i++) {
      const cands = Array.from(node.querySelectorAll('legend, h1, h2, h3, h4, label, [class*="question" i]'))
        .filter(x => !x.contains(el) && x.innerText && x.innerText.trim());
      if (cands.length) return cands[cands.length - 1].innerText.trim();
      node = node.parentElement ? node.parentElement.closest('div,section,li,td') : null;
    }
    return '';
  };
  return els.map((el, i) => {
    el.setAttribute('data-auto-idx', String(i));
    return {
      i,
      tag: el.tagName.toLowerCase(),
      type: (el.getAttribute('type') || '').toLowerCase(),
      name: el.name || '', id: el.id || '',
      value: el.value || '', checked: !!el.checked,
      disabled: !!el.disabled || !!el.readOnly,
      ownLabel: ownLabel(el).slice(0, 300),
      question: question(el).slice(0, 300),
      options: el.tagName === 'SELECT' ? Array.from(el.options).map(o => o.text) : null,
    };
  });
}`;

export async function setTextField(loc: Locator, value: string) {
  try { await loc.fill(value, { timeout: 4000 }); return; } catch { /* fall through */ }
  try {
    await loc.evaluate((el: any, v: string) => {
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, value);
  } catch { /* ignore */ }
}

export async function tryFillSelector(page: Page, sel: string, value: string, report: Report) {
  if (!value) return;
  const loc = page.locator(sel).first();
  if (!(await loc.count())) return;
  try {
    const cur = await loc.inputValue({ timeout: 2000 });
    if (cur && cur.trim()) return;
  } catch { return; }
  await setTextField(loc, value);
  report.filled.push({ field: sel, value });
}

const qOf = (d: any) =>
  [d.question, d.ownLabel, d.name, d.id].filter(Boolean).join(' | ');

export async function fillFrame(frame: Frame, profile: Profile, report: Report) {
  let descs: any[];
  try { descs = await frame.evaluate(DESCRIBE_JS); } catch { return; }

  const locOf = (d: any) => frame.locator(`[data-auto-idx="${d.i}"]`);

  for (const d of descs) {
    try {
      if (d.disabled) continue;
      if (['hidden', 'submit', 'button', 'reset', 'image'].includes(d.type)) continue;
      const q = qOf(d);
      const loc = locOf(d);

      // File upload -> resume
      if (d.type === 'file') {
        const resume = profile.documents.resume;
        if (resume && fs.existsSync(resume)) {
          try {
            await loc.setInputFiles(resume);
            report.uploaded.push(`${q || d.name} -> ${path.basename(resume)}`);
          } catch { /* try next */ }
        }
        continue;
      }

      // Selects
      if (d.tag === 'select') {
        if (d.value && d.value.trim()) continue;
        const v = resolveValue(q, profile);
        if (!v) { if (q.trim()) report.skipped.push(q); continue; }
        const idx = bestOptionIndex(d.options ?? [], v);
        if (idx < 0) { report.skipped.push(`${q} (no option for "${v}")`); continue; }
        await loc.selectOption({ index: idx });
        report.filled.push({ field: q, value: d.options[idx] });
        continue;
      }

      // Checkboxes: profile says yes, or consent-style boxes
      if (d.type === 'checkbox') {
        if (d.checked) continue;
        const v = resolveValue(q, profile);
        const l = norm(q);
        if ((v && /^(yes|true|y)\b/i.test(v)) || /agree|consent|terms|privacy/.test(l)) {
          try {
            await loc.check({ timeout: 2000 });
            report.filled.push({ field: q, value: 'checked' });
          } catch { /* ignore */ }
        }
        continue;
      }

      if (d.type === 'radio') continue; // handled as groups below
      if (d.value && d.value.trim()) continue;

      const v = resolveValue(q, profile);
      if (!v) { if (q.trim()) report.skipped.push(q); continue; }
      await setTextField(loc, v);
      report.filled.push({ field: q, value: v });
    } catch (e: any) {
      report.errors.push(`#${d.i}: ${e?.message ?? e}`);
    }
  }

  // Radio groups
  const groups = new Map<string, any[]>();
  for (const d of descs.filter(x => x.type === 'radio')) {
    const k = d.name || `g${d.i}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(d);
  }
  for (const [, g] of groups) {
    try {
      if (g.some((d: any) => d.checked)) continue;
      const q = qOf(g[0]);
      const v = resolveValue(q, profile);
      if (!v) { report.skipped.push(q); continue; }
      const texts = g.map((d: any) => norm(d.ownLabel));
      const want = norm(v);
      let idx = texts.findIndex(t => t === want || t.startsWith(want));
      if (idx < 0) idx = texts.findIndex(t => t.includes(want));
      if (idx < 0) { report.skipped.push(`${q} (no option "${v}")`); continue; }
      await frame.locator(`[data-auto-idx="${g[idx].i}"]`).check({ timeout: 2500 });
      report.filled.push({ field: q, value: g[idx].ownLabel });
    } catch (e: any) {
      report.errors.push(`radio: ${e?.message ?? e}`);
    }
  }
}

export async function fillAllFrames(page: Page, profile: Profile, report: Report) {
  for (const frame of page.frames()) {
    try { await fillFrame(frame, profile, report); }
    catch (e: any) { report.errors.push(`frame: ${e?.message ?? e}`); }
  }
}

// A bare "Apply" button is usually the job-description CTA, not the final submit,
// so only accept "Apply" when it's a real form submit button.
const SUBMIT_SELECTORS = [
  'button[data-automation-id="submit"]',
  'button:has-text("Submit Application")',
  'button:has-text("Send Application")',
  'input[type="submit"]',
  'button:has-text("Submit")',
  'form button[type="submit"]:has-text("Apply")',
];

export async function maybeSubmit(page: Page, profile: Profile, report: Report) {
  if (!report.filled.length && !report.uploaded.length) return; // never submit an untouched page
  for (const sel of SUBMIT_SELECTORS) {
    const btn = page.locator(sel).first();
    if (!(await btn.count())) continue;
    if (!(await btn.isVisible().catch(() => false))) continue;
    const label = ((await btn.evaluate((el: any) => el.innerText || el.value || '').catch(() => '')) ?? '').trim();
    if (/save|back|cancel|preview|next|sign in/i.test(label)) continue;
    if (profile.settings.submit) {
      await btn.click().catch(() => {});
      await page.waitForTimeout(3000);
      report.submitted = true;
      report.filled.push({ field: '__submitted__', value: label });
    } else {
      report.errors.push(`NOT submitted — "${label}" is ready. Set settings.submit=true or click manually.`);
    }
    return;
  }
}
