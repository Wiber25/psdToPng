import { db } from './firebase-config.js';

const SALT = "wiber_secret_salt_2024"; // Simple salt for demo

// DOM Elements
const fileInput = document.getElementById('file-input');
const dropZone = document.getElementById('drop-zone');
const fileList = document.getElementById('file-list');
const convertBtn = document.getElementById('convert-btn');
const limitModal = document.getElementById('limit-modal');
const licenseModal = document.getElementById('license-modal');
const closeModalBtns = document.querySelectorAll('.close-btn');
const openSettingsBtn = document.getElementById('open-settings');
const verifyBtn = document.getElementById('verify-btn');
const emailInput = document.getElementById('email-input');
const codeInput = document.getElementById('code-input');
const verifyMsg = document.getElementById('verify-msg');
const enterCodeBtn = document.getElementById('enter-code-btn');
const proStatusBadge = document.getElementById('pro-status');

// State
let isPro = false;
let selectedFiles = [];
let PSD = null;

// Init
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize PSD library
    if (typeof window.require === 'function') {
        try {
            PSD = window.require('psd');
        } catch (e) {
            console.warn("Failed to require('psd')", e);
        }
    } else if (window.PSD) {
        PSD = window.PSD;
    }

    if (!PSD) {
        console.error("PSD library not loaded!");
        // Fallback or alert?
    }

    await checkProStatus();
    setupEventListeners();
});

async function checkProStatus() {
    const result = await chrome.storage.local.get(['isPro']);
    isPro = !!result.isPro;
    updateProUI();
}

function updateProUI() {
    if (isPro) {
        proStatusBadge.classList.remove('hidden');
        openSettingsBtn.textContent = chrome.i18n.getMessage("proActive");
    } else {
        proStatusBadge.classList.add('hidden');
        openSettingsBtn.textContent = chrome.i18n.getMessage("openSettingsBtn");
    }
}

function setupEventListeners() {
    // File Upload
    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '#4a90e2';
    });
    dropZone.addEventListener('dragleave', () => {
        dropZone.style.borderColor = '#ccc';
    });
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '#ccc';
        handleFiles(e.dataTransfer.files);
    });
    fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

    // Modals
    closeModalBtns.forEach(btn => btn.addEventListener('click', closeAllModals));
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) closeAllModals();
    });

    // Settings / License
    openSettingsBtn.addEventListener('click', (e) => {
        e.preventDefault();
        licenseModal.classList.remove('hidden');
    });

    enterCodeBtn.addEventListener('click', () => {
        closeAllModals();
        licenseModal.classList.remove('hidden');
    });

    // Verify
    verifyBtn.addEventListener('click', handleVerification);

    // Convert
    convertBtn.addEventListener('click', handleConversion);
}

async function handleConversion() {
    if (selectedFiles.length === 0) return;
    if (!PSD) {
        alert(chrome.i18n.getMessage("errNoPsdLib"));
        return;
    }

    convertBtn.disabled = true;
    convertBtn.textContent = chrome.i18n.getMessage("convertingBtn");

    const convertedFiles = [];

    try {
        for (const file of selectedFiles) {
            const result = await convertPsdToPng(file);
            convertedFiles.push(result);
        }

        if (convertedFiles.length === 0) {
            throw new Error(chrome.i18n.getMessage("errNoFiles"));
        }

        if (convertedFiles.length === 1) {
            // Single file download
            const file = convertedFiles[0];
            downloadFile(file.href, file.filename);
        } else {
            // Zip download
            if (!window.JSZip) {
                alert(chrome.i18n.getMessage("errNoZip"));
                convertedFiles.forEach(f => downloadFile(f.href, f.filename));
            } else {
                const zip = new window.JSZip();

                // Add files to zip
                for (const file of convertedFiles) {
                    // Remove data:image/png;base64, prefix for JSZip if using base64
                    // But convertPsdToPng returns a blob URL (href). 
                    // JSZip needs Blob or Base64. 
                    // Let's modify convertPsdToPng to return Blob or fetch the Blob from URL.
                    // For simplicity, let's fetch the blob from the object URL.
                    const response = await fetch(file.href);
                    const blob = await response.blob();
                    zip.file(file.filename, blob);
                }

                const content = await zip.generateAsync({ type: "blob" });
                const zipUrl = URL.createObjectURL(content);
                downloadFile(zipUrl, "converted_images.zip");

                // Cleanup zip object url
                setTimeout(() => URL.revokeObjectURL(zipUrl), 100);
            }
        }

        alert(chrome.i18n.getMessage("msgDone"));
    } catch (error) {
        console.error(error);
        alert(chrome.i18n.getMessage("msgError") + error.message);
    } finally {
        // Cleanup individual object URLs
        convertedFiles.forEach(file => {
            URL.revokeObjectURL(file.href);
        });

        convertBtn.disabled = false;
        convertBtn.textContent = chrome.i18n.getMessage("convertBtn");
        selectedFiles = [];
        renderFileList();
    }
}

