import { Profile } from './types';
import { norm } from './text';

const SKIP_RE =
  /gender|race|ethnic|hispanic|latino|veteran|disability|sexual orientation|pronoun|latex/i;

const loc = (p: Profile) =>
  `${p.personal.location.city}, ${p.personal.location.state}, ${p.personal.location.country}`;
const lastEdu = (p: Profile) => p.education[p.education.length - 1];

// Ordered — first match wins
const RULES: Array<[RegExp, (p: Profile) => string]> = [
  [/first name|given name/, p => p.personal.firstName],
  [/last name|surname|family name/, p => p.personal.lastName],
  [/full name|legal name|^name$|your name/, p => p.personal.fullName],
  [/linkedin/, p => p.personal.linkedin],
  [/github/, p => p.personal.github],
  [/portfolio|website|blog/, p => p.personal.portfolio || p.personal.website],
  [/e-?mail/, p => p.personal.email],
  [/phone|mobile|cell/, p => p.personal.phone],
  [/current (company|employer)|most recent (company|employer)|\bcompany\b/, p => p.currentJob.company],
  [/current (job )?title|current role|current position|job title|position/, p => p.currentJob.title],
  [/years? of (total |professional |work )?experience|total experience/, p => p.questions.yearsOfExperience],
  [/authorized to work|legally authorized|work authorization|eligible to work|legally eligible/, p => p.questions.authorizedToWork],
  [/sponsorship|sponsor|visa|work permit/, p => p.questions.requiresSponsorship],
  [/notice period|when (can|will|are) you (start|available|join)/, p => p.questions.noticePeriod],
  [/relocat/, p => p.questions.willingToRelocate],
  [/salary|compensation|expected ctc|\bctc\b/, p => p.questions.salaryExpectation],
  [/street|address line|^address/, p => p.personal.location.street],
  [/^(current )?city|town/, p => p.personal.location.city],
  [/state|province|region/, p => p.personal.location.state],
  [/zip|postal|postcode|pin ?code/, p => p.personal.location.zip],
  [/country/, p => p.personal.location.country],
  [/location|where are you (based|located)|based out of/, loc],
  [/how many years|years.*skills|skills.*years/, p => p.questions.skillsYearsDefault],
  [/degree|education|field of study|major|graduation/, p => lastEdu(p)?.degree ?? ''],
  [/university|college|school/, p => lastEdu(p)?.school ?? ''],
];

/** Value to type, or null to skip. Order: user overrides -> EEO skip-list -> synonyms. */
export function resolveValue(question: string, p: Profile): string | null {
  const q = norm(question);
  if (!q) return null;
  for (const rule of p.answers ?? []) {
    if (rule.match.some(k => q.includes(norm(k)))) return rule.value || null;
  }
  if (SKIP_RE.test(q)) return null;
  for (const [re, get] of RULES) {
    if (re.test(q)) {
      const v = get(p);
      if (v && v.trim()) return v;
    }
  }
  return null;
}
