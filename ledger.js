/*
 * File: ledger.js
 * Description: Logic for Automated Tax/Compliance Ledger (User Earnings, Withdrawals, Token Transactions).
 * Integrates: Firestore to fetch financial and token transaction records.
 * Purpose: Provides transparency and compliance data to the user via tax_ledger.html.
 */

// --- 1. FIREBASE IMPORTS ---
import { auth, db } from "./auth.js";
import { 
    collection, 
    query, 
    where, 
    getDocs, 
    orderBy 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- 2. CORE LEDGER RETRIEVAL ---

/**
 * Loads the user's earning and withdrawal records.
 */
async function loadEarningsLedger() {
    const user = auth.currentUser;
    if (!user) return;
    
    // 1. Fetch Earnings/Withdrawal Records (Requires a 'finance_transactions' collection)
    const txRef = collection(db, "finance_transactions");
    const q = query(
        txRef, 
        where("userId", "==", user.uid), 
        orderBy("timestamp", "desc")
    );
    
    try {
        const querySnapshot = await getDocs(q);
        const records = querySnapshot.docs.map(doc => doc.data());
        
        const tableBody = document.getElementById('earnings-records');
        let totalEarnings = 0;
        let totalWithdrawal = 0;
        tableBody.innerHTML = '';

        if (records.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">வருமானப் பதிவுகள் எதுவும் இல்லை.</td></tr>';
            
        } else {
            records.forEach(record => {
                const date = record.timestamp ? new Date(record.timestamp.toDate()).toLocaleDateString('ta-IN') : 'N/A';
                const amount = parseFloat(record.amount || 0).toFixed(2);
                const type = record.type === 'earning' ? 'வருமானம்' : 'பணம் எடுப்பு';
                const status = record.status || 'முழுமை பெற்றது';
                
                if (record.type === 'earning') {
                    totalEarnings += parseFloat(record.amount);
                } else if (record.type === 'withdrawal' && status === 'முழுமை பெற்றது') {
                    totalWithdrawal += parseFloat(record.amount);
                }

                tableBody.innerHTML += `
                    <tr>
                        <td>${date}</td>
                        <td>${record.description || type}</td>
                        <td>${record.type === 'earning' ? '+' : '-'}${amount}</td>
                        <td>${status}</td>
                    </tr>
                `;
            });
        }
        
        // Update summary totals
        document.getElementById('total-earnings-display').textContent = `${totalEarnings.toFixed(2)} TK`;
        document.getElementById('total-withdrawal-display').textContent = `${totalWithdrawal.toFixed(2)} TK`;
        
    } catch (error) {
        console.error("Error loading earnings ledger:", error);
        window.showToastNotification("வருமானப் பதிவுகளை ஏற்ற முடியவில்லை. (அனுமதி சரிபார்க்கவும்)", 'error');
    }
}

/**
 * Loads the user's Web3 token transaction records.
 */
async function loadTokenLedger() {
    const user = auth.currentUser;
    if (!user) return;
    
    // 2. Fetch Token Transaction Records (Requires a 'token_transactions' collection)
    const txRef = collection(db, "token_transactions");
    const q = query(
        txRef, 
        where("userId", "==", user.uid), 
        orderBy("timestamp", "desc")
    );
    
    try {
        const querySnapshot = await getDocs(q);
        const records = querySnapshot.docs.map(doc => doc.data());
        
        const tableBody = document.getElementById('token-records');
        tableBody.innerHTML = '';

        if (records.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">டோக்கன் பதிவுகள் எதுவும் இல்லை.</td></tr>';
        } else {
             records.forEach(record => {
                const date = record.timestamp ? new Date(record.timestamp.toDate()).toLocaleDateString('ta-IN') : 'N/A';
                const hashShort = record.transactionHash ? `${record.transactionHash.substring(0, 6)}...` : 'N/A';
                
                tableBody.innerHTML += `
                    <tr>
                        <td>${date}</td>
                        <td>${record.type || 'Transfer'}</td>
                        <td>${record.direction === 'in' ? '+' : '-'}${record.tokenAmount || 0} NKT</td>
                        <td>${hashShort}</td>
                    </tr>
                `;
            });
        }
        
    } catch (error) {
        console.error("Error loading token ledger:", error);
        window.showToastNotification("டோக்கன் பதிவுகளை ஏற்ற முடியவில்லை. (அனுமதி சரிபார்க்கவும்)", 'error');
    }
}

// --- 3. EXPORT TO CSV (FOR COMPLIANCE) ---

/**
 * Downloads the financial or token ledger as a CSV file.
 */
window.downloadLedger = async function(ledgerType) {
    if (!auth.currentUser) {
        window.showToastNotification("பதிவிறக்க உள்நுழையவும்.", 'error');
        return;
    }
    
    window.showToastNotification(`${ledgerType} பதிவுகள் CSV ஆக பதிவிறக்கம் செய்யப்படுகின்றன...`, 'info');
    
    // MOCK CSV GENERATION: In a real app, this logic would generate the CSV from data.
    const filename = `${ledgerType}_ledger_${auth.currentUser.uid.substring(0, 6)}_${new Date().getFullYear()}.csv`;
    
    // Create a mock download link to simulate the action
    const mockLink = document.createElement('a');
    mockLink.setAttribute('href', 'data:text/csv;charset=utf-8,Mock_Data,Download_Successful'); 
    mockLink.setAttribute('download', filename);
    document.body.appendChild(mockLink); // Append to body to make it clickable
    mockLink.click();
    document.body.removeChild(mockLink); // Remove after click
}


// --- 4. INITIALIZATION ---

document.addEventListener('DOMContentLoaded', () => {
    // Only run if on the ledger page
    if (window.location.pathname.includes('tax_ledger.html')) {
        auth.onAuthStateChanged((user) => {
            if (user) {
                loadEarningsLedger();
                loadTokenLedger();
            } else {
                window.showToastNotification("பதிவேடுகளைப் பார்க்க உள்நுழையவும்.", 'error');
            }
        });
    }
});
