/*
 * File: admin.js
 * Description: Logic for Owner/Admin Dashboard.
 * Integrates: Authorization Check, Post Approval System, User Management (Ban/Unban).
 * Purpose: Ensures only authorized users access administrative tools and defines core admin actions.
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

// Set the Owner's Email for the highest level of control verification
const OWNER_EMAIL = 'naankavithaiweb@gmail.com'; 

/**
 * Checks if the current user is authorized as an Admin/Owner.
 */
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

        // Check if user is the Owner OR has 'admin' role
        if (user.email === OWNER_EMAIL || userData?.role === 'admin') {
            // Authorized User
            if (adminContainer) adminContainer.style.display = 'block';
            if (warningMessage) warningMessage.style.display = 'none';
            if (document.getElementById('admin-welcome')) {
                document.getElementById('admin-welcome').textContent = `வரவேற்பு, ${userData.displayName || 'நிர்வாகியே'}!`;
            }
            return true;
        } else {
            // Not Authorized
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
 * Loads posts that are currently Pending_Approval.
 */
window.loadPendingPosts = async function() {
    if (!await isAdminCheck()) return;

    const postsRef = collection(db, "kavithai");
    const q = query(postsRef, where("status", "==", "Pending_Approval"), limit(20));
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
        const row = tableBody.insertRow();
        const media = (post.media?.imageUrl ? '🖼️ படம்' : '') + (post.media?.audioUrl ? ' 🎧 ஆடியோ' : '');
        
        row.innerHTML = `
            <td><a href="poem_view?id=${doc.id}" target="_blank" style="color:var(--primary-color);">${post.title}</a></td>
            <td>${post.authorName}</td>
            <td>${media || 'உள்ளடக்கம் மட்டும்'}</td>
            <td>
                <button class="approve-btn" onclick="handlePostAction('${doc.id}', 'Approved')">ஒப்புதல்</button>
                <button class="reject-btn" onclick="handlePostAction('${doc.id}', 'Rejected')">நிராகரி</button>
            </td>
        `;
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
        window.loadPendingPosts(); // Reload the list

    } catch (error) {
        console.error("Error updating post status:", error);
        window.showToastNotification("உள்ளடக்கச் செயலில் பிழை ஏற்பட்டது.", 'error');
    }
}


// --- 4. USER MANAGEMENT (Ban/Unban) ---

/**
 * Loads a list of recent users for quick management.
 */
window.loadUserList = async function() {
    if (!await isAdminCheck()) return;

    const usersRef = collection(db, "users");
    const q = query(usersRef, orderBy("dateJoined", "desc"), limit(10)); 
    const querySnapshot = await getDocs(q);
    const tableBody = document.querySelector('#recent-users-table tbody');
    if (!tableBody) return;
    tableBody.innerHTML = '';

    if (querySnapshot.empty) {
        tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">பயனர் தரவு இல்லை.</td></tr>';
        return;
    }

    querySnapshot.forEach((doc) => {
        const userData = doc.data();
        const row = tableBody.insertRow();
        const isBanned = userData.isBanned || false;
        const statusText = isBanned ? 'தடைசெய்யப்பட்டது' : (userData.role === 'admin' ? 'நிர்வாகி' : 'செயலில்');
        const joinDate = userData.dateJoined ? new Date(userData.dateJoined.toDate()).toLocaleDateString('ta-IN') : 'N/A';
        
        row.innerHTML = `
            <td>${userData.displayName || userData.email}</td>
            <td>${joinDate}</td>
            <td>${statusText}</td>
            <td>
                <button class="${isBanned ? 'approve-btn' : 'ban-btn'}" onclick="handleUserBan('${doc.id}', ${!isBanned})">
                    ${isBanned ? 'தடை நீக்கு' : 'தடைசெய்'}
                </button>
                <button class="impersonate-btn" onclick="ownerImpersonationMode('${doc.id}')">போலிமை</button>
            </td>
        `;
    });
}

/**
 * Handles banning or unbanning a user.
 */
window.handleUserBan = async function(userId, banStatus) {
    if (!await isAdminCheck()) return;
    
    try {
        const userRef = doc(db, "users", userId);
        await updateDoc(userRef, {
            isBanned: banStatus
        });
        window.showToastNotification(`பயனர் வெற்றிகரமாக ${banStatus ? 'தடைசெய்யப்பட்டார்' : 'மீண்டும் அனுமதிக்கப்பட்டார்'}!`, 'success');
        window.loadUserList(); // Reload the list

    } catch (error) {
        console.error("Error banning user:", error);
        window.showToastNotification("பயனர் மேலாண்மையில் பிழை ஏற்பட்டது.", 'error');
    }
}

// --- 5. OWNER ULTIMATE CONTROLS (PLACEHOLDERS) ---

/**
 * Placeholder: Emergency Kill Switch (தளத்தை முழுமையாக முடக்கு)
 */
window.activateKillSwitch = function() {
    if (confirm("🚨 எச்சரிக்கை! தளத்தை முழுமையாக முடக்க விரும்புகிறீர்களா? இது அனைத்து பயனர்களுக்கும் தளத்தை அணுக முடியாதபடி செய்யும்.")) {
        // TODO: Requires backend flag update and corresponding logic on index.html
        window.showToastNotification("அவசரகால கில் சுவிட்ச் செயல்படுத்தப்பட்டது (Placeholder).", 'error');
    }
}

/**
 * Placeholder: Owner Impersonation Mode (Owner as User)
 */
window.ownerImpersonationMode = function(targetUserId) {
    // TODO: Requires backend token generation and secure session switching logic.
    window.showToastNotification(`பயனர் ID ${targetUserId || '[தேர்வுசெய்யப்படவில்லை]'} போலிமை முறைக்கு முயற்சி... (பின்தளம் தேவை)`, 'warning');
}

/**
 * Placeholder: Automated Payout Reminder
 */
window.payoutReminder = function() {
    // TODO: Requires checking user earnings and triggering email/notification system (Backend).
    window.showToastNotification("பணம் எடுப்பு நினைவூட்டல் அமைப்பைத் தூண்டுகிறது (Placeholder).", 'info');
}

/**
 * Placeholder: Owner Custom Settings
 */
window.updateMonetizationRates = function() {
    window.showToastNotification("பணமாக்குதல் விகிதங்கள் கட்டுப்பாடு பக்கம் திறக்கிறது... (HTML தேவை)", 'info');
}
window.updateSubscriptionTiers = function() {
    window.showToastNotification("சந்தா அடுக்கு அமைப்புகள் பக்கம் திறக்கிறது... (HTML தேவை)", 'info');
}
window.bulkContentOperations = function() {
    window.showToastNotification("மொத்த உள்ளடக்கச் செயல்பாடுகள் பக்கம் திறக்கிறது... (HTML தேவை)", 'info');
}
window.databaseBackup = function() {
    window.showToastNotification("தரவுத்தள காப்புப் பிரதி செயல்முறை தொடங்குகிறது... (பின்தளம் தேவை)", 'info');
}

// --- 6. INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    // Check if user is logged in and is admin
    auth.onAuthStateChanged(async (user) => {
        const isAuth = await isAdminCheck();
        
        if (isAuth) { 
            // Load tables only if authorized
            window.loadPendingPosts();
            window.loadUserList();
        }
    });
});
