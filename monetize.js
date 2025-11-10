/*
 * File: monetize.js
 * Description: Handles User Earnings Tracking, Withdrawal Requests, and Monetization feature integration.
 * Integrates: Firestore for reading user token/earnings data and submitting requests.
 * Purpose: Provides core functionality for the monetization.html page.
 */

// --- 1. FIREBASE IMPORTS ---
import { auth, db } from "./auth.js";
import { 
    doc, 
    getDoc, 
    collection, 
    addDoc, 
    serverTimestamp,
    updateDoc 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- 2. DATA RETRIEVAL AND DISPLAY ---

let userMonetizationData = null;
const MIN_WITHDRAWAL_AMOUNT = 50;

/**
 * Loads user monetization data (earnings, tokens) from Firestore and updates the UI.
 */
async function loadMonetizationData() {
    const user = auth.currentUser;
    if (!user) {
        window.showToastNotification("வருமான விவரங்களைப் பார்க்க உள்நுழையவும்.", 'error');
        return;
    }

    try {
        const userRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(userRef);

        if (docSnap.exists()) {
            userMonetizationData = docSnap.data();

            const availableEarnings = userMonetizationData.earnings || 0;
            const tokenBalance = userMonetizationData.tokens || 0;
            const currentTier = userMonetizationData.subscriptionTier || 'Standard';

            // 4. User Earnings Tracking
            document.getElementById('available-earnings').textContent = `${availableEarnings.toFixed(2)} TK`;
            
            // 4. Naan Kavithai Token
            document.getElementById('token-balance').textContent = `${tokenBalance} TK`;

            // 4. Tiered Subscription Model
            document.getElementById('current-tier').textContent = currentTier;
            
            // Disable withdrawal button if funds are insufficient
            const withdrawalBtn = document.querySelector('.earnings-card button:first-of-type');
            if (withdrawalBtn) {
                if (availableEarnings < MIN_WITHDRAWAL_AMOUNT) {
                    withdrawalBtn.disabled = true;
                    withdrawalBtn.textContent = `குறைந்தது ${MIN_WITHDRAWAL_AMOUNT} TK தேவை`;
                } else {
                    withdrawalBtn.disabled = false;
                    withdrawalBtn.textContent = 'பணம் எடுப்பு கோரிக்கை';
                }
            }

        } else {
            window.showToastNotification("வருமான விவரங்களைத் தரவுத்தளத்தில் இருந்து எடுக்க முடியவில்லை.", 'error');
        }

    } catch (error) {
        console.error("Error loading monetization data:", error);
        window.showToastNotification("தரவு ஏற்றுகையில் பிழை ஏற்பட்டது. (அனுமதி சிக்கல்)", 'error');
    }
}


// --- 3. CORE MONETIZATION ACTIONS ---

/**
 * Handles the submission of a Withdrawal Request (Manual Payout System).
 */
window.requestWithdrawal = async function() {
    const user = auth.currentUser;
    if (!user || !userMonetizationData) return;
    
    const amount = userMonetizationData.earnings;

    if (amount < MIN_WITHDRAWAL_AMOUNT) {
        // This should be disabled in UI, but check again for security
        window.showToastNotification(`குறைந்தபட்சம் ${MIN_WITHDRAWAL_AMOUNT} TK இருந்தால்தான் பணம் எடுக்க முடியும்.`, 'error');
        return;
    }

    if (!confirm(`நீங்கள் ${amount.toFixed(2)} TK பணம் எடுக்கக் கோருகிறீர்கள். தொடரவா?`)) {
        return;
    }

    try {
        // 1. Submit request to 'withdrawal_requests' collection
        await addDoc(collection(db, "withdrawal_requests"), {
            userId: user.uid,
            amount: amount,
            requestDate: serverTimestamp(),
            status: 'Pending', // Manually processed by Admin
            payoutMethod: 'User Wallet Address (To be specified)'
        });

        // 2. Update user profile to reflect pending withdrawal
        const userRef = doc(db, "users", user.uid);
        await updateDoc(userRef, {
            earnings: 0, // Resetting earnings
            pendingWithdrawal: amount 
        });

        window.showToastNotification("✅ பணம் எடுப்புக் கோரிக்கை வெற்றிகரமாகச் சமர்ப்பிக்கப்பட்டது! நிர்வாக ஒப்புதலுக்காகக் காத்திருக்கவும்.", 'success');
        loadMonetizationData(); // Refresh UI

    } catch (error) {
        console.error("Error submitting withdrawal request:", error);
        window.showToastNotification("பணம் எடுப்புக் கோரிக்கையைச் சமர்ப்பிப்பதில் பிழை ஏற்பட்டது.", 'error');
    }
}

/**
 * Placeholder: Paid Promotions (Boost Post) Logic.
 */
window.boostPost = function() {
    window.showToastNotification("கவிதை விளம்பரச் செயல்பாடு விரைவில் இணைக்கப்படும்!", 'info');
}


// --- 4. INITIALIZATION ---

document.addEventListener('DOMContentLoaded', () => {
    // Wait for the auth state to be loaded before performing data load
    auth.onAuthStateChanged((user) => {
        if (user) {
            loadMonetizationData();
        } else if (window.location.pathname.includes('monetization')) {
            window.showToastNotification("பணமாக்குதல் விவரங்களைப் பார்க்க உள்நுழையவும்.", 'error');
        }
    });
});
