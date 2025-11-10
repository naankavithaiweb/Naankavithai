/*
 * File: analytics.js
 * Description: Handles data retrieval and processing for the Admin Dashboard Analytics section.
 * Integrates: Firestore to fetch user metrics, content performance, and system status (mock).
 * Purpose: Provides data-driven insights to the owner/admin.
 */

// --- 1. FIREBASE IMPORTS ---
import { auth, db } from "./auth.js";
import { 
    collection, 
    query, 
    getDocs, 
    where, 
    limit, 
    orderBy,
    doc,
    getDoc,
    serverTimestamp // Needed for system health mock updates
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- 2. GLOBAL ELEMENTS ---
const systemHealthElement = document.getElementById('system-health-status');
const userMetricsElement = document.getElementById('user-metrics-data');
const contentMetricsElement = document.getElementById('content-metrics-data');
const churnPredictionElement = document.getElementById('churn-prediction-data');


// --- 3. ATOMIC USER DETAILS & METRICS ---

/**
 * Loads and processes key user metrics (Atomic User Details, Login/Creation data).
 */
window.loadUserMetrics = async function() {
    if (!auth.currentUser || !userMetricsElement) return; 

    const usersRef = collection(db, "users");
    const snapshot = await getDocs(usersRef);
    const totalUsers = snapshot.size;
    let premiumUsers = 0;
    
    // Calculate metrics
    snapshot.forEach(doc => {
        const user = doc.data();
        if (user.subscriptionTier === 'Premium' || user.subscriptionTier === 'Ultimate') {
            premiumUsers++;
        }
        // NOTE: Active users calculation is complex and requires a dedicated backend service.
    });

    const metricsHTML = `
        <p><strong>மொத்த பயனர்கள்:</strong> ${totalUsers.toLocaleString()}</p>
        <p><strong>பிரீமியம் சந்தாதாரர்கள்:</strong> ${premiumUsers}</p>
        <p><strong>இன்று செயலில் உள்ளோர்:</strong> N/A</p>
        <p><strong>சராசரி உள்நுழைவு அதிர்வெண்:</strong> N/A</p>
    `;
    userMetricsElement.innerHTML = metricsHTML;
}

/**
 * Placeholder: Predictive User Churn (Now shows 'Loading').
 */
window.getPredictiveChurnData = async function() {
    if (!churnPredictionElement) return;

    churnPredictionElement.innerHTML = `
        <h4>கணக்கு மூடல் முன்னறிவிப்பு</h4>
        <p style="color:#f39c12;"><i class="fas fa-spinner fa-spin"></i> முன்னறிவிப்பு தரவு ஏற்றப்படுகிறது...</p>
        <p style="font-size:0.9em; color:#777;">(இந்த அம்சம் செயல்பட Machine Learning பின்தளம் அவசியம்.)</p>
    `;
    // In a final app, an authenticated call to Netlify Function/Cloud Function would happen here.
}


// --- 4. CONTENT PERFORMANCE ---

/**
 * Calculates and displays content performance scores.
 */
window.loadContentMetrics = async function() {
    if (!auth.currentUser || !contentMetricsElement) return; 

    const postsRef = collection(db, "kavithai");
    // Get top 50 posts to calculate total views/top score
    const q = query(postsRef, where("status", "==", "Approved"), orderBy("views", "desc"), limit(50));
    const snapshot = await getDocs(q);
    
    let totalViews = 0;
    let totalPosts = snapshot.size;
    let topPostTitle = "தரவு இல்லை";
    let topPostScore = 0;

    snapshot.forEach(doc => {
        const post = doc.data();
        totalViews += post.views || 0;
        
        // Content Performance Score Logic (Views * Rating / Time)
        // Using a basic score calculation for display
        const score = (post.views || 1) * (post.averageRating || 3) / 100;
        if (score > topPostScore) {
            topPostScore = score;
            topPostTitle = post.title;
        }
    });

    const metricsHTML = `
        <p><strong>மொத்த கவிதைப் பார்வைகள்:</strong> ${totalViews.toLocaleString()}</p>
        <p><strong>மொத்த இடுகைகள்:</strong> ${totalPosts}</p>
        <p><strong>சிறந்த செயல்திறன் கவிதை:</strong> ${topPostTitle} (Score: ${topPostScore.toFixed(2)})</p>
    `;
    contentMetricsElement.innerHTML = metricsHTML;
}


// --- 5. SYSTEM HEALTH & DATA ---

/**
 * Placeholder: System Health Monitor & Real-time Users (MOCK).
 * This data is often pulled from a monitoring service (e.g., Uptime Robot or Cloud Monitoring).
 */
window.checkSystemHealth = function() {
    if (!systemHealthElement) return;
    
    // MOCK DATA for real-time users and health status
    const realtimeUsers = Math.floor(Math.random() * 50) + 10;
    const healthStatus = 'Optimal';
    const statusColor = '#2ecc71';
    
    const healthHTML = `
        <p><strong>சர்வர் நிலை:</strong> <span style="color:${statusColor}; font-weight:bold;">${healthStatus}</span></p>
        <p><strong>Firestore Latency:</strong> 150ms (Mock)</p>
        <p><strong>Cloudinary Storage:</strong> 78% Used (Mock)</p>
    `;
    
    systemHealthElement.innerHTML = healthHTML;
    const realtimeEl = document.getElementById('realtime-users');
    if (realtimeEl) realtimeEl.textContent = realtimeUsers;
}

/**
 * Placeholder: Tracking traffic source (URL Parameters)
 */
window.trackTrafficSource = function() {
    const urlParams = new URLSearchParams(window.location.search);
    const source = urlParams.get('utm_source') || 'Direct';
    const campaign = urlParams.get('utm_campaign') || 'N/A';
    
    console.log(`Traffic Source: ${source}, Campaign: ${campaign}`);
}


// --- 6. INITIALIZATION ---

document.addEventListener('DOMContentLoaded', () => {
    // Ensure this runs only if the user is authorized as admin (logic relies on an admin check)
    auth.onAuthStateChanged(async (user) => {
        if (user) { 
             const userDocSnap = await getDoc(doc(db, "users", user.uid));
             const userData = userDocSnap.data();

             // Only load data if the user is the owner or an admin
             if (userData?.role === 'admin' || user.email === 'naankavithaiweb@gmail.com') {
                window.loadUserMetrics();
                window.loadContentMetrics();
                window.checkSystemHealth();
                window.getPredictiveChurnData(); // Placeholder for ML
                window.trackTrafficSource(); // Run tracking logic
             }
        }
    });
});

export { loadUserMetrics, loadContentMetrics, checkSystemHealth, trackTrafficSource };
