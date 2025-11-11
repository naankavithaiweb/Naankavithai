/*
 * File: search.js
 * Description: Handles Search, Filtering, and Personalized Feed Logic.
 * Integrates: Firestore for querying 'kavithai' collection based on user inputs.
 * FIX: Added Token Gated Content check and Real-time Translation Placeholder.
 */

// --- 1. FIREBASE IMPORTS ---
import { auth, db } from "./auth.js";
import { 
    collection, 
    query, 
    where, 
    orderBy, 
    limit, 
    getDocs,
    startAt,
    endAt
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
// FIX: Import the Web3 access function
import { canAccessTokenGatedContent } from "./web3_wallet.js"; 

// --- 2. GLOBAL ELEMENTS ---
const poemResultsList = document.getElementById('poem-results-list');
const resultsCountDisplay = document.getElementById('results-count');
const searchInput = document.getElementById('search-input');
const filterTheme = document.getElementById('filter-theme');
const filterSort = document.getElementById('filter-sort');
const filterGeo = document.getElementById('filter-geo');
const filterToken = document.getElementById('filter-token');

// --- 3. SEARCH AND FILTERING LOGIC (KEEPING CORE LOGIC) ---

/**
 * Performs the core search and filtering operation against Firestore.
 * This function is exported for use in index.html.
 */
async function executeSearchQuery(searchTerm, filters, resultLimit = 10) {
    
    // 1. Base Query: Only show 'Approved' posts
    let q = query(collection(db, "kavithai"), where("status", "==", "Approved"));
    
    // 2. Apply Theme Filter
    if (filters.theme && filters.theme !== 'all') {
        q = query(q, where("tags", "array-contains", filters.theme));
    }
    
    // 3. Apply Geo Filter 
    if (filters.geo && filters.geo !== 'global') {
        q = query(q, where("location", "==", filters.geo)); 
    }
    
    // 4. Apply Token Filter (CRITICAL: Can only filter by 'isTokenGated' status)
    if (filters.token === 'gated') {
        q = query(q, where("isTokenGated", "==", true));
        window.showToastNotification("டோக்கன் பூட்டப்பட்ட உள்ளடக்கத்தை தேடுகிறது.", 'info');
    } else if (filters.token === 'unlocked') {
        // NOTE: 'Unlocked' filtering must be done client-side after fetching the results,
        // as Firestore cannot check external wallet status. For now, we fetch all.
    }
    
    // 5. Apply Search Term (Basic prefix search on title - requires Firestore index)
    if (searchTerm) {
        q = query(
            q, 
            orderBy("title"), 
            startAt(searchTerm), 
            endAt(searchTerm + '\uf8ff')
        );
    }
    
    // 6. Apply Sorting (Advanced Dynamic Filtering)
    const [field, direction] = filters.sort ? filters.sort.split('-') : ['date', 'desc']; 

    if (field === 'date') {
        q = query(q, orderBy("timestamp", direction));
    } else if (field === 'views') {
        q = query(q, orderBy("views", direction));
    } else if (field === 'rating') {
        q = query(q, orderBy("averageRating", direction));
    } else if (field === 'author') {
        q = query(q, orderBy("authorName", direction)); 
    }
    
    // Limit results
    q = query(q, limit(resultLimit));

    try {
        const querySnapshot = await getDocs(q);
        let poems = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // FIX: Client-side filtering for 'unlocked' content
        if (filters.token === 'unlocked') {
            poems = poems.filter(poem => {
                // Mock: Assuming token gated content requires 10 NKT to unlock
                if (poem.isTokenGated && poem.tokenRequirement) {
                    return canAccessTokenGatedContent(poem.id, poem.tokenRequirement);
                }
                return !poem.isTokenGated; // Show non-gated content too
            });
        }
        
        return poems;

    } catch (error) {
        console.error("Firestore Search Query Failed:", error);
        return [];
    }
}

/**
 * Renders the search results specifically for the search.html page.
 */
function renderResults(poems) {
    if (!poemResultsList) return; 

    poemResultsList.innerHTML = '';
    resultsCountDisplay.textContent = `தேடல் முடிவுகள்: ${poems.length} கவிதைகள்`;
    
    if (poems.length === 0) {
        poemResultsList.innerHTML = '<p style="text-align:center; padding: 20px;">உங்கள் தேடலுக்குப் பொருத்தமான கவிதைகள் எதுவும் இல்லை.</p>';
        return;
    }

    poems.forEach(poem => {
        const card = document.createElement('div');
        card.className = 'poem-card';
        card.setAttribute('onclick', `window.location.href='poem_view?id=${poem.id}'`);

        const tags = poem.tags ? poem.tags.map(tag => `#${tag}`).join(' ') : '';
        const views = poem.views || 0;
        const rating = (poem.averageRating || 0).toFixed(1);
        
        // FIX: Display Token Gated Status
        const gatedStatus = poem.isTokenGated ? `<span style="color:${poem.isTokenGated ? '#e74c3c' : '#2ecc71'}; margin-left: 10px;"><i class="fas fa-lock"></i> Token Gated</span>` : '';

        card.innerHTML = `
            <h3>${poem.title} ${gatedStatus}</h3>
            <p>${poem.content ? poem.content.substring(0, 100) : 'உள்ளடக்கம் இல்லை'}...</p>
            <div class="poem-meta">
                ஆசிரியர்: ${poem.authorName || 'அறியப்படாதவர்'} | 
                பார்வைகள்: ${views} | 
                மதிப்பீடு: ${rating} <i class="fas fa-star"></i>
            </div>
            <p style="font-size: 0.85em; color: var(--secondary-color);">${tags}</p>
        `;
        poemResultsList.appendChild(card);
    });
}

/**
 * Collects filters and initiates the search (Used by search.html).
 */
window.performSearch = async function() {
    if (!searchInput) return; 

    poemResultsList.innerHTML = '<p style="text-align:center; padding: 20px;"><i class="fas fa-spinner fa-spin"></i> கவிதைகளைத் தேடுகிறது...</p>';
    resultsCountDisplay.textContent = `தேடல் முடிவுகள்: ஏற்றுகிறது...`;
    
    const searchTerm = searchInput.value.trim().toLowerCase();
    
    const filters = {
        theme: filterTheme.value,
        sort: filterSort.value,
        geo: filterGeo.value,
        token: filterToken.value
    };
    
    const results = await executeSearchQuery(searchTerm, filters, 50); // Limit 50 for search page
    renderResults(results);
}

window.applyFilters = function() {
    window.performSearch();
}

window.resetFilters = function() {
    searchInput.value = '';
    if (filterTheme) filterTheme.value = 'all';
    if (filterSort) filterSort.value = 'date-desc';
    if (filterGeo) filterGeo.value = 'global';
    if (filterToken) filterToken.value = 'none';
    window.performSearch();
}


// --- 4. NEW UX/UTILITY FUNCTIONS ---

/**
 * 5. Real-time Translation (Placeholder)
 * @param {string} text - The text to translate.
 * @param {string} targetLang - The target language (e.g., 'en', 'ta').
 */
window.realTimeTranslate = async function(text, targetLang) {
    if (targetLang === 'ta') {
        window.showToastNotification("மொழிபெயர்ப்புத் தேவை இல்லை. (ஏற்கனவே தமிழில் உள்ளது)", 'info');
        return text;
    }
    
    window.showToastNotification(`API மூலம் '${targetLang}' மொழியில் மொழிபெயர்க்கிறது... (Backend API Call Required)`, 'info');
    
    // MOCK Translation:
    return `[மொழிபெயர்க்கப்பட்டது: ${text.substring(0, 20)}... in ${targetLang}]`;
}


// --- 5. INITIALIZATION ---

document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname.includes('search.html')) {
        auth.onAuthStateChanged(() => {
            window.performSearch();
        });
    }
    
    if (searchInput) {
        document.addEventListener('keydown', (e) => {
            if (e.key === '/') { 
                e.preventDefault();
                searchInput.focus();
            }
        });
    }
});


// --- 6. EXPORTS (CRUCIAL for index.html) ---
export { executeSearchQuery, renderResults, realTimeTranslate };
