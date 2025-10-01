import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getAnalytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: "AIzaSyCDMRE78kLF9p3dfBJ8NVbBEAWpMHIy4Tk",
  authDomain: "interwitch.firebaseapp.com",
  projectId: "interwitch",
  storageBucket: "interwitch.firebasestorage.app",
  messagingSenderId: "593078709311",
  appId: "1:593078709311:web:c340eaf7d7a3cf49075c8a",
  measurementId: "G-09Y4X3K9C9"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const analytics = getAnalytics(app);