function downloadFile(url, filename) {
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = filename;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
}

function convertPsdToPng(file) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        PSD.fromURL(url).then(function (psd) {
            const png = psd.image.toPng(); // Returns an image element

            // png.src is likely a data URL (data:image/png;base64,...) 
            // OR checks psd.js documentation... usually toPng() returns an HTMLImageElement with src set.
            // Let's treat it as data URL.
            // However, large data URLs can crash. 
            // Ideally we get a Blob. psd.js toPng() returns image element.

            // Let's create a blob from the src to be safe for object URL usage?
            // Actually, keep it simple for now. 
            // If we want to be consistent with previous code which used png.src directly.
            // But for zipping, we need blob or base64.
            // Let's return the src directly.

            const filename = file.name.replace(/\.psd$/i, '.png');

            resolve({
                filename: filename,
                href: png.src // This works for single download and we can fetch(src) for zip
            });

            URL.revokeObjectURL(url);
        }).catch(reject);
    });
}

function closeAllModals() {
    limitModal.classList.add('hidden');
    licenseModal.classList.add('hidden');
    verifyMsg.textContent = '';
    verifyMsg.className = 'msg';
}

function handleFiles(files) {
    const fileArray = Array.from(files);

    if (!isPro && fileArray.length > 5) {
        limitModal.classList.remove('hidden');
        // Slice to 5
        selectedFiles = fileArray.slice(0, 5);
    } else {
        selectedFiles = fileArray;
    }

    renderFileList();
}

function renderFileList() {
    fileList.innerHTML = '';
    selectedFiles.forEach(file => {
        const item = document.createElement('div');
        item.className = 'file-item';
        item.textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
        fileList.appendChild(item);
    });
    convertBtn.disabled = selectedFiles.length === 0;
}

// Verification Logic
async function handleVerification() {
    const email = emailInput.value.trim();
    const code = codeInput.value.trim();

    if (!email || !code) {
        showMsg(chrome.i18n.getMessage("errEnterAll"), 'error');
        return;
    }

    // Hash-based verification (Client-side simulation of server logic)
    const expectedCode = await generateCode(email);

    if (code === expectedCode) {
        showMsg(chrome.i18n.getMessage("msgSuccess"), 'success');
        isPro = true;

        // Save to Local Storage
        await chrome.storage.local.set({ isPro: true, userEmail: email });

        // Register Device (Mock)
        await registerDevice(email);

        updateProUI();
        setTimeout(closeAllModals, 2000);
    } else {
        showMsg(chrome.i18n.getMessage("errInvalidCode"), 'error');
    }
}

// Simple Hash Generation (SHA-256)
async function generateCode(email) {
    const msgBuffer = new TextEncoder().encode(email + SALT);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    // Take first 8 chars of hex string as code
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex.substring(0, 8).toUpperCase();
}

function showMsg(text, type) {
    verifyMsg.textContent = text;
    verifyMsg.className = `msg ${type}`;
}

async function registerDevice(email) {
    console.log(`[Firebase] Registering device for ${email}`);

    // 1. Get user doc (Mock)
    // In a real app, you would fetch the document from Firestore
    // const userDoc = await db.collection('users').doc(email).get();
    // const data = userDoc.exists ? userDoc.data() : { devices: [] };

    // Mocking existing data for demonstration
    // Let's assume a new user has 0 devices, or simulate existing ones
    const mockData = { devices: [] }; // Change this to test limit

    // 2. Check Limit
    if (mockData.devices.length >= 2) {
        showMsg(chrome.i18n.getMessage("errLimitExceeded"), 'error');
        throw new Error('Device limit exceeded');
    }

    // 3. Add Device
    const deviceId = crypto.randomUUID();
    const newDevices = [...mockData.devices, deviceId];

    // 4. Update Firestore
    await db.collection('users').doc(email).set({
        is_pro: true,
        devices: newDevices,
        last_login: new Date().toISOString()
    }, { merge: true });

    console.log(`[Firebase] Device registered: ${deviceId}. Total: ${newDevices.length}`);
}
