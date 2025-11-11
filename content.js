/*
 * File: content.js
 * Description: Handles content creation and storage operations (Kavithai Postings) in Firestore.
 * Integrates: Poem Posting Form data, Cloudinary URLs, and basic metadata.
 * FIX: Enhanced to include Licensing and AI Placeholder calls.
 */

// --- 1. FIREBASE IMPORTS ---
import { auth, db } from "./auth.js";
import { 
    collection, 
    addDoc, 
    serverTimestamp, 
    doc, 
    updateDoc, 
    increment,
    getDoc // FIX: Added to fetch user data for AI scores
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- 2. AI & QUALITY CONTROL PLACEHOLDERS (3. உள்ளடக்க உருவாக்கம் & தரம்) ---

/**
 * MOCK Function: Simulates calling a Firebase Cloud Function for AI analysis.
 * In a final app, this would be an API call to a backend service (Gemini/ML).
 * @param {string} content - The poem text.
 * @returns {object} - Mock analysis results.
 */
async function runAIContentAnalysis(content) {
    window.showToastNotification("🧠 AI கவிதை தரத்தை பகுப்பாய்வு செய்கிறது...", 'info', 5000);
    
    // 3. AI Scoring Placeholder (Grammar/Structure)
    const mockAIScore = Math.floor(Math.random() * 100) + 1; // 1 to 100
    
    // 3. Kavithai Theme/Tone Analysis (AI) & AI Content Categorizer
    const mockAITags = ['காதல்', 'தத்துவம்', 'சோகம்', 'இயற்கை'][Math.floor(Math.random() * 4)];
    
    return {
        aiScore: mockAIScore,
        aiTheme: mockAITags,
        aiSummary: content.substring(0, 30) + "..." // 3. Kavithai Summarizer
    };
}


// --- 3. CORE CONTENT SUBMISSION FUNCTION ---

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
    
    // Run AI analysis only for publishing (not drafts)
    const aiResults = status !== 'Draft' ? await runAIContentAnalysis(data.content) : {};

    // --- Content Structure ---
    const kavithaiData = {
        title: data.title,
        content: data.content,
        authorId: user.uid, 
        authorName: user.displayName || user.email,
        tags: [...new Set([...data.tags, aiResults.aiTheme].filter(t => t))], // FIX: Merge user tags with AI tags
        series: data.series,
        coAuthors: data.coAuthors.split(',').map(a => a.trim()).filter(a => a.length > 0), 
        
        media: data.media, 
        
        timestamp: serverTimestamp(),
        // FIX: Store License and Copyright
        license: data.license, 
        copyrightAgreed: data.copyrightAgreed,
        
        // FIX: Store AI Results
        aiAnalysis: aiResults,
        
        // Set initial status based on admin/AI rules (Simplified here)
        // If AI score is very low, force it to Pending_Review (even if publishing)
        status: (aiResults.aiScore < 30 && status !== 'Draft') ? 'Pending_Review' : status,
        
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
        console.error("Error adding document: ", error);
        
        let displayMessage = `கவிதை சேமிப்பில் பிழை ஏற்பட்டது.`;
        
        if (error.message.includes('permission denied')) {
            displayMessage = "🚫 அனுமதி மறுக்கப்பட்டது! (Firestore Rules-ஐ சரிபார்க்கவும்)";
        } else {
            displayMessage = `சேமிப்பில் பிழை: ${error.message.substring(0, 50)}...`;
        }
        
        window.showToastNotification(displayMessage, 'error');
    }
}

// --- 4. FORM EVENT LISTENERS ---

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
            media: window.uploadedMediaUrls || { imageUrl: null, audioUrl: null },
            // FIX: Collect License and Copyright data
            license: document.getElementById('content-license').value,
            copyrightAgreed: document.getElementById('copyright-agree').checked 
        };
    };

    // 4.1. Handle Publish Submission
    publishBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        
        const title = document.getElementById('poem-title').value.trim();
        const content = document.getElementById('poem-content').value.trim();
        const copyrightAgreed = document.getElementById('copyright-agree').checked; // Check separately
        
        if (!title || !content) {
            window.showToastNotification("தயவுசெய்து தலைப்பையும் உள்ளடக்கத்தையும் நிரப்பவும்.", 'warning');
            return;
        }
        
        // FIX: Enforce Copyright Declaration on Publish
        if (!copyrightAgreed) {
             window.showToastNotification("உள்ளடக்க உரிமையாளர் அறிவிப்பை உறுதிப்படுத்தவும்.", 'error');
             return;
        }

        const data = collectFormData();
        // FIX: Submitting for approval
        await saveKavithaiToFirestore(data, 'Pending_Approval'); 
    });

    // 4.2. Handle Draft Saving (Version History)
    draftBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        
        const data = collectFormData();
        if (!data.title && !data.content && !data.media.imageUrl && !data.media.audioUrl) {
            window.showToastNotification("வரைவாகச் சேமிக்க எதுவும் இல்லை.", 'info');
            return;
        }
        
        // FIX: Saving as Draft (No need for Copyright check)
        await saveKavithaiToFirestore(data, 'Draft'); 
    });
    
    // 4.3. Ensure Auth check runs
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
