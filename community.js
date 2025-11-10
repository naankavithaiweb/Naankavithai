/*
 * File: community.js
 * Description: Core logic for Community & Social features.
 * Integrates: Follower System, Forum/Thread handling, User Polls/Contests, and Referral Leaderboard.
 * Purpose: Manages user relationships and dynamic content related to community interaction.
 */

// --- 1. FIREBASE IMPORTS ---
import { auth, db } from "./auth.js";
import { 
    collection, 
    query, 
    where, 
    getDocs, 
    doc, 
    setDoc, 
    deleteDoc, 
    serverTimestamp,
    increment,
    orderBy,
    limit,
    getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- 2. FOLLOWER SYSTEM (6. சமூகம் & தொடர்பு) ---

/**
 * Toggles the Follower System status between two users.
 * @param {string} targetUserId - The ID of the user to follow/unfollow.
 * @param {string} targetUserName - The name of the user.
 */
window.toggleFollow = async function(targetUserId, targetUserName) {
    const currentUser = auth.currentUser;
    if (!currentUser) {
        window.showToastNotification("தொடர உள்நுழையவும்.", 'error');
        return;
    }

    if (currentUser.uid === targetUserId) {
        window.showToastNotification("உங்களை நீங்களே தொடர முடியாது!", 'warning');
        return;
    }
    
    // Use a composite ID for the document (FollowerID_FollowingID)
    const followId = `${currentUser.uid}_${targetUserId}`;
    const followRef = doc(db, "followers", followId);
    
    try {
        const docSnap = await getDoc(followRef);

        if (docSnap.exists()) {
            // Already following -> Unfollow
            await deleteDoc(followRef);
            
            // Update counts on both user profiles 
            await updateDoc(doc(db, "users", currentUser.uid), { followingCount: increment(-1) });
            await updateDoc(doc(db, "users", targetUserId), { followerCount: increment(-1) });
            
            window.showToastNotification(`${targetUserName} ஐப் பின்தொடர்வது நிறுத்தப்பட்டது.`, 'info');
        } else {
            // Not following -> Follow
            await setDoc(followRef, {
                followerId: currentUser.uid,
                followingId: targetUserId,
                timestamp: serverTimestamp()
            });

            // Update counts
            await updateDoc(doc(db, "users", currentUser.uid), { followingCount: increment(1) });
            await updateDoc(doc(db, "users", targetUserId), { followerCount: increment(1) });
            
            window.showToastNotification(`${targetUserName} ஐப் பின்தொடரத் தொடங்கினீர்கள்!`, 'success');
        }
        
        // You would typically call a function here to update the button text/style on profile.html

    } catch (error) {
        console.error("Error toggling follow status:", error);
        window.showToastNotification("பின்தொடர்வதில் பிழை ஏற்பட்டது. (அனுமதி சிக்கல்)", 'error');
    }
}

// --- 3. FORUM / DISCUSSION LOGIC (6. சமூகம் & தொடர்பு) ---

/**
 * Loads the latest discussion threads for the forum.html page.
 */
window.loadForumThreads = async function() {
    const threadsRef = collection(db, "forum_threads");
    const q = query(threadsRef, orderBy("lastUpdated", "desc"), limit(20));
    const querySnapshot = await getDocs(q);
    
    const listElement = document.getElementById('forum-threads-list');
    const loadingStatus = document.getElementById('loading-status');
    if (!listElement) return;
    
    listElement.innerHTML = ''; // Clear existing mock data

    if (querySnapshot.empty) {
        listElement.innerHTML = '<p style="text-align:center;">தற்போது விவாதத் தலைப்புகள் எதுவும் இல்லை. நீங்கள் ஒரு புதிய தலைப்பைத் தொடங்கலாம்.</p>';
        if (loadingStatus) loadingStatus.style.display = 'none';
        return;
    }

    querySnapshot.forEach((doc) => {
        const thread = doc.data();
        const date = thread.lastUpdated ? new Date(thread.lastUpdated.toDate()).toLocaleString('ta-IN') : 'N/A';

        const threadItem = document.createElement('div');
        threadItem.className = 'thread-item';
        // Use Netlify redirect /thread_view to view the thread
        threadItem.setAttribute('onclick', `window.location.href='thread_view.html?id=${doc.id}'`);
        
        threadItem.innerHTML = `
            <h3 class="thread-title">${thread.title}</h3>
            <div class="thread-meta">
                <span>ஆசிரியர்: ${thread.authorName || 'அறியப்படாதவர்'} | கடைசியாக: ${date}</span>
                <span class="topic-tag">${thread.topic || 'பொது'}</span>
                <span><i class="fas fa-comments"></i> ${thread.replyCount || 0} பதில்கள்</span>
            </div>
        `;
        listElement.appendChild(threadItem);
    });
    
    if (loadingStatus) loadingStatus.style.display = 'none';
}


// --- 4. POLLS AND CONTESTS (6. சமூகம் & தொடர்பு) ---

/**
 * Placeholder: Loads active User Polls & Contests.
 */
window.loadActiveContests = async function() {
    const contestsRef = collection(db, "contests");
    const q = query(contestsRef, where("status", "==", "Active"));
    const querySnapshot = await getDocs(q);
    
    // Display logic (requires contests.html)
    window.showToastNotification(`தற்போது ${querySnapshot.size} போட்டிகள் செயலில் உள்ளன.`, 'info');
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}


// --- 5. INITIALIZATION ---

document.addEventListener('DOMContentLoaded', () => {
    // Check if we are on the forum page and load data
    if (window.location.pathname.includes('forum.html')) {
        // Forum is public, so load threads even if not logged in
        loadForumThreads();
    }
});

// Exporting utility functions for use in other files (gamification, etc.)
export { toggleFollow, loadForumThreads, loadActiveContests };
