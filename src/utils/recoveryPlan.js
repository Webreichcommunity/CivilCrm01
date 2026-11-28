const PROJECT_PATH = /^projects\/([^/]+)\/(materials|labour|payments)\/([^/]+)$/;
const DOCUMENT_PATH = /^(?:[^/]+\/[^/]+)(?:\/[^/]+\/[^/]+)*$/;
const recoveredId = (name) => `recovered-${encodeURIComponent(name.toLowerCase().trim())}`;

// The export includes duplicate views of the same documents. `collections` is
// the canonical, latest-value view; keep document IDs and application data as-is.
export function buildRecoveryPlan(backup) {
  if (!backup || typeof backup.collections !== 'object' || !backup.collections) {
    throw new Error('Recovery file has no collections.');
  }

  const records = new Map();
  const projectIds = new Set();
  for (const [collectionPath, entries] of Object.entries(backup.collections)) {
    if (!Array.isArray(entries)) throw new Error(`Invalid collection: ${collectionPath}`);
    for (const entry of entries) {
      const path = entry.path;
      if (typeof path !== 'string' || !DOCUMENT_PATH.test(path) ||
          !path.startsWith(`${collectionPath}/`) ||
          path !== `${collectionPath}/${entry.id}` ||
          !entry.data || typeof entry.data !== 'object' || Array.isArray(entry.data)) {
        throw new Error(`Invalid recovered document in ${collectionPath}`);
      }
      if (records.has(path)) throw new Error(`Duplicate recovered document: ${path}`);
      records.set(path, { path, data: entry.data });
      const match = path.match(PROJECT_PATH);
      if (match) projectIds.add(match[1]);
    }
  }
  if (backup.summary?.uniqueDocuments !== undefined &&
      records.size !== backup.summary.uniqueDocuments) {
    throw new Error('Recovery document count does not match the export summary.');
  }

  const expenseProjectNames = new Map();
  for (const entry of backup.collections.expenses || []) {
    const expense = entry.data;
    for (const allocation of [expense, ...(expense.allocations || [])]) {
      const id = allocation.selectedProjectId || allocation.projectId;
      const name = allocation.selectedProjectName || allocation.projectName;
      if (id && name && !expenseProjectNames.has(id)) expenseProjectNames.set(id, name);
    }
  }

  const inferredProjects = [];
  for (const id of new Set([...projectIds, ...expenseProjectNames.keys()])) {
    const path = `projects/${id}`;
    if (records.has(path)) continue;
    const name = expenseProjectNames.get(id) || `Recovered project (${id})`;
    records.set(path, {
      path,
      data: {
        name,
        clientName: '',
        siteType: '',
        status: 'active',
        recoveryNeedsReview: true,
        recoveryNote: expenseProjectNames.has(id)
          ? 'Project name recovered from an expense; other project details were absent from the backup.'
          : 'Project name and details were absent from the backup.'
      }
    });
    inferredProjects.push({ id, name });
  }

  // These master records were missing from the export, but their exact IDs and
  // labels survive in payment documents.
  for (const id of projectIds) {
    for (const entry of backup.collections[`projects/${id}/payments`] || []) {
      const { categoryId, categoryName } = entry.data;
      if (categoryId && categoryName) {
        const path = `paymentCategories/${categoryId}`;
        if (!records.has(path)) records.set(path, { path, data: { name: categoryName } });
      }
    }
  }

  // Labour rows retain the names used by these two missing master lists.
  for (const id of projectIds) {
    for (const entry of backup.collections[`projects/${id}/labour`] || []) {
      for (const [collectionName, value] of [
        ['contractors', entry.data.contractorName],
        ['modeOfWorks', entry.data.modeOfWork]
      ]) {
        const name = typeof value === 'string' ? value.trim() : '';
        if (!name) continue;
        const path = `${collectionName}/${recoveredId(name)}`;
        if (!records.has(path)) records.set(path, { path, data: { name } });
      }
    }
  }

  return { records: [...records.values()], originalCount: backup.summary?.uniqueDocuments ?? records.size, inferredProjects };
}
