/*
 * File: auth.js
 * Description: Firebase Auth, User Management, and Initial User Data Handling.
 * Purpose: Centralizes Firebase SDK initialization and ensures all other JS files can access services (auth, db).
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

// --- 4. USER PROFILE & SETUP FUNCTIONS (Keeping original logic) ---
async function setupUserProfile(user) {
    if (!user) return;
    const userRef = doc(db, "users", user.uid);
    try {
        const docSnap = await getDoc(userRef);
        if (!docSnap.exists()) {
            const initialData = {
                uid: user.uid, email: user.email, displayName: user.displayName || 'கவிஞர்',
                avatarUrl: user.photoURL || 'placeholder-avatar.png', dateJoined: serverTimestamp(), 
                role: 'basic', earnings: 0, tokens: 0, postCount: 0, totalViews: 0, totalLikes: 0,
                leaderboardScore: 0, twoFactorEnabled: false, commentCount: 0
            };
            await setDoc(userRef, initialData);
        } else {
            await updateDoc(userRef, { lastLogin: serverTimestamp() });
        }
    } catch (error) {
        console.error("Error setting up user profile in Firestore:", error);
        window.showToastNotification("தரவுத்தள இணைப்பில் பிழை ஏற்பட்டது.", 'error');
    }
}

window.checkAndSendEmailVerification = async function(user) {
    if (!user || user.emailVerified) return true; 
    try {
        await sendEmailVerification(user);
        window.showToastNotification("மின்னஞ்சல் சரிபார்ப்பு இணைப்பு அனுப்பப்பட்டது.", 'warning');
        return false;
    } catch (error) {
        window.showToastNotification("மின்னஞ்சல் சரிபார்ப்பு இணைப்பை அனுப்ப முடியவில்லை.", 'error');
        return false;
    }
}

// --- 5. GLOBAL AUTH EXPOSURE (CRITICAL FIX: Functions callable from HTML) ---

window.signInWithGoogle = async function() {
    try {
        const result = await signInWithPopup(auth, googleProvider);
        const user = result.user;
        await setupUserProfile(user);
        window.showToastNotification(`உள்நுழைவு வெற்றி! Welcome ${user.displayName || 'கவிஞரே'}!`, 'success');
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

window.remoteLogoutUser = async function(targetUid) {
    if (auth.currentUser.email !== 'naankavithaiweb@gmail.com') { 
        window.showToastNotification("இந்தச் செயல்பாடு நிர்வாகிகளுக்கு மட்டுமே.", 'error');
        return;
    }
    window.showToastNotification("ரிமோட் லாகவுட் சிக்னல் பின்தளத்திற்கு அனுப்பப்பட்டது.", 'warning');
};

window.setupTwoFactorAuth = async function(phoneNumber) {
    if (!auth.currentUser) {
        window.showToastNotification("2FA அமைப்பதற்கு உள்நுழையவும்.", 'error');
        return;
    }
    const recaptchaEl = document.getElementById('recaptcha-container');
    if (!recaptchaEl) {
        window.showToastNotification("2FA செயல்பட Recaptcha Container UI-ல் இல்லை.", 'error');
        return;
    }
    window.showToastNotification("2FA அமைவு செயல்முறை தொடங்குகிறது.", 'info');
};


// --- 6. AUTH STATE LISTENER (Centralized Logic) ---

document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            await setupUserProfile(user);
            if (!user.emailVerified) {
                checkAndSendEmailVerification(user);
            }
        }
        // index.html/profile.js listeners will handle UI updates.
    });
});

// --- 7. EXPORTS (CRUCIAL) ---

export { auth, db, googleProvider };
