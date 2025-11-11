/*
 * File: admin.js
 * Description: Logic for Owner/Admin Dashboard.
 * Integrates: Authorization Check, Post Approval System, User Management (Ban/Unban).
 * FIX: Enhanced content loading to handle 'Pending_Review' (AI filtered posts).
 */

// --- 1. FIREBASE & FIRESTORE IMPORTS ---
import { auth, db } from "./auth.js";
import { 
    collection, 
    query, 
    where, 
    getDocs, 
    doc, 
    updateDoc, 
    getDoc,
    orderBy,
    limit,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- 2. CORE AUTHORIZATION CHECK ---

const OWNER_EMAIL = 'naankavithaiweb@gmail.com'; 

async function isAdminCheck() {
    const user = auth.currentUser;
    const adminContainer = document.querySelector('.admin-container');
    const warningMessage = document.getElementById('auth-warning');
    
    if (!user) {
        window.showToastNotification("நிர்வாகப் பலகத்தைப் பார்க்க உள்நுழையவும்.", 'error');
        if (adminContainer) adminContainer.style.display = 'none';
        if (warningMessage) {
            warningMessage.textContent = "🚨 அனுமதி மறுக்கப்பட்டது: தயவுசெய்து முதலில் உள்நுழையவும்.";
            warningMessage.style.display = 'block';
        }
        return false;
    }

    try {
        const docSnap = await getDoc(doc(db, "users", user.uid));
        const userData = docSnap.data();

        if (user.email === OWNER_EMAIL || userData?.role === 'admin') {
            if (adminContainer) adminContainer.style.display = 'block';
            if (warningMessage) warningMessage.style.display = 'none';
            if (document.getElementById('admin-welcome')) {
                document.getElementById('admin-welcome').textContent = `வரவேற்பு, ${userData.displayName || 'நிர்வாகியே'}!`;
            }
            // FIX: Load admin settings on authorization check
            await loadOwnerSettings();
            return true;
        } else {
            if (adminContainer) adminContainer.style.display = 'none';
            if (warningMessage) {
                 warningMessage.textContent = "🚨 அனுமதி மறுக்கப்பட்டது: உங்களுக்கு நிர்வாக அணுகல் அதிகாரம் இல்லை.";
                 warningMessage.style.display = 'block';
            }
            window.showToastNotification("உங்களுக்கு நிர்வாக அணுகல் அதிகாரம் இல்லை.", 'error');
            return false;
        }

    } catch (error) {
        console.error("Authorization check failed:", error);
        window.showToastNotification("அங்கீகாரச் சரிபார்ப்பில் பிழை ஏற்பட்டது.", 'error');
        return false;
    }
}


// --- 3. CONTENT MANAGEMENT (Post Approval System) ---

/**
 * FIX: Loads posts that are Pending_Approval OR Pending_Review (AI Filtered).
 */
window.loadPendingPosts = async function() {
    if (!await isAdminCheck()) return;

    const postsRef = collection(db, "kavithai");
    // CRITICAL FIX: Firestore cannot query multiple 'where' clauses on different fields OR multiple values on same field efficiently.
    // For simplicity here, we query the main status and filter client-side, or use 'in' query (which is limited).
    
    // We will query posts that need review (Approved/Rejected are excluded)
    const q = query(
        postsRef, 
        where("status", "in", ["Pending_Approval", "Pending_Review"]), 
        orderBy("timestamp", "asc"), 
        limit(20)
    );
    
    const querySnapshot = await getDocs(q);
    const tableBody = document.querySelector('#pending-posts-table tbody');
    if (!tableBody) return;
    tableBody.innerHTML = ''; 

    if (querySnapshot.empty) {
        tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">ஒப்புதலுக்காகக் காத்திருக்கும் பதிவுகள் இல்லை.</td></tr>';
        return;
    }

    querySnapshot.forEach((doc) => {
        const post = doc.data();
        const media = (post.media?.imageUrl ? '🖼️ படம்' : '') + (post.media?.audioUrl ? ' 🎧 ஆடியோ' : '');
        
        // FIX: Display AI Score if available
        const aiScore = post.aiAnalysis?.aiScore;
        const statusClass = post.status === 'Pending_Review' ? 'style="background-color: #fce3e3;"' : '';

        row.innerHTML = `
            <td ${statusClass}><a href="poem_view?id=${doc.id}" target="_blank" style="color:var(--primary-color);">${post.title}</a></td>
            <td ${statusClass}>${post.authorName}</td>
            <td ${statusClass}>${media || 'உள்ளடக்கம் மட்டும்'} <br> ${aiScore ? `(AI Score: ${aiScore})` : ''}</td>
            <td ${statusClass}>
                <button class="approve-btn" onclick="handlePostAction('${doc.id}', 'Approved')">ஒப்புதல்</button>
                <button class="reject-btn" onclick="handlePostAction('${doc.id}', 'Rejected')">நிராகரி</button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

/**
 * Handles the approval or rejection of a post.
 */
window.handlePostAction = async function(postId, newStatus) {
    if (!await isAdminCheck()) return;

    try {
        const postRef = doc(db, "kavithai", postId);
        await updateDoc(postRef, {
            status: newStatus,
            reviewedBy: auth.currentUser.uid,
            reviewDate: serverTimestamp() 
        });

        window.showToastNotification(`பதிவு ${newStatus === 'Approved' ? 'ஒப்புதல் அளிக்கப்பட்டது' : 'நிராகரிக்கப்பட்டது'}!`, 'success');
        window.loadPendingPosts(); 

    } catch (error) {
        console.error("Error updating post status:", error);
        window.showToastNotification("உள்ளடக்கச் செயலில் பிழை ஏற்பட்டது.", 'error');
    }
}


// --- 4. USER MANAGEMENT (Ban/Unban - KEEPING ORIGINAL LOGIC) ---

// ... (loadUserList and handleUserBan functions remain unchanged) ...


// --- 5. OWNER ULTIMATE CONTROLS & SETTINGS (NEW LOGIC) ---

// Placeholder to store current owner settings
let currentOwnerSettings = {};

/**
 * Loads general admin/owner settings (including AI threshold).
 */
async function loadOwnerSettings() {
    const settingsRef = doc(db, "settings", "owner_defaults");
    const docSnap = await getDoc(settingsRef);
    
    if (docSnap.exists()) {
        currentOwnerSettings = docSnap.data();
        document.getElementById('conversion-rate').textContent = `${currentOwnerSettings.conversionRate || 0} TK = 1 USD (MOCK)`;
    } else {
         // Create default if not found
         currentOwnerSettings = {
            aiFilterThreshold: 30, // Default AI score below which a post needs manual review
            conversionRate: 0.05
         };
         await setDoc(settingsRef, currentOwnerSettings);
    }
}

/**
 * FIX: 3. AI Filtering Threshold Control (Admin Setting)
 * Prompts admin to set a new AI score threshold.
 */
window.updateAIFilterThreshold = async function() {
    if (!await isAdminCheck()) return;

    const current = currentOwnerSettings.aiFilterThreshold;
    const newThreshold = prompt(`AI Filter Threshold-ஐ உள்ளிடவும். (தற்போது: ${current}). இந்த மதிப்பெண்ணுக்குக் கீழே உள்ள பதிவுகள் 'Pending_Review' நிலைக்குச் செல்லும்.`);

    const thresholdNum = parseInt(newThreshold);
    
    if (isNaN(thresholdNum) || thresholdNum < 1 || thresholdNum > 100) {
        window.showToastNotification("சரியான மதிப்பெண்ணை (1-100) உள்ளிடவும்.", 'error');
        return;
    }

    try {
        const settingsRef = doc(db, "settings", "owner_defaults");
        await updateDoc(settingsRef, {
            aiFilterThreshold: thresholdNum
        });
        currentOwnerSettings.aiFilterThreshold = thresholdNum; // Update local state
        window.showToastNotification(`AI Filter Threshold வெற்றிகரமாக ${thresholdNum} ஆகப் புதுப்பிக்கப்பட்டது!`, 'success');
    } catch (error) {
        console.error("Error updating AI Threshold:", error);
        window.showToastNotification("AI Threshold-ஐப் புதுப்பிப்பதில் பிழை.", 'error');
    }
}


/**
 * Placeholder: Automated Payout Reminder (Triggered manually here).
 */
window.payoutReminder = function() {
    window.showToastNotification("பணம் எடுப்பு நினைவூட்டல் அமைப்பைத் தூண்டுகிறது (Backend Call Required).", 'info');
}

// ... (Other placeholder functions like activateKillSwitch, ownerImpersonationMode remain unchanged) ...

// --- 6. INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    auth.onAuthStateChanged(async (user) => {
        const isAuth = await isAdminCheck();
        
        if (isAuth) { 
            window.loadPendingPosts();
            window.loadUserList();
        }
    });
    
    // Attach the new threshold function to the appropriate button (Must be added in admin.html)
    // NOTE: This assumes you will update admin.html next.
});
