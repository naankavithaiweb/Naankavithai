/*
 * File: web3_wallet.js
 * Description: Handles External Wallet Login (Web3) and Token Gated Content logic.
 * Integrates: Checks for Web3 provider (Metamask) and manages connection/disconnection.
 * Purpose: Allows users to interact with DeFi features using their external crypto wallets.
 */

// --- 1. FIREBASE IMPORTS ---
import { auth, db } from "./auth.js";
import { 
    doc, 
    updateDoc, 
    getDoc, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- 2. GLOBAL ELEMENTS ---
const walletStatus = document.getElementById('wallet-status');
const walletAddressDisplay = document.getElementById('wallet-address');
const connectBtn = document.getElementById('connect-wallet-btn');
const disconnectBtn = document.getElementById('disconnect-wallet-btn');

let currentWalletAddress = null;
const MOCK_NKT_BALANCE = 350; // MOCK BALANCE for testing Token Gating

/**
 * Checks if a Web3 provider (e.g., Metamask) is available.
 * @returns {boolean}
 */
function isWeb3Available() {
    return typeof window.ethereum !== 'undefined';
}

/**
 * Updates the UI based on wallet connection status.
 */
function updateWalletUI(address) {
    if (address) {
        currentWalletAddress = address;
        walletStatus.textContent = '✅ வாலட் வெற்றிகரமாக இணைக்கப்பட்டுள்ளது';
        walletAddressDisplay.textContent = `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
        walletStatus.style.color = '#2ecc71';
        connectBtn.style.display = 'none';
        disconnectBtn.style.display = 'block';
    } else {
        currentWalletAddress = null;
        walletStatus.textContent = 'வாலட் இணைக்கப்படவில்லை.';
        walletAddressDisplay.textContent = 'N/A';
        walletStatus.style.color = '#e74c3c';
        connectBtn.style.display = 'block';
        disconnectBtn.style.display = 'none';
    }
}

// --- 3. CORE WALLET FUNCTIONS (4. பணமாக்குதல் & DeFi) ---

/**
 * Handles the External Wallet Connection process.
 */
window.connectExternalWallet = async function() {
    if (!isWeb3Available()) {
        window.showToastNotification("Web3 வழங்குநர் (எ.கா. Metamask) கிடைக்கவில்லை. அதை நிறுவவும்.", 'error');
        return;
    }
    
    if (!auth.currentUser) {
        window.showToastNotification("வாலட்டை இணைக்க, நீங்கள் நான் கவிதை தளத்தில் உள்நுழைய வேண்டும்.", 'warning');
        return;
    }

    try {
        walletStatus.textContent = 'வாலட் அணுகலுக்காகக் காத்திருக்கிறது...';
        // Request account access (Ethers.js/Web3.js not strictly required for this front-end request)
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        const selectedAddress = accounts[0];

        // 1. Update UI
        updateWalletUI(selectedAddress);

        // 2. Bind wallet address to Firebase user profile 
        const userRef = doc(db, "users", auth.currentUser.uid);
        await updateDoc(userRef, {
            web3WalletAddress: selectedAddress,
            walletConnected: serverTimestamp()
        });
        
        window.showToastNotification("வாலட் வெற்றிகரமாக இணைக்கப்பட்டது!", 'success');
        
        // 3. Trigger check for token-gated content unlocks
        checkTokenGatedAccess(selectedAddress);

    } catch (error) {
        console.error("Wallet connection failed:", error);
        window.showToastNotification("வாலட் இணைப்பை பயனர் நிராகரித்துவிட்டார் அல்லது பிழை ஏற்பட்டது.", 'error');
        updateWalletUI(null);
    }
}

/**
 * Handles wallet disconnection.
 */
window.disconnectExternalWallet = async function() {
    if (!auth.currentUser) return;

    try {
        // 1. Remove binding from Firebase user profile
        const userRef = doc(db, "users", auth.currentUser.uid);
        await updateDoc(userRef, {
            web3WalletAddress: null
        });

        // 2. Update UI
        updateWalletUI(null);
        window.showToastNotification("வாலட் துண்டிக்கப்பட்டது.", 'info');

        // 3. Re-lock all token-gated content
        checkTokenGatedAccess(null); 

    } catch (error) {
        console.error("Wallet disconnection failed:", error);
        window.showToastNotification("துண்டிப்பில் பிழை ஏற்பட்டது.", 'error');
    }
}

// --- 4. DEFI & TOKEN GATED CONTENT ---

/**
 * Checks user's NKT balance (MOCK) and updates Token Gated Content status.
 * @param {string} walletAddress - The connected Web3 address.
 */
async function checkTokenGatedAccess(walletAddress) {
    if (!walletAddress) {
        // Reset status if disconnected
        document.getElementById('content-status-1').textContent = "பூட்டப்பட்டுள்ளது";
        document.getElementById('content-status-2').textContent = "பூட்டப்பட்டுள்ளது";
        document.getElementById('content-status-1').style.color = '#e74c3c';
        document.getElementById('content-status-2').style.color = '#e74c3c';
        return;
    }
    
    // 1. Placeholder for Smart Contract Interaction 
    // In a final app, Ethers.js would be used to fetch the real balance (NKT Token Contract).
    console.log(`Checking MOCK NKT balance for address: ${walletAddress}`);
    
    const balance = MOCK_NKT_BALANCE; // Use mock balance

    // 2. Check Tiers and update UI elements
    const tiers = [
        { id: 'content-status-1', required: 100 },
        { id: 'content-status-2', required: 500 }
    ];
    
    tiers.forEach(tier => {
        const statusElement = document.getElementById(tier.id);
        if (!statusElement) return;

        if (balance >= tier.required) {
            statusElement.textContent = "திறக்கப்பட்டுள்ளது";
            statusElement.style.color = '#2ecc71';
        } else {
            statusElement.textContent = `பூட்டப்பட்டுள்ளது (தேவை: ${tier.required} NKT - தற்போதைய இருப்பு: ${balance})`;
            statusElement.style.color = '#e74c3c';
        }
    });

    window.showToastNotification(`உங்கள் NKT இருப்பு: ${balance}. டோக்கன் அனுமதிச் சரிபார்ப்பு முடிந்தது.`, 'info');
}

/**
 * Placeholder: Check Decentralized Escrow Status.
 */
window.checkEscrowStatus = function() {
    window.showToastNotification("எஸ்க்ரோ நிலையை பிளாக்செயினில் சரிபார்க்கிறது... (Web3 லாஜிக் தேவை)", 'warning');
}

// --- 5. INITIALIZATION & WALLET LISTENER ---

document.addEventListener('DOMContentLoaded', () => {
    // Check for existing connection when the page loads
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            try {
                const userRef = doc(db, "users", user.uid);
                const docSnap = await getDoc(userRef);
                const web3Address = docSnap.data()?.web3WalletAddress;
                
                if (web3Address) {
                    updateWalletUI(web3Address);
                    checkTokenGatedAccess(web3Address);
                } else {
                    updateWalletUI(null);
                    checkTokenGatedAccess(null); // Reset content status
                }
            } catch (e) {
                console.error("Error fetching web3 address from Firestore:", e);
                updateWalletUI(null);
            }
        } else if (window.location.pathname.includes('web3.html')) {
             updateWalletUI(null);
        }
    });

    // Web3 Listener: Handles account changes if the provider is available
    if (isWeb3Available()) {
        window.ethereum.on('accountsChanged', (accounts) => {
            const newAddress = accounts[0] || null;
            if (newAddress) {
                // User switched accounts via Metamask
                updateWalletUI(newAddress);
                checkTokenGatedAccess(newAddress);
            } else {
                // User disconnected from Metamask side
                window.disconnectExternalWallet(); 
            }
        });
    }
});
