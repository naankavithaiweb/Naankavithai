/*
 * File: auth.js
 * Description: Firebase Auth, User Management, and Initial User Data Handling.
 * Purpose: Centralizes Firebase SDK initialization and ensures all other JS files can access services (auth, db).
 */

// --- 1. FIREBASE & FIRESTORE IMPORTS ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
    getAuth, 
    sendEmailVerification, 
    updateProfile,
    onAuthStateChanged,
    GoogleAuthProvider,
    signInWithPopup,
    signOut,
    // FIX: New imports for 2FA Phone Auth
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

// --- 2. YOUR FIREBASE CONFIGURATION (Keep your original values) ---
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
const googleProvider = new GoogleAuthProvider(); // Added for completeness

// --- 4. USER PROFILE & SETUP FUNCTIONS (Keeping original functions) ---

async function setupUserProfile(user) {
    if (!user) return;

    const userRef = doc(db, "users", user.uid);
    try {
        const docSnap = await getDoc(userRef);

        if (!docSnap.exists()) {
            const initialData = {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName || 'கவிஞர்',
                avatarUrl: user.photoURL || 'placeholder-avatar.png',
                bio: 'இது நான் கவிதை தளத்தில் எனது சுயசரிதை.',
                customUrl: user.displayName ? user.displayName.toLowerCase().replace(/\s/g, '-') : `user-${user.uid.substring(0, 8)}`,
                dateJoined: serverTimestamp(), 
                role: 'basic', 
                earnings: 0,
                tokens: 0,
                postCount: 0,
                totalViews: 0,
                totalLikes: 0,
                leaderboardScore: 0,
                gdprConsent: true,
                notificationEmail: true,
                twoFactorEnabled: false,
                contentFilterEnabled: true
            };

            await setDoc(userRef, initialData);
            console.log("New user profile created in Firestore.");
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
        window.showToastNotification("மின்னஞ்சல் சரிபார்ப்பு இணைப்பு அனுப்பப்பட்டது. உங்கள் இன்பாக்ஸைச் சரிபார்க்கவும்!", 'warning');
        return false;
    } catch (error) {
        console.error("Error sending email verification:", error);
        window.showToastNotification("மின்னஞ்சல் சரிபார்ப்பு இணைப்பை அனுப்ப முடியவில்லை.", 'error');
        return false;
    }
}

// --- 5. NEW 2FA & SESSION LOGIC ---

/**
 * 1.2 Two-Factor Authentication (2FA) - Phone SMS Based Setup
 * NOTE: This function only initiates the SMS process. Confirmation is separate.
 */
window.setupTwoFactorAuth = async function(phoneNumber) {
    if (!auth.currentUser) {
        window.showToastNotification("2FA அமைப்பதற்கு உள்நுழையவும்.", 'error');
        return;
    }
    
    // CRITICAL: Check if the recaptcha-container exists (must be in settings.html)
    const recaptchaEl = document.getElementById('recaptcha-container');
    if (!recaptchaEl) {
        window.showToastNotification("2FA செயல்பட Recaptcha Container UI-ல் இல்லை. அதை settings.html-ல் சேர்க்கவும்.", 'error');
        return;
    }
    
    // MOCK Phone Number since we don't have a UI to input it here
    const mockPhoneNumber = phoneNumber || '+94770000000'; 

    try {
        // 1. Re-Captcha setup 
        // We ensure we only initialize RecaptchaVerifier once
        if (!window.recaptchaVerifier) {
            window.recaptchaVerifier = new RecaptchaVerifier(auth, recaptchaEl, {
                'size': 'invisible',
                'callback': (response) => {
                    window.showToastNotification("ReCAPTCHA சரிபார்க்கப்பட்டது.", 'info');
                }
            });
        }
        
        const appVerifier = window.recaptchaVerifier;
        const phoneProvider = new PhoneAuthProvider(auth);
        
        // 2. Send the SMS code
        const verificationId = await phoneProvider.verifyPhoneNumber(mockPhoneNumber, appVerifier);
        
        // Store the result for the confirmation step
        window.confirmationResult = verificationId;

        window.showToastNotification("உங்கள் எண்ணுக்கு OTP அனுப்பப்பட்டுள்ளது.", 'success');
        
        // FIX: Update UI to show OTP input prompt (must be implemented in settings.html/profile.js)

    } catch (error) {
        console.error("2FA Setup Error:", error);
        if (window.recaptchaVerifier) window.recaptchaVerifier.clear();
        window.showToastNotification(`2FA அமைப்பதில் பிழை: ${error.message.substring(0, 50)}...`, 'error');
    }
};

/**
 * 1.6 Session Management (Remote Logout) - Backend Placeholder
 */
window.remoteLogoutUser = async function(targetUid) {
    if (auth.currentUser.email !== 'naankavithaiweb@gmail.com') { 
        window.showToastNotification("இந்தச் செயல்பாடு நிர்வாகிகளுக்கு மட்டுமே.", 'error');
        return;
    }
    
    // FIX: Instead of client-side logic, we signal the backend.
    window.showToastNotification("ரிமோட் லாகவுட் சிக்னல் பின்தளத்திற்கு அனுப்பப்பட்டது. (Cloud Function தேவை)", 'warning');
    console.log(`Remote Logout signaled for UID: ${targetUid}`);
};

/**
 * Custom SignOut function (used by index.html)
 */
window.signOutUser = async function() {
    try {
        await signOut(auth);
        window.showToastNotification("வெற்றிகரமாக வெளியேறினீர்கள்.", 'info');
    } catch (error) {
        console.error("Sign Out Error:", error);
        window.showToastNotification("வெளியேறுவதில் பிழை ஏற்பட்டது.", 'error');
    }
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
        // NOTE: UI updates are handled by listeners in index.html, profile.js, etc.
    });
});

// --- 7. EXPORTS (CRUCIAL: Export auth and db for all other JS files to use) ---

export { auth, db, googleProvider }; // Exporting googleProvider too for convenience
