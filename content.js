/*
 * File: content.js
 * Description: Handles content creation and storage operations (Kavithai Postings) in Firestore.
 * Integrates: Poem Posting Form data, Cloudinary URLs, and basic metadata.
 * FIX: Enhanced error handling to diagnose Firestore Rules issues.
 */

// --- 1. FIREBASE IMPORTS ---
import { auth, db } from "./auth.js";
import { 
    collection, 
    addDoc, 
    serverTimestamp, 
    doc, 
    updateDoc, 
    increment 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- 2. CORE CONTENT SUBMISSION FUNCTION ---

/**
 * கவிதை தரவை Firestore-இல் சேமிக்கிறது.
 * @param {object} data - The collected post data from the form.
 * @param {string} status - 'Draft' or 'Pending_Approval'.
 */
async function saveKavithaiToFirestore(data, status) {
    const user = auth.currentUser;
    if (!user) {
        window.showToastNotification("கவிதையை வெளியிட, நீங்கள் உள்நுழைய வேண்டும்.", 'error');
        return;
    }

    // --- Content Structure (Uses required authorId for Firestore Rules) ---
    const kavithaiData = {
        title: data.title,
        content: data.content,
        authorId: user.uid, // CRITICAL: Required by Firestore Rules
        authorName: user.displayName || user.email,
        tags: data.tags,
        series: data.series,
        coAuthors: data.coAuthors.split(',').map(a => a.trim()).filter(a => a.length > 0), 
        
        media: data.media, 
        
        timestamp: serverTimestamp(),
        status: status,
        license: 'Standard CC',
        
        views: 0,
        likes: 0,
        earnings: 0,
    };

    try {
        const docRef = await addDoc(collection(db, "kavithai"), kavithaiData);
        
        // Update the user's post count (Gamification)
        const userRef = doc(db, "users", user.uid);
        await updateDoc(userRef, {
            postCount: increment(1)
        });
        
        // Success Actions
        window.showToastNotification(`கவிதை வெற்றிகரமாக ${status === 'Draft' ? 'வரைவாகச் சேமிக்கப்பட்டது' : 'சமர்ப்பிக்கப்பட்டது'}!`, 'success');
        
        // Clear the form and media URLs after success
        document.getElementById('kavithai-post-form').reset();
        
        if (window.uploadedMediaUrls) {
            window.uploadedMediaUrls = { imageUrl: null, audioUrl: null };
        }
        
        document.getElementById('image-upload-status').innerHTML = '';
        document.getElementById('audio-upload-status').innerHTML = '';

    } catch (error) {
        // --- CRITICAL FIX: Enhanced Error Reporting ---
        console.error("Error adding document: ", error);
        
        let displayMessage = `கவிதை சேமிப்பில் பிழை ஏற்பட்டது.`;
        
        if (error.message.includes('permission denied')) {
            displayMessage = "🚫 அனுமதி மறுக்கப்பட்டது! (Firestore Rules-ஐ சரிபார்க்கவும்)";
        } else if (error.message.includes('Function call failed')) {
            displayMessage = "பிழை: சர்வர் செயல்பாட்டில் சிக்கல்.";
        } else {
            displayMessage = `சேமிப்பில் பிழை: ${error.message.substring(0, 50)}...`;
        }
        
        window.showToastNotification(displayMessage, 'error');
    }
}

// --- 3. FORM EVENT LISTENERS ---

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('kavithai-post-form');
    const publishBtn = document.getElementById('publish-btn');
    const draftBtn = document.getElementById('draft-btn');

    if (!form) return;
    
    // Function to collect all form data
    const collectFormData = () => {
        return {
            title: document.getElementById('poem-title').value.trim(),
            content: document.getElementById('poem-content').value.trim(),
            tags: document.getElementById('poem-tags').value.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0),
            series: document.getElementById('series-name').value.trim(),
            coAuthors: document.getElementById('co-authors').value.trim(),
            media: window.uploadedMediaUrls || { imageUrl: null, audioUrl: null } 
        };
    };

    // 3.1. Handle Publish Submission
    publishBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        
        const title = document.getElementById('poem-title').value.trim();
        const content = document.getElementById('poem-content').value.trim();
        if (!title || !content) {
            window.showToastNotification("தயவுசெய்து தலைப்பையும் உள்ளடக்கத்தையும் நிரப்பவும்.", 'warning');
            return;
        }

        const data = collectFormData();
        await saveKavithaiToFirestore(data, 'Pending_Approval'); 
    });

    // 3.2. Handle Draft Saving (Version History)
    draftBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        
        const data = collectFormData();
        if (!data.title && !data.content && !data.media.imageUrl && !data.media.audioUrl) {
            window.showToastNotification("வரைவாகச் சேமிக்க எதுவும் இல்லை.", 'info');
            return;
        }
        
        await saveKavithaiToFirestore(data, 'Draft'); 
    });
    
    // 3.3. Ensure Auth check runs
    auth.onAuthStateChanged((user) => {
        if (!user) {
            publishBtn.disabled = true;
            draftBtn.disabled = true;
        } else {
             publishBtn.disabled = false;
             draftBtn.disabled = false;
        }
    });

});

export { saveKavithaiToFirestore };
