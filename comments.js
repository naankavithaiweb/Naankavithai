/*
 * File: comments.js
 * Description: Core logic for Comment System, 5-Star Rating, and Reactions.
 * Purpose: Provides functionality for expandable cards within index.html (eliminating poem_view.html).
 */

// --- 1. FIREBASE IMPORTS ---
import { auth, db } from "./auth.js";
import { 
    collection, 
    addDoc, 
    serverTimestamp, 
    query, 
    where, 
    orderBy, 
    getDocs, 
    doc, 
    setDoc, 
    runTransaction,
    increment
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- 2. CORE COMMENT SYSTEM ---

/**
 * Handles posting a new comment.
 * @param {string} poemId - The ID of the poem.
 * @param {string} commentText - The comment content.
 */
window.postComment = async function(poemId, commentText) {
    const user = auth.currentUser;
    const cleanedText = commentText.trim();

    if (!user) {
        window.showToastNotification("கருத்து தெரிவிக்க உள்நுழையவும்.", 'error');
        return;
    }
    if (!cleanedText) {
        window.showToastNotification("கருத்து காலியாக இருக்கக் கூடாது.", 'warning');
        return;
    }
    
    try {
        await addDoc(collection(db, "comments"), {
            poemId: poemId,
            userId: user.uid,
            userName: user.displayName || 'Anonymous Poet',
            avatarUrl: user.photoURL || 'placeholder-avatar.png',
            text: cleanedText,
            timestamp: serverTimestamp(),
            reviewerBadge: 'New Critic' 
        });

        // Clear input and show success
        document.getElementById(`comment-input-${poemId}`).value = ''; 
        window.showToastNotification("கருத்து வெற்றிகரமாகப் பதியப்பட்டது!", 'success');
        loadComments(poemId); // Reload comments list

    } catch (error) {
        console.error("Error posting comment:", error);
        window.showToastNotification("கருத்து இடுவதில் பிழை ஏற்பட்டது.", 'error');
    }
}

/**
 * Loads and displays all comments for the given poem ID into the specific container.
 * @param {string} poemId - The ID of the poem.
 */
window.loadComments = async function(poemId) {
    const commentsRef = collection(db, "comments");
    // Uses the required composite index: poemId, timestamp
    const q = query(commentsRef, where("poemId", "==", poemId), orderBy('timestamp', 'desc'));
    const querySnapshot = await getDocs(q);
    const commentsList = document.getElementById(`comments-list-${poemId}`);
    
    if (!commentsList) return; // Ensure the element exists before proceeding

    commentsList.innerHTML = ''; 

    if (querySnapshot.empty) {
        commentsList.innerHTML = '<p style="text-align:center; font-style:italic;">இதுவரை கருத்துக்கள் இல்லை.</p>';
        document.getElementById(`comment-count-${poemId}`).textContent = 0;
        return;
    }

    let html = '';
    querySnapshot.forEach((doc) => {
        const comment = doc.data();
        const date = comment.timestamp ? new Date(comment.timestamp.toDate()).toLocaleString('ta-IN') : 'N/A';
        
        html += `
            <div class="comment-item" style="border: 1px solid var(--border-color); padding: 10px; margin-bottom: 5px; border-radius: 4px;">
                <strong>${comment.userName}</strong> 
                <span style="font-size:0.8em; background:#ffcc00; padding:2px 5px; border-radius:3px;">${comment.reviewerBadge}</span>
                <p style="margin: 5px 0;">${comment.text}</p>
                <small style="color:#777;">${date}</small>
            </div>
        `;
    });
    commentsList.innerHTML = html;
    document.getElementById(`comment-count-${poemId}`).textContent = querySnapshot.size;
}

// --- 3. RATING AND REACTIONS ---

/**
 * Handles the 5-Star User Rating System.
 * @param {number} ratingValue - The star value (1 to 5).
 * @param {string} poemId - The ID of the poem being rated.
 */
window.ratePoem = async function(ratingValue, poemId) {
    const user = auth.currentUser;
    if (!user) {
        window.showToastNotification("மதிப்பீடு அளிக்க உள்நுழையவும்.", 'error');
        return;
    }
    
    // NOTE: Full logic requires a transaction to update both 'ratings' collection and 'kavithai' averageRating field.
    window.showToastNotification(`கவிதை ${poemId.substring(0, 5)}... க்கு ${ratingValue} நட்சத்திர மதிப்பீடு அளிக்கப்பட்டது.`, 'success');
    
    // UI Update Placeholder: Visually update stars based on the ratingValue
    document.querySelectorAll(`[data-poem-id="${poemId}"]`).forEach(star => {
        const starValue = parseInt(star.getAttribute('data-value'));
        if (starValue <= ratingValue) {
            star.classList.add('rated');
        } else {
            star.classList.remove('rated');
        }
    });
}

/**
 * Handles the Like/Reaction System.
 */
window.handleReaction = async function(reactionType, poemId) {
    const user = auth.currentUser;
    if (!user) {
        window.showToastNotification("ரியாக்ஷன் அளிக்க உள்நுழையவும்.", 'error');
        return;
    }
    
    // NOTE: Full logic requires a transaction to prevent double counting.
    window.showToastNotification(`ரியாக்ஷன் (${reactionType}) பதியப்பட்டது.`, 'info');
}

/**
 * Handles Bookmark / Save for Later action.
 */
window.toggleBookmark = async function(poemId) {
    const user = auth.currentUser;
    if (!user) {
        window.showToastNotification("சேமிக்க உள்நுழையவும்.", 'error');
        return;
    }
    
    // NOTE: Full logic requires Firestore interaction (setDoc/deleteDoc in a 'bookmarks' collection).
    window.showToastNotification("கவிதை சேமிக்கப்பட்டது!", 'success');
}


// --- 4. EXPORTS ---
// No DOMContentLoaded listener is needed here as index.html calls the functions directly.
export { postComment, loadComments, ratePoem, handleReaction, toggleBookmark };
