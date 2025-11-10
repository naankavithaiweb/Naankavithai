/*
 * File: comments.js
 * Description: Handles the Comment System, 5-Star Rating, Like/Reaction, and
 * integrates Gamified Review System.
 * FIX: Sentiment Analysis (AI) feature removed.
 */

// --- 1. FIREBASE IMPORTS ---
import { auth, db } from "./auth.js";
import { 
    collection, 
    addDoc, 
    serverTimestamp, 
    query, 
    where, 
    getDocs, 
    doc, 
    setDoc, 
    runTransaction,
    increment,
    deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- 2. GLOBAL VARIABLES ---
let currentPoemId = null; 

function getPoemIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('id') || 'MOCK_POEM_ID_123'; 
}

// --- 3. COMMENT SYSTEM ---

/**
 * Handles posting a new comment.
 */
window.postComment = async function() {
    const user = auth.currentUser;
    const commentText = document.getElementById('comment-input').value.trim();
    currentPoemId = getPoemIdFromUrl();

    if (!user) {
        window.showToastNotification("கருத்து தெரிவிக்க உள்நுழையவும்.", 'error');
        return;
    }
    if (!commentText) {
        window.showToastNotification("கருத்து காலியாக இருக்கக் கூடாது.", 'warning');
        return;
    }
    
    try {
        // Add comment to 'comments' collection
        await addDoc(collection(db, "comments"), {
            poemId: currentPoemId,
            userId: user.uid,
            userName: user.displayName || 'Anonymous Poet',
            avatarUrl: user.photoURL || 'placeholder-avatar.png',
            text: commentText,
            timestamp: serverTimestamp(),
            // Sentiment field is removed
            reviewerBadge: 'New Critic' 
        });

        document.getElementById('comment-input').value = ''; // Clear input
        window.showToastNotification("கருத்து வெற்றிகரமாகப் பதியப்பட்டது!", 'success');
        loadComments(currentPoemId); // Reload comments list

    } catch (error) {
        console.error("Error posting comment:", error);
        window.showToastNotification("கருத்து இடுவதில் பிழை ஏற்பட்டது.", 'error');
    }
}

/**
 * Loads and displays all comments for the current poem.
 */
async function loadComments(poemId) {
    const commentsRef = collection(db, "comments");
    const q = query(commentsRef, where("poemId", "==", poemId), orderBy('timestamp', 'desc'));
    const querySnapshot = await getDocs(q);
    const commentsList = document.getElementById('comments-list');
    commentsList.innerHTML = ''; // Clear existing

    if (querySnapshot.empty) {
        commentsList.innerHTML = '<p style="text-align:center;">இதுவரை கருத்துக்கள் இல்லை. நீங்கள் முதலில் கருத்து தெரிவிக்கலாம்!</p>';
        document.getElementById('comment-count').textContent = 0;
        return;
    }

    let html = '';
    querySnapshot.forEach((doc) => {
        const comment = doc.data();
        const date = comment.timestamp ? new Date(comment.timestamp.toDate()).toLocaleString('ta-IN') : 'N/A';
        
        // Removed Sentiment display
        html += `
            <div class="comment-item">
                <strong>${comment.userName}</strong> 
                <span class="review-badge">${comment.reviewerBadge}</span>
                <p>${comment.text}</p>
                <small style="color:#777;">${date}</small>
            </div>
        `;
    });
    commentsList.innerHTML = html;
    document.getElementById('comment-count').textContent = querySnapshot.size;
}

// --- 4. RATING AND REACTIONS (Logic remains the same) ---

window.ratePoem = async function(ratingValue) {
    // ... (Rating logic remains the same) ...
}

function updateRatingStars(value) {
    // ... (UI update logic remains the same) ...
}

window.handleReaction = async function(reactionType) {
    // ... (Reaction logic remains the same) ...
}

async function updateAverageRating(poemId) {
    // ... (Average rating placeholder remains the same) ...
}

// --- 5. BOOKMARK / SAVE FOR LATER (Logic remains the same) ---

window.toggleBookmark = async function() {
    // ... (Bookmark logic remains the same) ...
}


// --- 6. INITIALIZATION ---

document.addEventListener('DOMContentLoaded', () => {
    currentPoemId = getPoemIdFromUrl();

    document.querySelectorAll('.rating-star').forEach(star => {
        star.addEventListener('click', (e) => {
            const value = parseInt(e.currentTarget.getAttribute('data-value'));
            window.ratePoem(value);
        });
    });

    auth.onAuthStateChanged((user) => {
        if (currentPoemId) {
            loadComments(currentPoemId);
        } else {
            window.showToastNotification("கவிதை ID கிடைக்கவில்லை. Mock தரவு காட்டப்படுகிறது.", 'warning');
        }
    });
});
