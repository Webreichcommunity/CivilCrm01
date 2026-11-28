import { readFile } from 'node:fs/promises';

const backup = JSON.parse(await readFile(new URL('../recovery/recoverdata.json', import.meta.url), 'utf8'));
const raw = backup.rawFirestoreResponses.map(entry => String(entry.data || '')).join('\n');
const paths = [...raw.matchAll(/\/documents\/([^\s"\\]+)/g)].map(match => match[1]);
const uniquePaths = [...new Set(paths)];
const projectParents = uniquePaths.filter(path => /^projects\/[^/]+$/.test(path));
const childProjectIds = [...new Set(uniquePaths
  .filter(path => /^projects\/[^/]+\/[^/]+\/[^/]+$/.test(path))
  .map(path => path.split('/')[1]))];
const collections = Object.fromEntries(Object.entries(backup.collections).map(([path, entries]) => [path, entries.length]));
const rawFilters = [...raw.matchAll(/"filter":\s*\{\s*"targetId":\s*(\d+),\s*"count":\s*(\d+)/g)]
  .map(match => ({ targetId: Number(match[1]), count: Number(match[2]) }));
console.log(JSON.stringify({
  summary: backup.summary,
  collections,
  rawUniquePaths: uniquePaths.length,
  rawProjectParentPaths: projectParents,
  rawChildProjectIds: childProjectIds,
  rawFilterCounts: [...raw.matchAll(/"count":\s*(\d+)/g)].map(match => Number(match[1])),
  rawFilters,
  indexedDBEntries: Object.keys(backup.indexedDB || {}).length
}, null, 2));
