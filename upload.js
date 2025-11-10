/*
 * File: upload.js
 * Description: Cloudinary மூலம் படங்கள் மற்றும் ஆடியோவை பதிவேற்றம் செய்யும் லாஜிக்.
 * Integrates: Cloudinary Unsigned Upload (Unsigned mode is critical for front-end security).
 * Purpose: Handles the file selection, upload process, progress tracking, and returns secure URLs.
 */

// --- 1. CLOUDINARY CONFIGURATION (Use your provided details) ---
const CLOUDINARY_CLOUD_NAME = 'davbdxg0u';
const CLOUDINARY_UPLOAD_PRESET_IMAGE = 'naan_kavithai_images';
const CLOUDINARY_UPLOAD_PRESET_AUDIO = 'naan_kavithai_images'; 
const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`;

// --- 2. GLOBAL STATE ---
// Store uploaded URLs globally in a temporary object until final publish (Used by content.js)
window.uploadedMediaUrls = {
    imageUrl: null,
    audioUrl: null
};

// --- 3. CORE UPLOAD FUNCTION ---

/**
 * Cloudinary-இல் ஒரு கோப்பைப் பதிவேற்றம் செய்கிறது.
 * @param {File} file - User-selected file object.
 * @param {string} preset - The Cloudinary upload preset name.
 * @param {string} statusElementId - The ID of the HTML element to update status/progress.
 * @returns {Promise<string>} - Returns the secure URL of the uploaded file.
 */
async function uploadFileToCloudinary(file, preset, statusElementId) {
    const statusElement = document.getElementById(statusElementId);
    
    if (!file) {
        statusElement.innerHTML = 'கோப்பைத் தேர்ந்தெடுக்கவும்.';
        return null;
    }

    statusElement.innerHTML = `<i class="fas fa-spinner fa-spin"></i> பதிவேற்றம் ஆரம்பிக்கிறது...`;

    // Create a new FormData object for the POST request
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', preset);
    formData.append('folder', file.type.startsWith('image/') ? 'kavithai_images' : 'kavithai_audios');

    try {
        const xhr = new XMLHttpRequest();
        
        // Progress tracking 
        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                const percent = Math.round((e.loaded * 100) / e.total);
                statusElement.innerHTML = `<i class="fas fa-upload"></i> பதிவேற்றம்: ${percent}%`;
            }
        });
        
        // Return a Promise that resolves when the upload is complete
        return new Promise((resolve, reject) => {
            xhr.onreadystatechange = function() {
                if (xhr.readyState === 4) { 
                    if (xhr.status === 200) {
                        const response = JSON.parse(xhr.responseText);
                        const secureUrl = response.secure_url;
                        
                        statusElement.innerHTML = `<i class="fas fa-check-circle"></i> வெற்றிகரமாகப் பதிவேற்றப்பட்டது!`;
                        window.showToastNotification("மீடியா வெற்றிகரமாகப் பதிவேற்றப்பட்டது!", 'success');
                        resolve(secureUrl);
                    } else {
                        const errorResponse = JSON.parse(xhr.responseText);
                        const errorMessage = `பதிவேற்றத்தில் பிழை: ${errorResponse.error.message || 'தெரியாத பிழை'}`;
                        statusElement.innerHTML = `<i class="fas fa-times-circle"></i> ${errorMessage}`;
                        window.showToastNotification(errorMessage, 'error');
                        reject(errorMessage);
                    }
                }
            };
            
            xhr.open('POST', CLOUDINARY_UPLOAD_URL, true);
            xhr.send(formData);
        });

    } catch (error) {
        console.error("Cloudinary Upload Error:", error);
        statusElement.innerHTML = `<i class="fas fa-times-circle"></i> நெட்வொர்க் பிழை ஏற்பட்டது.`;
        window.showToastNotification("நெட்வொர்க் பிழை அல்லது சர்வர் அணுகல் சிக்கல்.", 'error');
        return null;
    }
}

// --- 4. EVENT LISTENERS AND INITIALIZATION (Called on create.html) ---

document.addEventListener('DOMContentLoaded', () => {
    // 1. Get HTML elements
    const imageInput = document.getElementById('image-upload');
    const audioInput = document.getElementById('audio-upload');

    // 2. Image Upload Listener 
    if (imageInput) {
        imageInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    const url = await uploadFileToCloudinary(file, CLOUDINARY_UPLOAD_PRESET_IMAGE, 'image-upload-status');
                    if (url) {
                        window.uploadedMediaUrls.imageUrl = url;
                    }
                } catch (error) {
                    window.uploadedMediaUrls.imageUrl = null;
                }
            }
        });
    }

    // 3. Audio Upload Listener
    if (audioInput) {
        audioInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    const url = await uploadFileToCloudinary(file, CLOUDINARY_UPLOAD_PRESET_AUDIO, 'audio-upload-status');
                    if (url) {
                        window.uploadedMediaUrls.audioUrl = url;
                    }
                } catch (error) {
                    window.uploadedMediaUrls.audioUrl = null;
                }
            }
        });
    }

    // The final form submission logic is handled by content.js
});
