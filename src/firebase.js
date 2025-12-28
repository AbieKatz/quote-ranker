import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyBtjqqHY_s3vaoxzDFdTQMe4uMTv_RXlXk",
  authDomain: "quottit.firebaseapp.com",
  databaseURL: "https://quottit-default-rtdb.firebaseio.com",
  projectId: "quottit",
  storageBucket: "quottit.firebasestorage.app",
  messagingSenderId: "789823382476",
  appId: "1:789823382476:web:252c478506c5422ae3f369",
  measurementId: "G-G5T9TZLV05"
};

const app = initializeApp(firebaseConfig);
export const database = getDatabase(app);