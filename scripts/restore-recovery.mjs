import { readFile } from 'node:fs/promises';
import { getApp } from 'firebase/app';
import { terminate } from 'firebase/firestore';
import { db } from '../src/Firebase/config.js';
import { buildRecoveryPlan } from '../src/utils/recoveryPlan.js';
import { restoreFromBackup } from '../src/utils/restoreFirestore.js';

const source = new URL('../recovery/recoverdata.json', import.meta.url);
const backup = JSON.parse(await readFile(source, 'utf8'));
const plan = buildRecoveryPlan(backup);
const targetProjectId = 'dmcdemo-ccfba';
const configuredProjectId = getApp().options.projectId;
console.log(`Backup: ${plan.originalCount} exact documents, ${plan.inferredProjects.length} reconstructed projects, ${plan.records.length} total records.`);
console.log(`Firebase project: ${configuredProjectId}`);
if (process.argv.includes('--dry-run')) {
  console.log('Dry run only; Firestore was not changed.');
} else {
  if (configuredProjectId !== targetProjectId) {
    throw new Error(`Refusing to restore to ${configuredProjectId}; expected ${targetProjectId}.`);
  }
  const result = await restoreFromBackup(backup, ({ written, total }) => console.log(`Written ${written}/${total}`));
  console.log(`Verified ${result.records.length} document IDs; wrote ${result.written}, already present ${result.skipped}.`);
}
await terminate(db);
