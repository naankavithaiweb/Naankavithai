/*
 * File: script.js
 * Description: நான் கவிதை தளத்திற்கான பொதுவான JavaScript லாஜிக்.
 * Includes: Global UI functions, User Settings, Theme Management, and Content Protection.
 * Purpose: Provides consistent functionality and accessibility settings across all HTML pages.
 */

// --- 1. FIREBASE IMPORTS ---
// We import 'auth' here just to ensure the script waits for the auth state if needed,
// but general initialization is handled in auth.js.
import { auth } from "./auth.js"; 

// --- 2. GLOBAL UI FUNCTIONS (5. தேடல், பார்வை & UX) ---

/**
 * 5. Stylish Toast Notifications (அழகான Toast அறிவிப்புகள்)
 * @param {string} message - The message to display.
 * @param {string} type - 'info', 'success', 'warning', or 'error'.
 */
window.showToastNotification = function(message, type = 'info') {
    const toastContainerId = 'toast-container';
    let container = document.getElementById(toastContainerId);
    
    if (!container) {
        container = document.createElement('div');
        container.id = toastContainerId;
        // Basic positioning (styles.css handles color/font)
        container.style.position = 'fixed';
        container.style.bottom = '20px';
        container.style.right = '20px';
        container.style.left = 'auto';
        container.style.zIndex = '9999';
        container.style.maxWidth = '300px';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.alignItems = 'flex-end';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    toast.textContent = message;
    
    // Inline styles for functionality (not aesthetics)
    toast.style.padding = '10px 15px';
    toast.style.margin = '5px 0';
    toast.style.borderRadius = '5px';
    toast.style.color = 'white';
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'opacity 0.4s ease-out, transform 0.4s ease-out';
    
    container.appendChild(toast);
    
    // Show the toast
    setTimeout(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(0)';
    }, 10);

    // Hide and remove after 4 seconds
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 500);
    }, 4000);
};

// --- 3. CUSTOMIZATION & ACCESSIBILITY (1. அடிப்படை & பயனர் கட்டுப்பாடு) ---

/**
 * Adaptive Theme based on Time (Auto Dark/Light)
 * Checks system preference and local storage for theme setting.
 */
function initializeTheme() {
    const savedTheme = localStorage.getItem('theme');
    // Check if the system prefers dark mode (used only if no preference is saved)
    const systemPrefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

    let initialTheme = 'light';
    if (savedTheme) {
        initialTheme = savedTheme;
    } else if (systemPrefersDark) {
        initialTheme = 'dark';
    }

    // Apply the initial theme
    if (initialTheme === 'dark') {
        document.body.classList.add('dark-mode');
    } else {
        document.body.classList.remove('dark-mode');
    }
}

/**
 * Toggles the Dark/Light theme manually (from User Settings)
 * This function is attached to the toggle button in settings.html
 */
window.toggleTheme = function() {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    
    // Update the checkbox state in settings.html if present
    const toggle = document.getElementById('theme-toggle');
    if (toggle) toggle.checked = isDark;
    
    window.showToastNotification(`வடிவமைப்பு மாற்றப்பட்டது: ${isDark ? 'இருள் முறை (Dark Mode)' : 'ஒளி முறை (Light Mode)'}`, 'info');
};

/**
 * Tamil Font Switcher & Font Size Control (தமிழ் எழுத்துரு மற்றும் அளவு கட்டுப்பாடு)
 * @param {number} delta - Change in font size (e.g., +1 or -1)
 */
window.changeFontSize = function(delta) {
    let currentSize = parseFloat(localStorage.getItem('fontSize') || 16); 
    let newSize = Math.max(14, Math.min(22, currentSize + delta)); // Limit size
    
    document.documentElement.style.fontSize = `${newSize}px`; 
    localStorage.setItem('fontSize', newSize);
    
    window.showToastNotification(`எழுத்து அளவு: ${newSize}px`, 'info');
};

