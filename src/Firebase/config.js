import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyBzBQalOS_LOjbvNsYOO5RmI3cKHJcmpAE",
  authDomain: "dmcdemo-ccfba.firebaseapp.com",
  databaseURL: "https://dmcdemo-ccfba-default-rtdb.firebaseio.com",
  projectId: "dmcdemo-ccfba",
  storageBucket: "dmcdemo-ccfba.firebasestorage.app",
  messagingSenderId: "11141322598",
  appId: "1:11141322598:web:7ec06295a85852d1925aa7"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);