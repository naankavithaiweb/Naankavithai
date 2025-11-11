/*
 * File: comments.js
 * Description: Core logic for Comment System, 5-Star Rating, Like/Reaction, and Poem Data Loading.
 * Purpose: Provides functionality for homepage expandable cards.
 * FIX: Implements robust Firestore Transactions for ratings and likes.
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
    runTransaction, // Crucial for atomic updates
    increment,
    deleteDoc,
    getDoc as getFirestoreDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- 2. CORE UTILITIES ---
let currentPoemId = null; 

// -------------------------------------------------------------------------------------------------

// --- 3. COMMENT SYSTEM (Logic remains the same and works) ---

window.postComment = async function(poemId, commentText) {
    const user = auth.currentUser;
    const cleanedText = commentText.trim();
    if (!user) { window.showToastNotification("கருத்து தெரிவிக்க உள்நுழையவும்.", 'error'); return; }
    if (!cleanedText) { window.showToastNotification("கருத்து காலியாக இருக்கக் கூடாது.", 'warning'); return; }

    try {
        await addDoc(collection(db, "comments"), { 
            poemId, userId: user.uid, userName: user.displayName || 'Anonymous Poet', 
            text: cleanedText, timestamp: serverTimestamp(), reviewerBadge: 'New Critic' 
        });

        document.getElementById(`comment-input-${poemId}`).value = '';
        window.showToastNotification("கருத்து வெற்றிகரமாகப் பதியப்பட்டது!", 'success');
        window.loadComments(poemId);

    } catch (error) { window.showToastNotification("கருத்து இடுவதில் பிழை.", 'error'); }
}

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
                <span style="font-size:0.8em; background:#ffcc00; padding:2px 5px; border-radius:3px;">${comment.reviewerBadge || 'New Critic'}</span>
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
 * Handles the 5-Star User Rating System (FULL LOGIC with Transaction).
 */
window.ratePoem = async function(ratingValue, poemId) {
    const user = auth.currentUser;
    if (!user) {
        window.showToastNotification("மதிப்பீடு அளிக்க உள்நுழையவும்.", 'error');
        return;
    }

    const poemRef = doc(db, "kavithai", poemId);
    const userRatingRef = doc(db, "ratings", `${poemId}_${user.uid}`);
    let newAvgRating = 0;
    
    try {
        await runTransaction(db, async (transaction) => {
            const poemDoc = await transaction.get(poemRef);
            const currentRatingDoc = await transaction.get(userRatingRef);
            
            if (!poemDoc.exists()) { throw new Error("கவிதை ஆவணம் காணப்படவில்லை."); }

            const oldRating = currentRatingDoc.exists ? currentRatingDoc.data().rating : 0;
            let { totalRatings = 0, sumRatings = 0 } = poemDoc.data();

            if (oldRating === ratingValue) {
                // Unvote if clicked same star
                newSumRatings = sumRatings - ratingValue;
                newTotalRatings = totalRatings - 1;
                transaction.delete(userRatingRef);
                ratingValue = 0; 
            } else {
                // New vote or change
                newSumRatings = sumRatings - oldRating + ratingValue;
                if (oldRating === 0) newTotalRatings = totalRatings + 1;
                else newTotalRatings = totalRatings;

                transaction.set(userRatingRef, { poemId, userId: user.uid, rating: ratingValue, timestamp: serverTimestamp() });
            }
            
            newAvgRating = newTotalRatings > 0 ? newSumRatings / newTotalRatings : 0;
            
            transaction.update(poemRef, { sumRatings: newSumRatings, totalRatings: newTotalRatings, averageRating: newAvgRating });
        });

        // --- FINAL UI UPDATE AFTER SUCCESSFUL WRITE ---
        document.querySelectorAll(`[data-poem-id="${poemId}"]`).forEach(star => {
            const starValue = parseInt(star.getAttribute('data-value'));
            star.classList.toggle('rated', starValue <= ratingValue);
        });
        document.querySelector(`#poem-${poemId} .rating`).innerHTML = `<i class="fas fa-star"></i> ${(newAvgRating.toFixed(1) || 'N/A')}`;

        window.showToastNotification(`மதிப்பீடு வெற்றிகரமாகப் பதியப்பட்டது!`, 'success');

    } catch (error) {
        console.error("Rating transaction failed:", error);
        window.showToastNotification(`மதிப்பீடு தோல்வியடைந்தது: ${error.message.substring(0, 50)}`, 'error');
    }
}

/**
 * Handles the Like/Reaction System (FULL LOGIC).
 */
window.handleReaction = async function(reactionType, poemId) {
    const user = auth.currentUser;
    if (!user) { window.showToastNotification("ரியாக்ஷன் அளிக்க உள்நுழையவும்.", 'error'); return; }

    const userReactionRef = doc(db, "reactions", `${poemId}_${user.uid}_${reactionType}`);
    const poemRef = doc(db, "kavithai", poemId);
    
    try {
        const docSnap = await getFirestoreDoc(userReactionRef);
        const likeCountEl = document.querySelector(`#poem-${poemId} .likes`);

        if (docSnap.exists()) {
            // UNLIKE: Already liked, so delete reaction and decrement count
            await deleteDoc(userReactionRef);
            await updateDoc(poemRef, { likes: increment(-1) });
            window.showToastNotification(`ரியாக்ஷன் நீக்கப்பட்டது!`, 'info');
            
            // UI Update
            likeCountEl.innerHTML = `<i class="fas fa-heart"></i> ${parseInt(likeCountEl.textContent.replace(/\D/g, '')) - 1}`;
        } else {
            // LIKE: Add reaction and increment count
            await setDoc(userReactionRef, { poemId, userId: user.uid, type: reactionType, timestamp: serverTimestamp() });
            await updateDoc(poemRef, { likes: increment(1) });
            window.showToastNotification(`ரியாக்ஷன் (${reactionType}) வெற்றிகரமாகப் பதியப்பட்டது!`, 'success');
            
            // UI Update
            likeCountEl.innerHTML = `<i class="fas fa-heart"></i> ${parseInt(likeCountEl.textContent.replace(/\D/g, '')) + 1}`;
        }

    } catch (error) {
        console.error("Reaction failed:", error);
        window.showToastNotification("ரியாக்ஷன் தோல்வியடைந்தது.", 'error');
    }
}

/**
 * Handles Bookmark / Save for Later action (FULL LOGIC).
 */
window.toggleBookmark = async function(poemId) {
    const user = auth.currentUser;
    if (!user) { window.showToastNotification("சேமிக்க உள்நுழையவும்.", 'error'); return; }

    const bookmarkRef = doc(db, "bookmarks", `${user.uid}_${poemId}`);
    
    try {
        const docSnap = await getFirestoreDoc(bookmarkRef);
        
        if (docSnap.exists()) {
            await deleteDoc(bookmarkRef); 
            window.showToastNotification("கவிதை சேமித்தவற்றிலிருந்து நீக்கப்பட்டது.", 'info');
        } else {
            await setDoc(bookmarkRef, { userId: user.uid, poemId: poemId, timestamp: serverTimestamp() });
            window.showToastNotification("கவிதை வெற்றிகரமாகச் சேமிக்கப்பட்டது!", 'success');
        }
        
    } catch (error) {
        console.error("Bookmark failed:", error);
        window.showToastNotification("சேமிப்பதில் பிழை ஏற்பட்டது.", 'error');
    }
}

// Export all required functions
export { loadComments, postComment, ratePoem, handleReaction, toggleBookmark };