/**
 * Dyslexia-Friendly Mode Toggle
 * This function is attached to the toggle button in settings.html
 */
window.toggleDyslexiaMode = function() {
    const isDyslexic = document.body.classList.toggle('dyslexia-mode');
    localStorage.setItem('dyslexiaMode', isDyslexic ? 'on' : 'off');
    
    const toggle = document.getElementById('dyslexia-toggle');
    if (toggle) toggle.checked = isDyslexic;
    
    window.showToastNotification(`படித்தல் முறை: ${isDyslexic ? 'செவித்திறன் நட்பு' : 'இயல்பு நிலை'}`, 'info');
};


/**
 * Initializes saved accessibility settings (Called on DOM Load)
 */
function initializeAccessibility() {
    // 1. Font Size
    const savedSize = localStorage.getItem('fontSize');
    if (savedSize) {
        document.documentElement.style.fontSize = `${savedSize}px`;
    }

    // 2. Dyslexia Mode
    if (localStorage.getItem('dyslexiaMode') === 'on') {
        document.body.classList.add('dyslexia-mode');
    }
}


// --- 4. CONTENT PROTECTION & INCOGNITO (2. உள்ளடக்க உருவாக்கம் & 1. அடிப்படை கட்டுப்பாடு) ---

/**
 * Content Protection (Simulated DRM/Right-click disable)
 * Disables right-click and copy shortcuts unless in Incognito Mode.
 */
function disableContentCopy() {
    if (localStorage.getItem('incognito') === 'on') {
        return; // Allow copy/right-click in Incognito Mode
    }
    
    document.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        window.showToastNotification("உள்ளடக்கம் பாதுகாக்கப்பட்டு உள்ளது. நகலெடுக்க முடியாது.", 'warning');
    });
    
    document.addEventListener('keydown', (e) => {
        // Disable Ctrl+C / Cmd+C (Copy)
        if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C' || e.key === 'u' || e.key === 'I' || e.key === 'i')) {
            e.preventDefault();
            window.showToastNotification("உள்ளடக்கம் நகலெடுக்க அனுமதிக்கப்படவில்லை.", 'warning');
        }
    });
}

/**
 * Toggles "Incognito" Reading Mode
 * This function is attached to the toggle button in settings.html
 */
window.toggleIncognitoMode = function() {
    const isIncognito = document.body.classList.toggle('incognito-mode');
    
    if (isIncognito) {
        localStorage.setItem('incognito', 'on');
        window.showToastNotification("நீங்கள் மறைநிலைப் பயன்முறையில் (Incognito Mode) உள்ளீர்கள். பாதுகாப்பு தற்காலிகமாக நீக்கப்பட்டது.", 'info');
    } else {
        localStorage.removeItem('incognito');
        window.showToastNotification("மறைநிலைப் பயன்முறையில் இருந்து வெளியேறினீர்கள். உள்ளடக்க பாதுகாப்பு செயல்படுத்தப்பட்டது.", 'info');
    }
    
    // Re-apply/remove copy guards
    window.location.reload(); 
};


// --- 5. INITIALIZATION & UTILITIES ---

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize Theme (Auto Dark/Light)
    initializeTheme();
    
    // 2. Initialize Accessibility Settings (Font/Dyslexia)
    initializeAccessibility();
    
    // 3. Content Protection (Must run after Incognito check)
    disableContentCopy();

    // 4. Sticky Header logic (5. தேடல், பார்வை & UX)
    const header = document.querySelector('header');
    if (header) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) {
                header.classList.add('sticky');
            } else {
                header.classList.remove('sticky');
            }
        });
    }

    // Placeholder: Check for initial automated welcome message status
    // (Actual logic is handled by backend/notifications.js)
    if (!localStorage.getItem('welcomeChecked')) {
        // window.sendWelcomeEmail(auth.currentUser?.email); // Only if user is logged in
        localStorage.setItem('welcomeChecked', 'true');
    }
});
