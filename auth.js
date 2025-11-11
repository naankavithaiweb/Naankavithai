/*
 * File: auth.js
 * CRITICAL FIX: Ensures all necessary SDK imports and global function exposures are correctly defined.
 */

// --- 1. FIREBASE & FIRESTORE IMPORTS (CRITICAL) ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
    getAuth, 
    sendEmailVerification, 
    onAuthStateChanged,
    GoogleAuthProvider,
    signInWithPopup,
    signOut,
    PhoneAuthProvider, 
    RecaptchaVerifier 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    setDoc, 
    getDoc, 
    serverTimestamp,
    updateDoc 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- 2. YOUR FIREBASE CONFIGURATION (CHECK THESE VALUES) ---
const firebaseConfig = {
    apiKey: "AIzaSyA4hpYehoJphOMZXMEjqxpPoVm8DUNX4jo", 
    authDomain: "naankavithai-web.firebaseapp.com",    
    projectId: "naankavithai-web",                     
    storageBucket: "naankavithai-web.firebasestorage.app",
    messagingSenderId: "1009851243193",
    appId: "1:1009851243193:web:197f9b77a51d3c6851d968",
    measurementId: "G-SDKLL8VM0H"
};

// --- 3. INITIALIZE FIREBASE SERVICES (CORE ACTION) ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app); 
const db = getFirestore(app); 
const googleProvider = new GoogleAuthProvider();

// --- 4. GLOBAL AUTH EXPOSURE (CRITICAL: Functions callable from HTML) ---

window.signInWithGoogle = async function() {
    try {
        const result = await signInWithPopup(auth, googleProvider);
        // Ensure setupUserProfile is awaited to complete Firestore profile creation
        await setupUserProfile(result.user); 
        window.showToastNotification(`உள்நுழைவு வெற்றி! Welcome ${result.user.displayName || 'கவிஞரே'}!`, 'success');
    } catch (error) {
        console.error("Google Sign-In Error:", error.code, error.message);
        window.showToastNotification("உள்நுழைவில் பிழை ஏற்பட்டது.", 'error');
    }
};

window.signOutUser = async function() {
    try {
        await signOut(auth);
        window.showToastNotification("வெற்றிகரமாக வெளியேறினீர்கள்.", 'info');
    } catch (error) {
        console.error("Sign Out Error:", error);
        window.showToastNotification("வெளியேறுவதில் பிழை ஏற்பட்டது.", 'error');
    }
};

// --- 5. SETUP & UTILITY FUNCTIONS (Defined here for clarity) ---

async function setupUserProfile(user) {
    if (!user) return;
    const userRef = doc(db, "users", user.uid);
    try {
        const docSnap = await getDoc(userRef);
        if (!docSnap.exists()) {
            const initialData = {
                uid: user.uid, email: user.email, displayName: user.displayName || 'கவிஞர்',
                avatarUrl: user.photoURL || 'placeholder-avatar.png', dateJoined: serverTimestamp(), 
                role: 'basic', earnings: 0, tokens: 0, postCount: 0, leaderboardScore: 0, commentCount: 0
            };
            await setDoc(userRef, initialData);
        } else {
            await updateDoc(userRef, { lastLogin: serverTimestamp() });
        }
    } catch (error) {
        console.error("Error setting up user profile:", error);
    }
}

// --- 6. AUTH STATE LISTENER ---

document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // Re-run setup profile on auth state change to ensure profile exists
            await setupUserProfile(user); 
        }
        // index.html/profile.js listeners will handle UI updates.
    });
});

// --- 7. EXPORTS ---
export { auth, db, googleProvider };
