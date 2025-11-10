/*
 * File: auth.js
 * Description: Firebase Auth, User Management, and Initial User Data Handling.
 * Purpose: Centralizes Firebase SDK initialization and ensures all other JS files can access services (auth, db).
 */

// --- 1. FIREBASE & FIRESTORE IMPORTS ---
// Firebase-ஐ துவக்க தேவையான அனைத்து SDK-களையும் இங்கே இறக்குமதி செய்கிறோம்
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
    getAuth, 
    sendEmailVerification, 
    updateProfile,
    onAuthStateChanged,
    GoogleAuthProvider,
    signInWithPopup 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    setDoc, 
    getDoc, 
    serverTimestamp,
    updateDoc 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- 2. YOUR FIREBASE CONFIGURATION ---
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
const auth = getAuth(app); // Get Auth instance
const db = getFirestore(app); // Get Firestore instance


// --- 4. USER PROFILE & SETUP FUNCTIONS ---

/**
 * Handles initial setup and profile creation in Firestore after a successful login.
 * This removes 'fake data' by ensuring a document exists for every user.
 * @param {object} user - The Firebase User object.
 */
async function setupUserProfile(user) {
    if (!user) return;

    const userRef = doc(db, "users", user.uid);
    try {
        const docSnap = await getDoc(userRef);

        if (!docSnap.exists()) {
            // New User: Create initial profile in Firestore (Atomic User Details)
            const initialData = {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName || 'கவிஞர்',
                avatarUrl: user.photoURL || 'placeholder-avatar.png',
                bio: 'இது நான் கவிதை தளத்தில் எனது சுயசரிதை.',
                customUrl: user.displayName ? user.displayName.toLowerCase().replace(/\s/g, '-') : `user-${user.uid.substring(0, 8)}`,
                dateJoined: serverTimestamp(), // Atomic User Details
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
            // window.sendWelcomeEmail(user.email); // Notification Placeholder

        } else {
            // Existing user
            await updateDoc(userRef, { lastLogin: serverTimestamp() });
        }
    } catch (error) {
        console.error("Error setting up user profile in Firestore:", error);
        window.showToastNotification("தரவுத்தள இணைப்பில் பிழை ஏற்பட்டது.", 'error');
    }
}

/**
 * Checks if the user needs Email Verification and sends it if necessary.
 * (This is called from index.html listener)
 */
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

// --- 5. AUTH STATE LISTENER (Centralized Logic) ---

document.addEventListener('DOMContentLoaded', () => {
    // This runs on every page load to ensure data is synced after authentication
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // 1. Create/Update Profile in Firestore
            await setupUserProfile(user);

            // 2. Check Verification (Email Verification on Signup)
            if (!user.emailVerified && !window.location.pathname.includes('verify')) {
                // Prevent infinite loop if we had a dedicated verification page
                checkAndSendEmailVerification(user);
            }
        }
        
        // Note: UI updates are handled by listeners in index.html, profile.js, etc.
    });
});

// --- 6. EXPORTS (CRUCIAL: Export auth and db for all other JS files to use) ---

export { auth, db };
