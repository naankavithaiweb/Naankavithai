/*
 * File: chat.js
 * Description: Core logic for Private Author Messaging (Chat) and Real-time Typing Indicator.
 * Integrates: Firestore for real-time message listening and sending.
 * Purpose: Enables private communication between authors/users.
 * FIX: Uses Firestore listeners for real-time updates.
 */

// --- 1. FIREBASE IMPORTS ---
import { auth, db } from "./auth.js";
import { 
    collection, 
    query, 
    where, 
    orderBy, 
    addDoc, 
    serverTimestamp,
    onSnapshot, // Crucial for Real-time chat updates
    doc,
    updateDoc,
    getDoc,
    limit
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- 2. GLOBAL VARIABLES & STATE ---

let currentChatPartnerId = null; 
let unsubscribeMessages = null; // To stop the real-time listener when switching chats
let unsubscribeTyping = null; // To stop the typing listener

const messageInput = document.getElementById('message-input');
const messageArea = document.getElementById('message-area');
const typingIndicator = document.getElementById('typing-indicator');

// --- 3. CHAT MANAGEMENT ---

/**
 * URL-இல் இருந்து உரையாடல் கூட்டாளியின் ID-ஐப் பெறுகிறது.
 */
function getChatPartnerIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('uid'); 
}

/**
 * Loads the conversation history with a specific partner and sets up a real-time listener.
 * @param {string} partnerId - The user ID of the chat partner.
 */
window.loadChat = async function(partnerId) {
    const currentUser = auth.currentUser;
    if (!currentUser || !partnerId) return;

    // 1. Clean up previous listeners
    if (unsubscribeMessages) unsubscribeMessages();
    if (unsubscribeTyping) unsubscribeTyping();
    
    currentChatPartnerId = partnerId;
    messageArea.innerHTML = '<p style="text-align:center; color:#777; padding: 20px;"><i class="fas fa-spinner fa-spin"></i> செய்திகளை ஏற்றுகிறது...</p>'; 

    // Fetch partner name for header display
    const partnerDocSnap = await getDoc(doc(db, "users", partnerId));
    const partnerName = partnerDocSnap.exists() ? partnerDocSnap.data().displayName : `User ${partnerId.substring(0, 5)}`;
    document.getElementById('chat-partner-name').textContent = `${partnerName} உடன் உரையாடல்`; 

    // 2. Create a unique chat ID
    const chatId = currentUser.uid < partnerId 
                   ? `${currentUser.uid}_${partnerId}` 
                   : `${partnerId}_${currentUser.uid}`;
                   
    // 3. Query the 'messages' collection
    const messagesRef = collection(db, "messages");
    const q = query(
        messagesRef, 
        where("chatId", "==", chatId), 
        orderBy("timestamp", "desc"), // Fetching recent first
        limit(50) // Limit to 50 messages
    );

    // 4. Real-time Message Listener Setup
    unsubscribeMessages = onSnapshot(q, (snapshot) => {
        // Clear area only once if it's the first load
        if (messageArea.innerHTML.includes('spinner')) {
             messageArea.innerHTML = ''; 
        }

        snapshot.docChanges().reverse().forEach((change) => { // Reverse to display in correct order
            if (change.type === "added") {
                displayMessage(change.doc.data());
            }
            // Handling modifications (e.g., message edit/delete) can be added here
        });
        
        // Scroll to the bottom of the message area
        messageArea.scrollTop = messageArea.scrollHeight;
    });

    // 5. Setup Typing Listener
    setupTypingListener(partnerId);
}

/**
 * Handles sending a new message.
 */
window.sendMessage = async function() {
    const currentUser = auth.currentUser;
    const text = messageInput.value.trim();

    if (!currentUser || !currentChatPartnerId || !text) return;
    
    // Create the unique chat ID
    const chatId = currentUser.uid < currentChatPartnerId
                   ? `${currentUser.uid}_${currentChatPartnerId}`
                   : `${currentChatPartnerId}_${currentUser.uid}`;

    try {
        // Add message to 'messages' collection
        await addDoc(collection(db, "messages"), {
            chatId: chatId,
            senderId: currentUser.uid,
            receiverId: currentChatPartnerId,
            text: text,
            timestamp: serverTimestamp(),
            read: false
        });

        messageInput.value = ''; // Clear input field
        window.sendTypingIndicator(false); // Stop typing immediately

        // Optional: Update conversation list with last message (requires conversation doc)

    } catch (error) {
        console.error("Error sending message:", error);
        window.showToastNotification("செய்தி அனுப்புவதில் பிழை ஏற்பட்டது.", 'error');
    }
}

/**
 * Renders a single message in the chat window.
 */
