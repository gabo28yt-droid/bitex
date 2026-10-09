import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBnMV9iUEwUYdMhC6JHNDtUNp1pGxGkmq8",
  authDomain: "prueba-29000.firebaseapp.com",
  projectId: "prueba-29000",
  storageBucket: "prueba-29000.firebasestorage.app",
  messagingSenderId: "6824932303",
  appId: "1:6824932303:web:91b75a472ba5cba1dcd8ba",
  measurementId: "G-E58T0PWJBF"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);

export default app;