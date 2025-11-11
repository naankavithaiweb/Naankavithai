/*
 * File: comments.js
 * Description: Handles the Comment System, 5-Star Rating, Like/Reaction, and Poem Data Loading.
 * Purpose: Provides core functionality for the homepage expandable cards.
 * FIX: Implements immediate UI feedback and Firestore Transactions for ratings.
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
    runTransaction, // Crucial for transaction logic
    increment,
    deleteDoc,
    getDoc as getFirestoreDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- 2. GLOBAL UTILITIES ---
let currentPoemId = null; 

function getPoemIdFromUrl() { /* ... */ } // Logic remains the same

// -------------------------------------------------------------------------------------------------

/**
 * Handles posting a new comment.
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

        document.getElementById(`comment-input-${poemId}`).value = ''; 
        window.showToastNotification("கருத்து வெற்றிகரமாகப் பதியப்பட்டது!", 'success');
        loadComments(poemId); 

    } catch (error) {
        console.error("Error posting comment:", error);
        window.showToastNotification("கருத்து இடுவதில் பிழை ஏற்பட்டது.", 'error');
    }
}

/**
 * Loads and displays all comments for the given poem ID into the specific container.
 */
window.loadComments = async function(poemId) {
    const commentsRef = collection(db, "comments");
    const q = query(commentsRef, where("poemId", "==", poemId), orderBy('timestamp', 'desc'));
    const querySnapshot = await getDocs(q);
    const commentsList = document.getElementById(`comments-list-${poemId}`);
    const commentCountEl = document.getElementById(`comment-count-${poemId}`);
    
    if (!commentsList) return; 

    commentsList.innerHTML = ''; 

    if (querySnapshot.empty) {
        commentsList.innerHTML = '<p style="text-align:center; font-style:italic;">இதுவரை கருத்துக்கள் இல்லை.</p>';
        if (commentCountEl) commentCountEl.textContent = 0;
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
    if (commentCountEl) commentCountEl.textContent = querySnapshot.size;
}

// -------------------------------------------------------------------------------------------------

/**
 * Handles the 5-Star User Rating System (Real Logic).
 */
window.ratePoem = async function(ratingValue, poemId) {
    const user = auth.currentUser;
    if (!user) {
        window.showToastNotification("மதிப்பீடு அளிக்க உள்நுழையவும்.", 'error');
        return;
    }

    // --- 1. UI FIX: Highlight the stars immediately ---
    document.querySelectorAll(`[data-poem-id="${poemId}"]`).forEach(star => {
        const starValue = parseInt(star.getAttribute('data-value'));
        if (starValue <= ratingValue) {
            star.classList.add('rated'); 
        } else {
            star.classList.remove('rated');
        }
    });

    const poemRef = doc(db, "kavithai", poemId);
    const userRatingRef = doc(db, "ratings", `${poemId}_${user.uid}`);
    let newAvgRating = null;
    
    try {
        await runTransaction(db, async (transaction) => {
            const poemDoc = await transaction.get(poemRef);
            const currentRatingDoc = await transaction.get(userRatingRef);
            
            if (!poemDoc.exists()) { throw new Error("கவிதை ஆவணம் காணப்படவில்லை."); }

            const oldRating = currentRatingDoc.exists ? currentRatingDoc.data().rating : 0;
            const totalRatings = poemDoc.data().totalRatings || 0;
            const sumRatings = poemDoc.data().sumRatings || 0;

            let newTotalRatings = totalRatings;
            let newSumRatings = sumRatings;

            if (oldRating === ratingValue) {
                // User clicked the same rating, delete the rating (unvote)
                newSumRatings = sumRatings - ratingValue;
                newTotalRatings = totalRatings - 1;
                transaction.delete(userRatingRef);
                ratingValue = 0; // Mark as unvoted
            } else {
                 // Update/New rating
                if (oldRating === 0) {
                     newTotalRatings = totalRatings + 1; // New vote
                }
                newSumRatings = sumRatings - oldRating + ratingValue;
                
                transaction.set(userRatingRef, {
                    poemId: poemId,
                    userId: user.uid,
                    rating: ratingValue, // Permanent user rating record
                    timestamp: serverTimestamp()
                });
            }
            
            // Calculate new average
            newAvgRating = newTotalRatings > 0 ? newSumRatings / newTotalRatings : 0;
            
            // Update the overall poem document
            transaction.update(poemRef, {
                sumRatings: newSumRatings,
                totalRatings: newTotalRatings,
                averageRating: newAvgRating, // Permanent data change
            });
        });

        // Update UI with final calculated average
        document.getElementById(`avg-rating`).textContent = (newAvgRating.toFixed(1) || 'N/A') + '/5';

        if (ratingValue > 0) {
            window.showToastNotification(`மதிப்பீடு வெற்றிகரமாகப் பதியப்பட்டது! (${ratingValue} நட்சத்திரங்கள்)`, 'success');
        } else {
             window.showToastNotification("மதிப்பீடு நீக்கப்பட்டது.", 'info');
        }

    } catch (error) {
        console.error("Rating transaction failed:", error);
        window.showToastNotification(`மதிப்பீடு தோல்வியடைந்தது: ${error.message.substring(0, 50)}`, 'error');
    }
}

/**
 * Handles the Like/Reaction System (Real Logic).
 */
window.handleReaction = async function(reactionType, poemId) {
    const user = auth.currentUser;
    if (!user) {
        window.showToastNotification("ரியாக்ஷன் அளிக்க உள்நுழையவும்.", 'error');
        return;
    }
    
    // NOTE: This uses increment for robust counting.
    const poemRef = doc(db, "kavithai", poemId);
    
    try {
        await updateDoc(poemRef, {
            likes: increment(1) // Permanent like update
        });

        // Update UI counter immediately (will be corrected by next homepage load)
        const likeCountEl = document.getElementById('like-count');
        if (likeCountEl) {
             likeCountEl.textContent = (parseInt(likeCountEl.textContent) || 0) + 1;
        }

        window.showToastNotification(`ரியாக்ஷன் (${reactionType}) வெற்றிகரமாகப் பதியப்பட்டது!`, 'success');

    } catch (error) {
        console.error("Reaction failed:", error);
        window.showToastNotification("ரியாக்ஷன் தோல்வியடைந்தது. (Permissions)", 'error');
    }
}

/**
 * Handles Bookmark / Save for Later action (Real Logic).
 */
window.toggleBookmark = async function(poemId) {
    const user = auth.currentUser;
    if (!user) {
        window.showToastNotification("சேமிக்க உள்நுழையவும்.", 'error');
        return;
    }

    const bookmarkRef = doc(db, "bookmarks", `${user.uid}_${poemId}`);
    
    try {
        const docSnap = await getFirestoreDoc(bookmarkRef);
        
        if (docSnap.exists()) {
            await deleteDoc(bookmarkRef); 
            window.showToastNotification("கவிதை சேமித்தவற்றிலிருந்து நீக்கப்பட்டது.", 'info');
        } else {
            await setDoc(bookmarkRef, {
                userId: user.uid,
                poemId: poemId,
                timestamp: serverTimestamp()
            });
            window.showToastNotification("கவிதை வெற்றிகரமாகச் சேமிக்கப்பட்டது!", 'success');
        }
        
    } catch (error) {
        console.error("Bookmark failed:", error);
        window.showToastNotification("சேமிப்பதில் பிழை ஏற்பட்டது.", 'error');
    }
}


// --- 5. INITIALIZATION ---

document.addEventListener('DOMContentLoaded', () => {
    // No auto-loading needed here as index.html handles the calls via togglePoemDetails.
});

// Export all required functions
export { loadComments, postComment, ratePoem, handleReaction, toggleBookmark };
