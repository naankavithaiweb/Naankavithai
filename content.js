/*
 * File: content.js
 * Description: Handles content creation and storage operations (Kavithai Postings) in Firestore.
 * Purpose: Centralizes the core logic for publishing and drafting content.
 */

// --- 1. FIREBASE IMPORTS ---
import { auth, db } from "./auth.js";
import { collection, addDoc, serverTimestamp, doc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- 2. CORE CONTENT SUBMISSION FUNCTION ---

async function saveKavithaiToFirestore(data, status) {
    const user = auth.currentUser;
    if (!user) {
        window.showToastNotification("கவிதையை வெளியிட, நீங்கள் உள்நுழைய வேண்டும்.", 'error');
        return;
    }

    // --- Content Structure (AI fields removed) ---
    const kavithaiData = {
        title: data.title,
        content: data.content,
        authorId: user.uid,
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
        
        const userRef = doc(db, "users", user.uid);
        await updateDoc(userRef, {
            postCount: increment(1)
        });
        
        window.showToastNotification(`கவிதை வெற்றிகரமாக ${status === 'Draft' ? 'வரைவாகச் சேமிக்கப்பட்டது' : 'சமர்ப்பிக்கப்பட்டது'}!`, 'success');
        
        document.getElementById('kavithai-post-form').reset();
        
        if (window.uploadedMediaUrls) {
            window.uploadedMediaUrls = { imageUrl: null, audioUrl: null };
        }
        
        document.getElementById('image-upload-status').innerHTML = '';
        document.getElementById('audio-upload-status').innerHTML = '';

    } catch (error) {
        console.error("Error adding document: ", error);
        window.showToastNotification(`கவிதை சேமிப்பில் பிழை ஏற்பட்டது: ${error.message}`, 'error');
    }
}

// --- 3. FORM EVENT LISTENERS ---

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('kavithai-post-form');
    const publishBtn = document.getElementById('publish-btn');
    const draftBtn = document.getElementById('draft-btn');

    if (!form) return;
    
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

    draftBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        
        const data = collectFormData();
        if (!data.title && !data.content && !data.media.imageUrl && !data.media.audioUrl) {
            window.showToastNotification("வரைவாகச் சேமிக்க எதுவும் இல்லை.", 'info');
            return;
        }
        
        await saveKavithaiToFirestore(data, 'Draft'); 
    });
    
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
