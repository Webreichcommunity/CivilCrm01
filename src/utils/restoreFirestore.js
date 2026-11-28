import { collection, doc, getDocsFromServer, writeBatch } from 'firebase/firestore';
import { db } from '../Firebase/config.js';
import { buildRecoveryPlan } from './recoveryPlan.js';

const BATCH_SIZE = 400;

export async function restoreFromBackup(backup, onProgress = () => {}) {
  const plan = buildRecoveryPlan(backup);
  const byCollection = new Map();
  for (const record of plan.records) {
    const collectionPath = record.path.split('/').slice(0, -1).join('/');
    if (!byCollection.has(collectionPath)) byCollection.set(collectionPath, []);
    byCollection.get(collectionPath).push(record);
  }

  const missing = [];
  for (const [collectionPath, records] of byCollection) {
    const snapshot = await getDocsFromServer(collection(db, collectionPath));
    const existing = new Set(snapshot.docs.map(entry => entry.id));
    missing.push(...records.filter(record => !existing.has(record.path.split('/').at(-1))));
  }

  let written = 0;
  for (let index = 0; index < missing.length; index += BATCH_SIZE) {
    const batch = writeBatch(db);
    const group = missing.slice(index, index + BATCH_SIZE);
    for (const record of group) batch.set(doc(db, record.path), record.data);
    await batch.commit();
    written += group.length;
    onProgress({ written, total: missing.length });
  }

  // Read the resulting collections so the UI never reports success for an
  // incomplete write. This also checks a retry after a partial earlier run.
  for (const [collectionPath, records] of byCollection) {
    const snapshot = await getDocsFromServer(collection(db, collectionPath));
    const ids = new Set(snapshot.docs.map(entry => entry.id));
    const absent = records.filter(record => !ids.has(record.path.split('/').at(-1)));
    if (absent.length) throw new Error(`${absent.length} documents still missing from ${collectionPath}`);
  }
  return { ...plan, written, skipped: plan.records.length - written };
}

