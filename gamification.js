/*
 * File: gamification.js
 * Description: Core logic for Author Badges, Achievement System, and Leaderboard tracking.
 * Integrates: Firestore for updating user status based on performance/milestones.
 * Purpose: Motivates users and enhances engagement through rewards and recognition.
 */

// --- 1. FIREBASE IMPORTS ---
import { auth, db } from "./auth.js";
import { 
    doc, 
    updateDoc, 
    getDocs, 
    collection, 
    query, 
    orderBy, 
    limit, 
    where,
    getDoc,
    increment,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
// NOTE: We rely on the exported loadAuthorLeaderboard function from community.js if needed.


// --- 2. ACHIEVEMENT CONFIGURATION ---

// Define different tiers and their requirements
const BADGE_TIERS = {
    BRONZE_POET: { minPosts: 10, minViews: 1000, title: "Bronze Poet", icon: "fas fa-medal", color: "#cd7f32" },
    SILVER_POET: { minPosts: 50, minViews: 50000, title: "Silver Poet", icon: "fas fa-star-half-alt", color: "#c0c0c0" },
    GOLD_POET: { minPosts: 100, minViews: 500000, title: "Gold Poet", icon: "fas fa-crown", color: "#ffd700" },
};

// Define specific milestone achievements
const ACHIEVEMENTS = [
    { id: "FIRST_POST", condition: user => user.postCount >= 1, name: "முதல் கவிதை", description: "வெற்றிகரமாக ஒரு கவிதையைப் பதிவிட்டவர்", points: 50 },
    { id: "HUNDRED_LIKES", condition: user => user.totalLikes >= 100, name: "நூறு இதயங்கள்", description: "மொத்தம் 100 லைக்குகள் பெற்றவர்", points: 150 },
    { id: "FIVE_REFERRALS", condition: user => user.referralCount >= 5, name: "பரிந்துரை தலைவர்", description: "5 புதிய பயனர்களைப் பரிந்துரைத்தவர்", points: 200 }
];


// --- 3. CORE GAMIFICATION LOGIC (7. Gamification & Status) ---

/**
 * Checks user stats against defined BADGE_TIERS and updates the badge/status.
 * @param {object} userData - Current user data from Firestore.
 */
window.updateAuthorStatus = async function(userData) {
    if (!userData || !auth.currentUser) return;
    
    let newStatus = "New Poet";
    let newBadge = null;

    // Determine the highest achieved badge tier
    if (userData.postCount >= BADGE_TIERS.GOLD_POET.minPosts && userData.totalViews >= BADGE_TIERS.GOLD_POET.minViews) {
        newStatus = BADGE_TIERS.GOLD_POET.title;
        newBadge = 'GOLD';
    } else if (userData.postCount >= BADGE_TIERS.SILVER_POET.minPosts && userData.totalViews >= BADGE_TIERS.SILVER_POET.minViews) {
        newStatus = BADGE_TIERS.SILVER_POET.title;
        newBadge = 'SILVER';
    } else if (userData.postCount >= BADGE_TIERS.BRONZE_POET.minPosts && userData.totalViews >= BADGE_TIERS.BRONZE_POET.minViews) {
        newStatus = BADGE_TIERS.BRONZE_POET.title;
        newBadge = 'BRONZE';
    }
    
    // Update Firestore only if the status has changed
    if (userData.authorStatus !== newStatus) {
        await updateDoc(doc(db, "users", auth.currentUser.uid), {
            authorStatus: newStatus,
            currentBadge: newBadge 
        });
        window.showToastNotification(`🏆 வாழ்த்துக்கள்! நீங்கள் இப்போது ஒரு ${newStatus}!`, 'success');
    }
}

/**
 * Checks for new Achievements and grants points (Achievement System).
 * @param {object} userData - Current user data from Firestore.
 */
window.checkForNewAchievements = async function(userData) {
    if (!userData || !auth.currentUser) return;
    
    const earnedAchievements = userData.earnedAchievements || {};
    let totalPointsGained = 0;

    for (const achievement of ACHIEVEMENTS) {
        // Check if the achievement is not yet earned AND the condition is met
        if (!earnedAchievements[achievement.id] && achievement.condition(userData)) {
            
            // 1. Mark as earned in the user profile
            const updateData = {
                [`earnedAchievements.${achievement.id}`]: serverTimestamp(),
                totalPoints: increment(achievement.points), // Add points
            };
            
            await updateDoc(doc(db, "users", auth.currentUser.uid), updateData);
            
            totalPointsGained += achievement.points;
            
            window.showToastNotification(`🎉 சாதனை திறக்கப்பட்டது: ${achievement.name} (+${achievement.points} புள்ளிகள்)!`, 'success');
        }
    }
}

/**
 * Calculates and updates the user's Leaderboard Score (Placeholder).
 * This function should ideally run via a secure backend function to prevent cheating.
 */
async function calculateLeaderboardScore(userData) {
    if (!userData || !userData.uid) return;
    
    // Scoring logic: Score = (Views * 0.1) + (Likes * 0.5) + (Post Count * 5) + (Token Balance * 1)
    
    const score = (userData.totalViews * 0.1 || 0) + 
                  (userData.totalLikes * 0.5 || 0) + 
                  (userData.postCount * 5 || 0) + 
                  (userData.tokens * 1 || 0);
    
    await updateDoc(doc(db, "users", userData.uid), {
        leaderboardScore: score,
        lastScoreUpdate: serverTimestamp()
    });
    return score;
}

// --- 4. LEADERBOARD DISPLAY ---

/**
 * Loads the Top 10 authors for the Leaderboard display.
 */
window.displayAuthorLeaderboard = async function() {
    const leaderboardElement = document.getElementById('author-leaderboard-list'); 
    if (!leaderboardElement) return;
    
    // Query users collection, ordered by the calculated score
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("role", "!=", "admin"), orderBy("leaderboardScore", "desc"), limit(10));
    const querySnapshot = await getDocs(q);
    
    leaderboardElement.innerHTML = '';
    
    if (querySnapshot.empty) {
        leaderboardElement.innerHTML = '<p style="text-align:center;">லீடர்போர்டில் தரவு இல்லை.</p>';
        return;
    }

    let rank = 1;
    querySnapshot.forEach(userDoc => {
        const user = userDoc.data();
        const score = Math.round(user.leaderboardScore || 0);
        
        // Determine badge configuration
        let badgeConfig = { title: user.authorStatus || 'New Poet', icon: 'fas fa-user', color: '#ccc' };
        if (user.currentBadge === 'GOLD') badgeConfig = BADGE_TIERS.GOLD_POET;
        else if (user.currentBadge === 'SILVER') badgeConfig = BADGE_TIERS.SILVER_POET;
        else if (user.currentBadge === 'BRONZE') badgeConfig = BADGE_TIERS.BRONZE_POET;
        
        const item = document.createElement('li');
        item.innerHTML = `
            <span class="rank">#${rank++}</span>
            <div class="author-info">
                <strong>${user.displayName || user.email}</strong>
                <small style="color:${badgeConfig.color}; font-weight:bold;">${badgeConfig.title}</small>
            </div>
            <span class="score">Score: ${score.toLocaleString()}</span>
        `;
        leaderboardElement.appendChild(item);
    });
}

