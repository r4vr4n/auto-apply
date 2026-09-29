export interface Location {
  street: string; city: string; state: string; stateCode: string;
  zip: string; country: string; countryCode: string;
}
export interface PersonalInfo {
  firstName: string; lastName: string; fullName: string;
  email: string; phone: string; linkedin: string; github: string;
  portfolio: string; website: string; headline: string; location: Location;
}
export interface ExperienceItem {
  title: string; company: string; location: string; type: string;
  startDate: string; endDate: string; current: boolean; bullets: string[];
}
export interface EducationItem {
  degree: string; school: string; location: string;
  startDate: string; endDate: string; credentialId?: string;
}
export interface AnswerRule { match: string[]; value: string; }
export interface Profile {
  personal: PersonalInfo;
  currentJob: { title: string; company: string; startDate: string; location: string };
  experience: ExperienceItem[];
  education: EducationItem[];
  skills: Record<string, string[]>;
  questions: {
    yearsOfExperience: string; skillsYearsDefault: string; noticePeriod: string;
    willingToRelocate: string; requiresSponsorship: string;
    authorizedToWork: string; salaryExpectation: string;
  };
  answers: AnswerRule[];
  documents: { resume: string; coverLetterText: string };
  settings: { submit: boolean; typingDelayMs: number; screenshots: boolean };
}
export interface FillEntry { field: string; value: string; }
export interface Report {
  provider: string; url: string;
  filled: FillEntry[]; skipped: string[]; uploaded: string[];
  submitted: boolean; needsLogin?: boolean;
  screenshots: string[]; errors: string[];
}
/**
 * headed: show the browser.
 * interactive: a terminal is attached, so login can wait for <Enter>.
 * Headed but not interactive (web UI / Electron): login waits for the wall to disappear.
 */
export interface RunOptions { headed: boolean; interactive: boolean; }
