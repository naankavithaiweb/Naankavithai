/*
 * File: gamification.js
 * Description: Core logic for Author Badges, Achievement System, and Leaderboard tracking.
 * Integrates: Firestore for updating user status based on performance/milestones.
 * FIX: Added Achievements for Gamified Review System.
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


// --- 2. ACHIEVEMENT CONFIGURATION ---

// Define different tiers and their requirements (KEEPING ORIGINAL)
const BADGE_TIERS = {
    BRONZE_POET: { minPosts: 10, minViews: 1000, title: "Bronze Poet", icon: "fas fa-medal", color: "#cd7f32" },
    SILVER_POET: { minPosts: 50, minViews: 50000, title: "Silver Poet", icon: "fas fa-star-half-alt", color: "#c0c0c0" },
    GOLD_POET: { minPosts: 100, minViews: 500000, title: "Gold Poet", icon: "fas fa-crown", color: "#ffd700" },
};

// Define specific milestone achievements
const ACHIEVEMENTS = [
    { id: "FIRST_POST", condition: user => user.postCount >= 1, name: "முதல் கவிதை", description: "வெற்றிகரமாக ஒரு கவிதையைப் பதிவிட்டவர்", points: 50 },
    { id: "HUNDRED_LIKES", condition: user => user.totalLikes >= 100, name: "நூறு இதயங்கள்", description: "மொத்தம் 100 லைக்குகள் பெற்றவர்", points: 150 },
    { id: "FIVE_REFERRALS", condition: user => user.referralCount >= 5, name: "பரிந்துரை தலைவர்", description: "5 புதிய பயனர்களைப் பரிந்துரைத்தவர்", points: 200 },
    // FIX: New Achievement for Gamified Review System
    { id: "CRITIC_I", condition: user => user.commentCount >= 25, name: "விமர்சகர் I", description: "25 மதிப்புமிக்க கருத்துகளைப் பதிவிட்டவர்", points: 75 },
    { id: "CRITIC_II", condition: user => user.commentCount >= 100, name: "விமர்சகர் II", description: "100 மதிப்புமிக்க கருத்துகளைப் பதிவிட்டவர்", points: 300 }
];


// --- 3. CORE GAMIFICATION LOGIC ---

/**
 * Checks user stats against defined BADGE_TIERS and updates the badge/status. (KEEPING ORIGINAL)
 */
window.updateAuthorStatus = async function(userData) {
    if (!userData || !auth.currentUser) return;
    
    let newStatus = "New Poet";
    let newBadge = null;

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
    
    if (userData.authorStatus !== newStatus) {
        await updateDoc(doc(db, "users", auth.currentUser.uid), {
            authorStatus: newStatus,
            currentBadge: newBadge 
        });
        window.showToastNotification(`🏆 வாழ்த்துக்கள்! நீங்கள் இப்போது ஒரு ${newStatus}!`, 'success');
    }
}

/**
 * Checks for new Achievements and grants points (Achievement System). (KEEPING ORIGINAL)
 */
window.checkForNewAchievements = async function(userData) {
    if (!userData || !auth.currentUser) return;
    
    const earnedAchievements = userData.earnedAchievements || {};
    let totalPointsGained = 0;

    for (const achievement of ACHIEVEMENTS) {
        if (!earnedAchievements[achievement.id] && achievement.condition(userData)) {
            
            const updateData = {
                [`earnedAchievements.${achievement.id}`]: serverTimestamp(),
                totalPoints: increment(achievement.points), 
            };
            
            await updateDoc(doc(db, "users", auth.currentUser.uid), updateData);
            
            totalPointsGained += achievement.points;
            
            window.showToastNotification(`🎉 சாதனை திறக்கப்பட்டது: ${achievement.name} (+${achievement.points} புள்ளிகள்)!`, 'success');
        }
    }
}

/**
 * Calculates and updates the user's Leaderboard Score (KEEPING ORIGINAL)
 */
async function calculateLeaderboardScore(userData) {
    if (!userData || !userData.uid) return;
    
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

// --- 4. NEW UTILITY FOR COMMENT COUNT UPDATE (6. சமூகம் & தொடர்பு) ---

/**
 * FIX: Increments the user's total comment count after a comment is posted (Used by comments.js).
 */
window.incrementCommentCount = async function(userId) {
    if (!userId) return;
    try {
        const userRef = doc(db, "users", userId);
        await updateDoc(userRef, {
            commentCount: increment(1)
        });
        
        // After incrementing, check for new achievements related to comments
        const docSnap = await getDoc(userRef);
        if (docSnap.exists()) {
            await checkForNewAchievements(docSnap.data());
        }
    } catch (error) {
        console.error("Failed to increment comment count:", error);
    }
}


// --- 5. LEADERBOARD DISPLAY & INITIALIZATION (KEEPING ORIGINAL) ---

/**
 * Loads the Top 10 authors for the Leaderboard display.
 */
window.displayAuthorLeaderboard = async function() {
    const leaderboardElement = document.getElementById('author-leaderboard-list'); 
    if (!leaderboardElement) return;
    
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


// --- 6. INITIALIZATION ---

document.addEventListener('DOMContentLoaded', () => {
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            const userRef = doc(db, "users", user.uid);
            const docSnap = await getDoc(userRef);
            const userData = docSnap.data();

            if (userData) {
                await window.checkLoginBonus(); 
                await window.updateAuthorStatus(userData); 
                await window.checkForNewAchievements(userData); 
                await calculateLeaderboardScore(userData); 
            }
        }
        
        if (window.location.pathname.includes('leaderboard.html')) {
            window.displayAuthorLeaderboard(); 
        }
    });
});

// Export functions needed elsewhere
export { updateAuthorStatus, checkForNewAchievements, checkLoginBonus, incrementCommentCount };
