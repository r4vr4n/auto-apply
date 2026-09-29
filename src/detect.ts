export type Provider =
  | 'workday' | 'greenhouse' | 'lever' | 'ashby' | 'icims' | 'taleo'
  | 'smartrecruiters' | 'jobvite' | 'breezy' | 'teamtailor' | 'generic';

export function detectProvider(url: string): Provider {
  const u = (url || '').toLowerCase();
  if (/myworkday|myworkdayjobs/.test(u)) return 'workday';
  if (/greenhouse\.io|grnh\.se/.test(u)) return 'greenhouse';
  if (/lever\.co/.test(u)) return 'lever';
  if (/ashbyhq\.com/.test(u)) return 'ashby';
  if (/icims\.com/.test(u)) return 'icims';
  if (/taleo\.net/.test(u)) return 'taleo';
  if (/smartrecruiters\.com/.test(u)) return 'smartrecruiters';
  if (/jobvite\.com/.test(u)) return 'jobvite';
  if (/breezy\.hr/.test(u)) return 'breezy';
  if (/teamtailor/.test(u)) return 'teamtailor';
  return 'generic';
}
