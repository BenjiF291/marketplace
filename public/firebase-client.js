import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCXwpcBG5A4do5p4JLMfmrDfT58twrzSL4",
  authDomain: "fishy-20779.firebaseapp.com",
  projectId: "fishy-20779",
  storageBucket: "fishy-20779.firebasestorage.app",
  messagingSenderId: "734902993921",
  appId: "1:734902993921:web:7a8e01c495fbfb146bac00"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

export { auth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged };
