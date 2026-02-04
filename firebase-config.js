// Firebase Configuration (Placeholder)
// Replace with actual config object from Firebase Console
export const firebaseConfig = {
    apiKey: "AIzaSyAkg4GyoY9dA2NqenilbZacWM-D36xAZZo",
    authDomain: "psd-easy-convertor.firebaseapp.com",
    projectId: "psd-easy-convertor",
    storageBucket: "psd-easy-convertor.firebasestorage.app",
    messagingSenderId: "557088326208",
    appId: "1:557088326208:web:bc0421061b0e54f44115a5"
};

// Mock Firebase for now since we don't have real credentials in this environment
export const db = {
    collection: (name) => ({
        doc: (id) => ({
            get: async () => ({ exists: false, data: () => ({}) }),
            set: async (data, opts) => console.log(`[MockDB] Set ${name}/${id}:`, data),
            update: async (data) => console.log(`[MockDB] Update ${name}/${id}:`, data)
        })
    })
};