function displayMessage(message) {
    const messageElement = document.createElement('div');
    messageElement.className = `message ${message.senderId === auth.currentUser.uid ? 'sent' : 'received'}`;
    messageElement.textContent = message.text;
    messageArea.appendChild(messageElement);
}

/**
 * Loads the user's conversation list for the sidebar. (Placeholder Logic)
 */
async function loadConversationList(userId) {
    const listElement = document.getElementById('conversations-list');
    if (!listElement) return;
    
    // NOTE: This should query a 'conversations' collection. Using mock data until that collection exists.
    listElement.innerHTML = `
        <div class="conversation-item active" onclick="loadChat('${auth.currentUser.uid === 'MOCK_USER_B_ID' ? 'MOCK_USER_C_ID' : 'MOCK_USER_B_ID'}')">
            <img class="conv-avatar" src="placeholder-avatar.png" alt="User B">
            <div class="conv-info"><strong>கவிஞர் டெஸ்ட் (MOCK)</strong><small>சமீபத்திய: டெஸ்ட் செய்தி</small></div>
        </div>
        <p style="padding: 15px; font-size: 0.9em; color:#777;">
            (உண்மையான உரையாடல்கள் Firestore 'conversations' Collection-இல் இருந்து ஏற்றப்படும்.)
        </p>
    `;
}

// --- 4. REAL-TIME TYPING INDICATOR ---

/**
 * Sends a typing status update to a dedicated Firestore path.
 */
window.sendTypingIndicator = function(isTyping = true) {
    const currentUser = auth.currentUser;
    if (!currentUser || !currentChatPartnerId) return;

    const partnerId = currentChatPartnerId;
    const typingDocId = currentUser.uid < partnerId 
                       ? `${currentUser.uid}_${partnerId}` 
                       : `${partnerId}_${currentUser.uid}`;
                       
    const typingRef = doc(db, "typing_status", typingDocId);

    // Update status for the sender
    updateDoc(typingRef, {
        [`isTyping_${currentUser.uid}`]: isTyping,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true }); // NOTE: This requires Firebase Admin SDK on the frontend for serverTimestamp

    // Set a timeout to automatically stop typing after 3 seconds of no activity
    if (isTyping) {
        clearTimeout(window.typingTimeout);
        window.typingTimeout = setTimeout(() => {
            window.sendTypingIndicator(false);
        }, 3000);
    }
}

/**
 * Sets up the listener to detect if the chat partner is typing.
 */
function setupTypingListener(partnerId) {
    const currentUserId = auth.currentUser.uid;
    const typingDocId = currentUserId < partnerId
                       ? `${currentUserId}_${partnerId}` 
                       : `${partnerId}_${currentUserId}`;
                       
    const typingRef = doc(db, "typing_status", typingDocId);

    unsubscribeTyping = onSnapshot(typingRef, (doc) => {
        const data = doc.data();
        if (!data) { typingIndicator.style.display = 'none'; return; }

        const partnerTypingField = `isTyping_${partnerId}`;
        const partnerIsTyping = data[partnerTypingField] === true;
        
        const lastUpdated = data.timestamp ? data.timestamp.toDate() : new Date(0);
        const isRecent = (new Date() - lastUpdated) < 5000; 

        if (partnerIsTyping && isRecent) {
            typingIndicator.style.display = 'block';
            // Use the name already loaded in the chat header
            const partnerName = document.getElementById('chat-partner-name').textContent.split(' உடன்')[0];
            document.getElementById('typing-status').textContent = `${partnerName} தட்டச்சு செய்கிறார்...`;
        } else {
            typingIndicator.style.display = 'none';
        }
    });
}

// --- 5. INITIALIZATION ---

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initial Auth Check and Chat Load
    auth.onAuthStateChanged((user) => {
        if (user) {
            const partnerId = getChatPartnerIdFromUrl();
            loadConversationList(user.uid); 
            
            if (partnerId) {
                window.loadChat(partnerId);
            } else if (window.location.pathname.includes('chat.html')) {
                window.showToastNotification("அரட்டை செய்ய ஒரு கூட்டாளரைத் தேர்ந்தெடுக்கவும்.", 'warning');
            }
        } else if (window.location.pathname.includes('chat.html')) {
            window.showToastNotification("அரட்டை செய்ய உள்நுழையவும்.", 'error');
            setTimeout(() => { window.location.href = 'index.html'; }, 1000);
        }
    });
    
    // Attach event listener for sending message on Enter key press
    if (messageInput) {
        messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                window.sendMessage();
            } else {
                // Send typing indicator on activity
                window.sendTypingIndicator(true); 
            }
        });
    }
});
