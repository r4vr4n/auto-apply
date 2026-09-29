import fs from 'node:fs';
import path from 'node:path';
import { Profile } from './types';

export function loadProfile(p = 'profile.json'): Profile {
  const abs = path.resolve(p);
  const raw = JSON.parse(fs.readFileSync(abs, 'utf8')) as Profile;
  if (raw.documents?.resume && !path.isAbsolute(raw.documents.resume))
    raw.documents.resume = path.resolve(path.dirname(abs), raw.documents.resume);
  return raw;
}
