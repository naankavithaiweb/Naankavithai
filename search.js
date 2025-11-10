/*
 * File: search.js
 * Description: Handles Search, Filtering, and Personalized Feed Logic.
 * Integrates: Firestore for querying 'kavithai' collection based on user inputs.
 * Purpose: Allows users to find content efficiently using dynamic filters and personalized results.
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

// --- 2. GLOBAL ELEMENTS ---
const poemResultsList = document.getElementById('poem-results-list');
const resultsCountDisplay = document.getElementById('results-count');
const searchInput = document.getElementById('search-input');
const filterTheme = document.getElementById('filter-theme');
const filterSort = document.getElementById('filter-sort');
const filterGeo = document.getElementById('filter-geo');
const filterToken = document.getElementById('filter-token');

// --- 3. SEARCH AND FILTERING LOGIC ---

/**
 * Performs the core search and filtering operation against Firestore.
 */
async function executeSearchQuery(searchTerm, filters) {
    // 1. Base Query: Only show 'Approved' posts
    let q = query(collection(db, "kavithai"), where("status", "==", "Approved"));
    
    // 2. Apply Theme Filter
    if (filters.theme !== 'all') {
        q = query(q, where("tags", "array-contains", filters.theme));
    }
    
    // 3. Apply Geo Filter (Geo-Targeted Content)
    if (filters.geo !== 'global') {
        q = query(q, where("location", "==", filters.geo)); 
    }
    
    // 4. Apply Token Filter (Token Gated Content)
    if (filters.token === 'gated') {
        q = query(q, where("isTokenGated", "==", true));
    } else if (filters.token === 'unlocked') {
        window.showToastNotification("டோக்கன் திறக்கப்பட்டவை வடிகட்டலை செயல்படுத்த Web3 லாஜிக் தேவை.", 'warning');
        return [];
    }
    
    // 5. Apply Search Term (Basic prefix search on title - requires index creation in Firestore)
    if (searchTerm) {
        // NOTE: Full-text search requires Algolia or Firebase Extensions. 
        // We simulate a basic prefix search on the title field.
        q = query(
            q, 
            orderBy("title"), 
            startAt(searchTerm), 
            endAt(searchTerm + '\uf8ff')
        );
        window.showToastNotification("முழு உரைத் தேடலுக்குப் பதிலாக தலைப்புப் பொருத்தத்தை சரிபார்க்கிறது.", 'info');
    }
    
    // 6. Apply Sorting (Advanced Dynamic Filtering)
    const [field, direction] = filters.sort.split('-'); 

    if (field === 'date') {
        q = query(q, orderBy("timestamp", direction));
    } else if (field === 'views') {
        q = query(q, orderBy("views", direction));
    } else if (field === 'rating') {
        // Requires 'averageRating' field on the document
        q = query(q, orderBy("averageRating", direction));
    } else if (field === 'author') {
         // Sort by author name
        q = query(q, orderBy("authorName", direction)); 
    }
    
    // Limit results for efficiency
    q = query(q, limit(50));

    try {
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Firestore Search Query Failed:", error);
        window.showToastNotification("தேடல் வினவலில் பிழை ஏற்பட்டது. (Firestore Rules/Index-ஐ சரிபார்க்கவும்)", 'error');
        return [];
    }
}

/**
 * Renders the search results to the UI.
 */
function renderResults(poems) {
    poemResultsList.innerHTML = '';
    resultsCountDisplay.textContent = `தேடல் முடிவுகள்: ${poems.length} கவிதைகள்`;
    
    if (poems.length === 0) {
        poemResultsList.innerHTML = '<p style="text-align:center; padding: 20px;">உங்கள் தேடலுக்குப் பொருத்தமான கவிதைகள் எதுவும் இல்லை.</p>';
        return;
    }

    poems.forEach(poem => {
        const card = document.createElement('div');
        // Use Netlify redirects: /poem_view?id=...
        card.className = 'poem-card';
        card.setAttribute('onclick', `window.location.href='poem_view?id=${poem.id}'`);

        const tags = poem.tags ? poem.tags.map(tag => `#${tag}`).join(' ') : '';
        const views = poem.views || 0;
        const rating = (poem.averageRating || 0).toFixed(1);
        
        card.innerHTML = `
            <h3>${poem.title}</h3>
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
 * Collects filters and initiates the search.
 */
window.performSearch = async function() {
    // Show loading indicator
    poemResultsList.innerHTML = '<p style="text-align:center; padding: 20px;"><i class="fas fa-spinner fa-spin"></i> கவிதைகளைத் தேடுகிறது...</p>';
    resultsCountDisplay.textContent = `தேடல் முடிவுகள்: ஏற்றுகிறது...`;
    
    const searchTerm = searchInput.value.trim().toLowerCase();
    
    // Collect all filter values
    const filters = {
        theme: filterTheme.value,
        sort: filterSort.value,
        geo: filterGeo.value,
        token: filterToken.value
    };
    
    const results = await executeSearchQuery(searchTerm, filters);
    renderResults(results);
}

/**
 * Handles filter change (Advanced Dynamic Filtering).
 */
window.applyFilters = function() {
    window.performSearch(); // Re-runs the search with current filters
}

/**
 * Resets all filters and performs a fresh search.
 */
window.resetFilters = function() {
    searchInput.value = '';
    filterTheme.value = 'all';
    filterSort.value = 'date-desc';
    filterGeo.value = 'global';
    filterToken.value = 'none';
    window.performSearch();
}

// --- 4. INITIALIZATION ---

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initial Load: Show recent/trending posts on page load 
    // Wait for auth to ensure user preferences could be loaded later for personalization
    auth.onAuthStateChanged((user) => {
        window.performSearch();
    });
    
    // 2. Keyboard Shortcut 
    document.addEventListener('keydown', (e) => {
        if (e.key === '/') { 
            e.preventDefault();
            searchInput.focus();
        }
    });
});
