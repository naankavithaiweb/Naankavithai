/*
 * File: profile.js
 * Description: Handles user profile data retrieval, display, and updates (Firestore CRUD operations).
 * Integrates: Atomic User Details, Profile Customization Hub (Bio, Custom URL, Avatar).
 * Purpose: Provides the core functionality for the profile.html page.
 */

// --- 1. FIREBASE IMPORTS ---
import { auth, db } from "./auth.js";
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- 2. GLOBAL VARIABLES ---
let currentUserData = null; 

/**
 * Loads user data from Firestore and displays it on the profile.html page.
 */
async function loadUserProfile() {
    const user = auth.currentUser;
    if (!user) {
        window.showToastNotification("சுயவிவரத்தைப் பார்க்க, நீங்கள் உள்நுழைய வேண்டும்.", 'error');
        window.location.href = 'index.html'; 
        return;
    }

    try {
        const userRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(userRef);

        if (docSnap.exists()) {
            currentUserData = docSnap.data();
            console.log("Profile Data Loaded:", currentUserData);

            // --- Display actual user data ---
            document.getElementById('user-avatar').src = currentUserData.avatarUrl || user.photoURL || 'placeholder-avatar.png';
            document.getElementById('user-display-name').textContent = currentUserData.displayName || user.email;
            document.getElementById('profile-email').value = currentUserData.email;
            
            // Format date correctly from Firestore Timestamp
            const dateJoined = currentUserData.dateJoined ? 
                                new Date(currentUserData.dateJoined.toDate()).toLocaleDateString('ta-IN') : 
                                'N/A';

            document.getElementById('profile-join-date').value = dateJoined;
            
            // Profile Customization Hub
            document.getElementById('profile-custom-url').value = currentUserData.customUrl || '';
            document.getElementById('profile-bio').value = currentUserData.bio || '';
            
            // Monetization/Gamification Data (Uses real Firestore counts/values)
            document.getElementById('total-views').textContent = (currentUserData.totalViews || 0).toLocaleString();
            document.getElementById('total-earnings').textContent = (currentUserData.earnings || 0).toFixed(2) + ' TK';
            document.getElementById('current-token-balance').textContent = (currentUserData.tokens || 0) + ' TK';
            document.getElementById('staked-tokens').textContent = (currentUserData.stakedTokens || 0) + ' TK';
            
            // Author Status/Badges
            document.getElementById('author-status-display').textContent = getAuthorStatus(currentUserData);

        } else {
            window.showToastNotification("பயனர் சுயவிவரத் தரவு காணப்படவில்லை. Firebase Rules-ஐ சரிபார்க்கவும்.", 'warning');
        }

    } catch (error) {
        console.error("Error loading user profile:", error);
        window.showToastNotification("தரவு ஏற்றுகையில் பிழை ஏற்பட்டது. (அனுமதி சிக்கல்)", 'error');
    }
}

/**
 * Function to determine the author status based on collected data
 */
function getAuthorStatus(data) {
    if (data.role === 'admin') return 'நிர்வாகி';
    if (data.earnings > 1000) return 'Gold Poet';
    if (data.totalViews > 5000) return 'Silver Poet';
    return data.authorStatus || 'Bronze Poet';
}


// --- 4. DATA UPDATE LOGIC ---

/**
 * Handles the update of custom URL and basic details.
 */
async function handleBasicDetailsUpdate(e) {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;
    
    const newCustomUrl = document.getElementById('profile-custom-url').value.trim();

    // 1. Validate URL format
    if (newCustomUrl && !/^[a-z0-9\-]+$/.test(newCustomUrl)) {
        window.showToastNotification("URL-இல் எழுத்துக்கள், எண்கள், மற்றும் ஹைஃபன்கள் மட்டுமே இருக்க வேண்டும்.", 'error');
        return;
    }

    try {
        // 2. Check for URL uniqueness 
        if (newCustomUrl !== currentUserData.customUrl) {
            const usersRef = collection(db, "users");
            const q = query(usersRef, where("customUrl", "==", newCustomUrl));
            const querySnapshot = await getDocs(q);
            
            if (!querySnapshot.empty) {
                window.showToastNotification("இந்த URL ஏற்கனவே பயன்பாட்டில் உள்ளது. வேறு ஒன்றைத் தேர்ந்தெடுக்கவும்.", 'error');
                return;
            }
        }
        
        // 3. Perform the update in Firestore
        const userRef = doc(db, "users", user.uid);
        await updateDoc(userRef, {
            customUrl: newCustomUrl
        });

        window.showToastNotification("அடிப்படை விவரங்கள் வெற்றிகரமாகப் புதுப்பிக்கப்பட்டன!", 'success');
        loadUserProfile(); // Reload data to confirm changes

    } catch (error) {
        console.error("Error updating basic details:", error);
        window.showToastNotification("தரவு புதுப்பிப்பில் பிழை ஏற்பட்டது.", 'error');
    }
}

/**
 * Handles the update of the user's bio.
 */
async function handleBioUpdate(e) {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;

    const newBio = document.getElementById('profile-bio').value.trim();

    try {
        const userRef = doc(db, "users", user.uid);
        await updateDoc(userRef, {
            bio: newBio
        });

        window.showToastNotification("சுயசரிதை வெற்றிகரமாகப் புதுப்பிக்கப்பட்டது!", 'success');
        loadUserProfile(); 

    } catch (error) {
        console.error("Error updating bio:", error);
        window.showToastNotification("சுயசரிதை புதுப்பிப்பில் பிழை ஏற்பட்டது.", 'error');
    }
}

/**
 * Handles Avatar Upload (Placeholder for Cloudinary upload logic)
 * NOTE: This relies on Cloudinary, which is initialized via upload.js.
 */
async function handleAvatarUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    window.showToastNotification("அவதாரம் பதிவேற்றப்படுகிறது. இது சிறிது நேரம் எடுக்கும்...", 'info');

    // MOCK URL - In a real application, you would call a function from upload.js here
    const newAvatarUrl = 'https://res.cloudinary.com/davbdxg0u/image/upload/v1678886400/new_avatar_temp.jpg'; 
    
    if (newAvatarUrl) {
        const user = auth.currentUser;
        const userRef = doc(db, "users", user.uid);
        
        try {
             // 1. Update Firebase Auth profile
             // (We skip updateProfile to avoid needing Auth credentials on the front-end)
            
            // 2. Update Firestore profile
            await updateDoc(userRef, {
                avatarUrl: newAvatarUrl
            });
            
            window.showToastNotification("அவதாரம் வெற்றிகரமாகப் புதுப்பிக்கப்பட்டது!", 'success');
            loadUserProfile(); 
            
        } catch (error) {
             window.showToastNotification("அவதாரத்தைப் புதுப்பிப்பதில் பிழை ஏற்பட்டது.", 'error');
             console.error("Avatar update error:", error);
        }
    } else {
        window.showToastNotification("அவதாரப் பதிவேற்றம் தோல்வி.", 'error');
    }
}


// --- 5. INITIALIZATION ---

document.addEventListener('DOMContentLoaded', () => {
    // Wait until Firebase Auth state is known 
    auth.onAuthStateChanged((user) => {
        if (user) {
            loadUserProfile();
            
            // Attach listeners to forms
            document.getElementById('basic-details-form')?.addEventListener('submit', handleBasicDetailsUpdate);
            document.getElementById('bio-form')?.addEventListener('submit', handleBioUpdate);
            document.getElementById('avatar-upload')?.addEventListener('change', handleAvatarUpload);

        } else {
            // User is not logged in, redirect them
        }
    });
});
