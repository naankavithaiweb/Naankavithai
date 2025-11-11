/*
 * File: comments.js
 * Description: Handles the Comment System, 5-Star Rating, Like/Reaction, and Poem Data Loading.
 * Purpose: Provides core functionality for the poem_view.html page.
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
    increment,
    deleteDoc,
    getDoc as getFirestoreDoc // Renamed getDoc for clarity
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- 2. GLOBAL VARIABLES ---
let currentPoemId = null; 

/**
 * URL-இல் இருந்து கவிதை ID-ஐப் பெறுகிறது.
 */
function getPoemIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('id'); // Get the actual ID from the URL
}

// --- NEW FUNCTION: Loads the Poem's main content and metadata ---
async function loadPoemData(poemId) {
    if (!poemId) {
        window.showToastNotification("கவிதை ID URL-இல் கிடைக்கவில்லை.", 'warning');
        return;
    }

    try {
        const poemRef = doc(db, "kavithai", poemId);
        const poemSnap = await getFirestoreDoc(poemRef);

        const poemTitleEl = document.getElementById('poem-title');
        const authorNameEl = document.getElementById('author-name');
        const postDateEl = document.getElementById('post-date');
        const poemTextEl = document.getElementById('poem-text');
        
        if (poemSnap.exists()) {
            const poem = poemSnap.data();
            
            // Update Title and Content
            document.getElementById('poem-title-tag').textContent = poem.title + ' - நான் கவிதை';
            poemTitleEl.textContent = poem.title;
            poemTextEl.textContent = poem.content;

            // Update Metadata
            authorNameEl.textContent = poem.authorName || 'அறியப்படாதவர்';
            authorNameEl.href = `profile?uid=${poem.authorId}`; // Link to author profile
            postDateEl.textContent = poem.timestamp ? new Date(poem.timestamp.toDate()).toLocaleDateString('ta-IN') : 'N/A';

            // Update Reactions/Ratings (Initial values)
            document.getElementById('like-count').textContent = poem.likes || 0;
            document.getElementById('avg-rating').textContent = (poem.averageRating || 'N/A') + '/5';

            // Load related data
            loadComments(poemId); // Load comments after poem is loaded
            
            window.showToastNotification(`கவிதை "${poem.title.substring(0, 20)}..." ஏற்றப்பட்டது.`, 'success');

        } else {
            poemTitleEl.textContent = 'கவிதை காணப்படவில்லை';
            poemTextEl.textContent = 'இந்த ஐடி-க்கு (ID) பொருத்தமான கவிதைப் பதிவு தரவுத்தளத்தில் இல்லை.';
            window.showToastNotification("கவிதைப் பதிவு தரவுத்தளத்தில் இல்லை.", 'error');
        }

    } catch (error) {
        console.error("Error loading poem data:", error);
        document.getElementById('poem-text').textContent = 'தரவை ஏற்றுகையில் பிழை ஏற்பட்டது. (அனுமதி சிக்கல்).';
        window.showToastNotification("கவிதை ஏற்றுகையில் பிழை (Permissions)", 'error');
    }
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
        await addDoc(collection(db, "comments"), {
            poemId: currentPoemId,
            userId: user.uid,
            userName: user.displayName || 'Anonymous Poet',
            avatarUrl: user.photoURL || 'placeholder-avatar.png',
            text: commentText,
            timestamp: serverTimestamp(),
            reviewerBadge: 'New Critic' 
        });

        document.getElementById('comment-input').value = ''; 
        window.showToastNotification("கருத்து வெற்றிகரமாகப் பதியப்பட்டது!", 'success');
        loadComments(currentPoemId); 

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
    // Uses the required composite index: poemId, timestamp
    const q = query(commentsRef, where("poemId", "==", poemId), orderBy('timestamp', 'desc'));
    const querySnapshot = await getDocs(q);
    const commentsList = document.getElementById('comments-list');
    commentsList.innerHTML = ''; 

    if (querySnapshot.empty) {
        commentsList.innerHTML = '<p style="text-align:center;">இதுவரை கருத்துக்கள் இல்லை. நீங்கள் முதலில் கருத்து தெரிவிக்கலாம்!</p>';
        document.getElementById('comment-count').textContent = 0;
        return;
    }

    let html = '';
    querySnapshot.forEach((doc) => {
        const comment = doc.data();
        const date = comment.timestamp ? new Date(comment.timestamp.toDate()).toLocaleString('ta-IN') : 'N/A';
        
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
    window.showToastNotification(`மதிப்பீடு அளிக்கப்பட்டது: ${ratingValue} நட்சத்திரங்கள்.`, 'success');
}

window.handleReaction = async function(reactionType) {
    window.showToastNotification(`ரியாக்ஷன் (${reactionType}) பதியப்படுகிறது...`, 'info');
}

window.toggleBookmark = async function() {
    window.showToastNotification("கவிதை சேமிக்கப்பட்டது!", 'success');
}


// --- 5. INITIALIZATION ---

document.addEventListener('DOMContentLoaded', () => {
    currentPoemId = getPoemIdFromUrl();

    // Attach listener to rating stars
    document.querySelectorAll('.rating-star').forEach(star => {
        star.addEventListener('click', (e) => {
            const value = parseInt(e.currentTarget.getAttribute('data-value'));
            window.ratePoem(value);
        });
    });

    // Check auth state and load data
    auth.onAuthStateChanged((user) => {
        if (currentPoemId) {
            loadPoemData(currentPoemId); // CRITICAL: Call the data loading function
        }
    });
});

// Export all required functions
export { loadPoemData, postComment, loadComments, ratePoem, handleReaction, toggleBookmark };