/**
 * Placeholder: Daily/Weekly Login Bonus system.
 */
window.checkLoginBonus = async function() {
    const user = auth.currentUser;
    if (!user) return;

    const userRef = doc(db, "users", user.uid);
    const docSnap = await getDoc(userRef);
    const userData = docSnap.data();
    
    const lastBonusClaim = userData?.lastBonusClaim?.toDate();
    const now = new Date();
    
    // Check if 24 hours passed since last bonus
    const isBonusDue = !lastBonusClaim || (now - lastBonusClaim) > (24 * 60 * 60 * 1000); 

    if (isBonusDue) {
        const bonusPoints = 10;
        await updateDoc(userRef, {
            totalPoints: increment(bonusPoints),
            lastBonusClaim: serverTimestamp()
        });
        window.showToastNotification(`💰 தினசரி உள்நுழைவு போனஸ்: ${bonusPoints} புள்ளிகள் பெற்றீர்கள்!`, 'info');
    }
}


// --- 5. INITIALIZATION ---

document.addEventListener('DOMContentLoaded', () => {
    // Only run main checks if user is logged in
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            const userRef = doc(db, "users", user.uid);
            const docSnap = await getDoc(userRef);
            const userData = docSnap.data();

            if (userData) {
                // Run core checks periodically or on login
                await window.checkLoginBonus(); // Check for login bonus
                await window.updateAuthorStatus(userData); // Check status/badges
                await window.checkForNewAchievements(userData); // Check achievements
                await calculateLeaderboardScore(userData); // Update score
            }
        }
        
        // If on the leaderboard page, display the data
        if (window.location.pathname.includes('leaderboard.html')) {
            window.displayAuthorLeaderboard(); 
        }
    });
});

// Export functions needed elsewhere
export { updateAuthorStatus, checkForNewAchievements, checkLoginBonus };
