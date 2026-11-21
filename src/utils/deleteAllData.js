import { collection, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../Firebase/config';

const ROOT_COLLECTIONS = [
  'projects',
  'expenses',
  'staff',
  'staffAttendance',
  'contractors',
  'modeOfWorks',
  'itemNames',
  'paymentCategories'
];

const PROJECT_SUBCOLLECTIONS = ['materials', 'labour', 'payments'];
const BATCH_SIZE = 450;

const commitDeletes = async (documentRefs) => {
  for (let index = 0; index < documentRefs.length; index += BATCH_SIZE) {
    const batch = writeBatch(db);
    documentRefs.slice(index, index + BATCH_SIZE).forEach((documentRef) => batch.delete(documentRef));
    await batch.commit();
  }
};

export const deleteAllAppData = async () => {
  const rootSnapshots = await Promise.all(
    ROOT_COLLECTIONS.map((collectionName) => getDocs(collection(db, collectionName)))
  );

  const projectSnapshot = rootSnapshots[ROOT_COLLECTIONS.indexOf('projects')];
  const projectDataSnapshots = await Promise.all(
    projectSnapshot.docs.flatMap((projectDocument) =>
      PROJECT_SUBCOLLECTIONS.map((subcollectionName) =>
        getDocs(collection(db, `projects/${projectDocument.id}/${subcollectionName}`))
      )
    )
  );

  await commitDeletes(projectDataSnapshots.flatMap((snapshot) => snapshot.docs.map((entry) => entry.ref)));
  await commitDeletes(rootSnapshots.flatMap((snapshot) => snapshot.docs.map((entry) => entry.ref)));

  localStorage.removeItem('vastushobha_material_vendors');
};
