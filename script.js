// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, onSnapshot, query, where } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Global variables provided by the environment (these will be available here)
// NOTE: __app_id and __initial_auth_token are still used as they are specific to the Canvas environment.
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Your web app's Firebase configuration - THIS IS NOW HARDCODED WITH YOUR PROVIDED VALUES
// WARNING: For actual production apps, consider environment variables or server-side injection
// for sensitive keys if you were to use other APIs that are not publicly safe.
// Firebase API keys are generally safe to be public as security is handled by Security Rules.
const firebaseConfig = {
    apiKey: "AIzaSyBfoHst0jysIVBvuKX4KjeIoOCcd66u17w",
    authDomain: "phonebook-tius.firebaseapp.com",
    projectId: "phonebook-tius",
    storageBucket: "phonebook-tius.firebasestorage.app",
    messagingSenderId: "586981446050",
    appId: "1:586981446050:web:4d93b0a39fc4911d03e2fb"
};


// Firebase instances
let app;
let db;
let auth;
let firebaseAuthUserId = null; // This will be the UID from Firebase Auth (for session)
let loggedInUserId = null; // This will be the user ID entered in the login form (for data separation)
let contacts = [];
let editingContactId = null; // To store the ID of the contact being edited
let unsubscribeFirestore = null; // To store the unsubscribe function for Firestore listener

// DOM Elements
const loginScreen = document.getElementById('loginScreen');
const loginForm = document.getElementById('loginForm');
const loginUserIdInput = document.getElementById('loginUserId');
const loginPasswordInput = document.getElementById('loginPassword');
const loginError = document.getElementById('loginError');
const mainAppScreen = document.getElementById('mainAppScreen');
const loggedInUserIdDisplay = document.getElementById('loggedInUserIdDisplay');
const firebaseUserIdDisplay = document.getElementById('firebaseUserIdDisplay');
const formTab = document.getElementById('formTab');
const listTab = document.getElementById('listTab');
const contactFormSection = document.getElementById('contactFormSection');
const contactListSection = document.getElementById('contactListSection');
const logoutBtn = document.getElementById('logoutBtn');

const contactForm = document.getElementById('contactForm');
const nameInput = document.getElementById('name');
const websiteInput = document.getElementById('website');
const websiteNotesInput = document.getElementById('websiteNotes');
const notesInput = document.getElementById('notes');
const submitButton = document.getElementById('submitButton');
const cancelEditButton = document.getElementById('cancelEditButton');
const contactListDiv = document.getElementById('contactList');
const noContactsMessage = document.getElementById('noContactsMessage');
const loadingSpinner = document.getElementById('loadingSpinner');
const customModal = document.getElementById('customModal');
const modalMessage = document.getElementById('modalMessage');
const modalConfirmBtn = document.getElementById('modalConfirmBtn');
const modalCancelBtn = document.getElementById('modalCancelBtn');

// Dynamic input containers and buttons
const phonesContainer = document.getElementById('phonesContainer');
const addPhoneBtn = document.getElementById('addPhoneBtn');
const emailsContainer = document.getElementById('emailsContainer');
const addEmailBtn = document.getElementById('addEmailBtn');
const connectionsContainer = document.getElementById('connectionsContainer');
const addConnectionBtn = document.getElementById('addConnectionBtn');

// --- Hardcoded Users for Demonstration (INSECURE for production) ---
const USERS = {
    "user1": "pass123",
    "user2": "securepass",
    "tes@gmail.com": "password123" // Example user from request
};

// --- Utility Functions ---
function showLoading() {
    loadingSpinner.classList.remove('hidden');
}

function hideLoading() {
    loadingSpinner.classList.add('hidden');
}

let modalCallback = null;
function showModal(message, callback) {
    modalMessage.textContent = message;
    modalCallback = callback;
    customModal.classList.remove('hidden');
}

function hideModal() {
    customModal.classList.add('hidden');
    modalCallback = null;
}

modalConfirmBtn.addEventListener('click', () => {
    if (modalCallback) {
        modalCallback(true);
    }
    hideModal();
});

modalCancelBtn.addEventListener('click', () => {
    if (modalCallback) {
        modalCallback(false);
    }
    hideModal();
});

// --- Tab Switching Logic ---
function showTab(tabId) {
    // Deactivate all tabs
    formTab.classList.remove('border-blue-600', 'text-blue-600');
    listTab.classList.remove('border-blue-600', 'text-blue-600');
    formTab.classList.add('border-transparent', 'text-gray-600');
    listTab.classList.add('border-transparent', 'text-gray-600');

    // Hide all sections
    contactFormSection.classList.add('hidden');
    contactListSection.classList.add('hidden');

    // Activate selected tab and show its section
    if (tabId === 'form') {
        formTab.classList.add('border-blue-600', 'text-blue-600');
        contactFormSection.classList.remove('hidden');
        clearForm(); // Clear form when switching to form tab
    } else if (tabId === 'list') {
        listTab.classList.add('border-blue-600', 'text-blue-600');
        contactListSection.classList.remove('hidden');
    }
}

// --- Firebase Initialization and Authentication ---
async function initializeFirebase() {
    showLoading();
    try {
        // No need to check for firebaseConfig being empty as it's now hardcoded
        // Initialize Firebase app with the provided config
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);

        // Listen for Firebase Auth state changes (for session management)
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                firebaseAuthUserId = user.uid;
                firebaseUserIdDisplay.textContent = firebaseAuthUserId;
                console.log("Authenticated with Firebase UID:", firebaseAuthUserId);
                // If already logged in via form, setup listener
                if (loggedInUserId) {
                    setupFirestoreListener();
                }
            } else {
                // Attempt to sign in anonymously if no initial token (from Canvas env)
                try {
                    if (initialAuthToken) {
                        await signInWithCustomToken(auth, initialAuthToken);
                    } else {
                        await signInAnonymously(auth);
                    }
                } catch (error) {
                    console.error("Firebase authentication failed:", error);
                    firebaseUserIdDisplay.textContent = "Failed to load session ID";
                }
            }
            hideLoading();
        });

    } catch (error) {
        console.error("Error initializing Firebase:", error);
        firebaseUserIdDisplay.textContent = "Failed to load session ID";
        hideLoading();
    }
}

// --- Firestore Data Operations ---

// Real-time listener for contacts, now dependent on loggedInUserId
function setupFirestoreListener() {
    // Unsubscribe from previous listener if exists
    if (unsubscribeFirestore) {
        unsubscribeFirestore();
    }

    if (!db || !loggedInUserId) {
        console.warn("Firestore or LoggedIn User ID not available for listener setup.");
        return;
    }

    // Data path now uses the loggedInUserId from the form
    const contactsCollectionRef = collection(db, `artifacts/${appId}/users_data/${loggedInUserId}/contacts`);
    const q = query(contactsCollectionRef); // No orderBy to avoid index issues

    unsubscribeFirestore = onSnapshot(q, (snapshot) => {
        const fetchedContacts = [];
        snapshot.forEach((doc) => {
            fetchedContacts.push({ id: doc.id, ...doc.data() });
        });
        // Sort contacts by name alphabetically in memory
        contacts = fetchedContacts.sort((a, b) => a.name.localeCompare(b.name));
        renderContacts();
    }, (error) => {
        console.error("Error fetching real-time contacts:", error);
        showModal("Failed to load contacts: " + error.message, () => {});
    });
}

async function addContact(contactData) {
    showLoading();
    try {
        if (!db || !loggedInUserId) {
            throw new Error("Firestore or LoggedIn User ID not available.");
        }
        await addDoc(collection(db, `artifacts/${appId}/users_data/${loggedInUserId}/contacts`), {
            ...contactData,
            loggedInUserId: loggedInUserId // Ensure contact is linked to the logged-in user
        });
        clearForm();
        showModal("Contact added successfully!", () => {});
        showTab('list'); // Switch to list tab after adding
    } catch (e) {
        console.error("Error adding document: ", e);
        showModal("Failed to add contact: " + e.message, () => {});
    } finally {
        hideLoading();
    }
}

async function updateContact(id, contactData) {
    showLoading();
    try {
        if (!db || !loggedInUserId) {
            throw new Error("Firestore or LoggedIn User ID not available.");
        }
        const contactRef = doc(db, `artifacts/${appId}/users_data/${loggedInUserId}/contacts`, id);
        await updateDoc(contactRef, contactData);
        clearForm();
        editingContactId = null;
        submitButton.textContent = 'Add Contact';
        cancelEditButton.classList.add('hidden');
        showModal("Contact updated successfully!", () => {});
        showTab('list'); // Switch to list tab after updating
    } catch (e) {
        console.error("Error updating document: ", e);
        showModal("Failed to update contact: " + e.message, () => {});
    } finally {
        hideLoading();
    }
}

async function deleteContact(id) {
    showLoading();
    try {
        if (!db || !loggedInUserId) {
            throw new Error("Firestore or LoggedIn User ID not available.");
        }
        const contactRef = doc(db, `artifacts/${appId}/users_data/${loggedInUserId}/contacts`, id);
        await deleteDoc(contactRef);
        showModal("Contact deleted successfully!", () => {});
    } catch (e) {
        console.error("Error deleting document: ", e);
        showModal("Failed to delete contact: " + e.message, () => {});
    } finally {
        hideLoading();
    }
}

// --- Dynamic Input Management (Phones, Emails, Connections) ---

// Generic function to add a dynamic input field
function addDynamicInput(container, type, placeholder, initialValue = '') {
    const inputGroup = document.createElement('div');
    inputGroup.className = 'flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 items-center';
    inputGroup.innerHTML = `
        <input type="${type}" placeholder="${placeholder}" value="${initialValue}"
               class="flex-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 shadow-sm dynamic-input-${type}">
        <button type="button"
                class="remove-dynamic-input-btn bg-red-500 text-white p-2 rounded-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2 shadow-sm text-sm w-full sm:w-auto">
            X
        </button>
    `;
    container.appendChild(inputGroup);

    inputGroup.querySelector('.remove-dynamic-input-btn').addEventListener('click', () => {
        inputGroup.remove();
    });
}

// Specific functions for phones, emails, and connections using the generic function
function addPhoneInput(phoneNumber = '') {
    addDynamicInput(phonesContainer, 'tel', 'Enter phone number', phoneNumber);
}

function addEmailInput(emailAddress = '') {
    addDynamicInput(emailsContainer, 'email', 'Enter email address', emailAddress);
}

function addConnectionInput(serviceName = '', identifier = '') {
    const connectionDiv = document.createElement('div');
    connectionDiv.className = 'flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 items-center';
    connectionDiv.innerHTML = `
        <input type="text" placeholder="Service Name (e.g., GitHub)" value="${serviceName}"
               class="flex-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 shadow-sm connection-service-input">
        <input type="text" placeholder="ID/URL (e.g., username)" value="${identifier}"
               class="flex-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 shadow-sm connection-identifier-input">
        <button type="button"
                class="remove-connection-btn bg-red-500 text-white p-2 rounded-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2 shadow-sm text-sm w-full sm:w-auto">
            X
        </button>
    `;
    connectionsContainer.appendChild(connectionDiv);

    connectionDiv.querySelector('.remove-connection-btn').addEventListener('click', () => {
        connectionDiv.remove();
    });
}

// Generic function to get values from dynamic inputs
function getDynamicInputValues(container, inputClass) {
    const values = [];
    container.querySelectorAll(`.${inputClass}`).forEach(input => {
        const value = input.value.trim();
        if (value) { // Only add non-empty values
            values.push(value);
        }
    });
    return values;
}

function getConnectionsFromForm() {
    const connections = [];
    connectionsContainer.querySelectorAll('.flex.flex-col.sm\:flex-row.space-y-2.sm\:space-y-0.sm\:space-x-2.items-center').forEach(div => {
        const serviceInput = div.querySelector('.connection-service-input');
        const identifierInput = div.querySelector('.connection-identifier-input');
        if (serviceInput.value.trim() && identifierInput.value.trim()) {
            connections.push({
                service: serviceInput.value.trim(),
                identifier: identifierInput.value.trim()
            });
        }
    });
    return connections;
}

// Generic function to populate dynamic input forms
function populateDynamicInputsForm(container, addInputFn, valuesArray) {
    container.innerHTML = ''; // Clear existing inputs
    if (valuesArray && valuesArray.length > 0) {
        valuesArray.forEach(value => {
            addInputFn(value);
        });
    } else {
        // Add at least one empty input if the array is empty
        addInputFn('');
    }
}

function populateConnectionsForm(connections) {
    connectionsContainer.innerHTML = ''; // Clear existing inputs
    if (connections && connections.length > 0) {
        connections.forEach(conn => {
            addConnectionInput(conn.service, conn.identifier);
        });
    }
}

// --- UI Rendering and Event Handlers ---

function renderContacts() {
    contactListDiv.innerHTML = ''; // Clear existing contacts
    if (contacts.length === 0) {
        noContactsMessage.classList.remove('hidden');
    } else {
        noContactsMessage.classList.add('hidden');
        contacts.forEach(contact => {
            const contactCard = document.createElement('div');
            contactCard.className = 'bg-gray-50 p-4 rounded-lg shadow-sm border border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center';

            let phonesHtml = '';
            if (contact.phones && contact.phones.length > 0) {
                phonesHtml = '<div class="mt-2 text-sm text-gray-700">';
                phonesHtml += '<p class="font-medium">Telepon:</p>';
                contact.phones.forEach(phone => {
                    phonesHtml += `<p class="ml-2">- ${phone}</p>`;
                });
                phonesHtml += '</div>';
            }

            let emailsHtml = '';
            if (contact.emails && contact.emails.length > 0) {
                emailsHtml = '<div class="mt-2 text-sm text-gray-700">';
                emailsHtml += '<p class="font-medium">Email:</p>';
                contact.emails.forEach(email => {
                    emailsHtml += `<p class="ml-2">- ${email}</p>`;
                });
                emailsHtml += '</div>';
            }

            let websiteHtml = '';
            if (contact.website) {
                websiteHtml = `<p class="text-gray-700 mt-2">Situs Web: <a href="${contact.website}" target="_blank" class="text-blue-600 hover:underline">${contact.website}</a></p>`;
            }
            let websiteNotesHtml = '';
            if (contact.websiteNotes) {
                websiteNotesHtml = `<p class="text-gray-600 text-sm mt-1">Catatan Situs Web: ${contact.websiteNotes}</p>`;
            }

            let connectionsHtml = '';
            if (contact.connections && contact.connections.length > 0) {
                connectionsHtml = '<div class="mt-2 text-sm text-gray-600">';
                connectionsHtml += '<p class="font-medium">Koneksi:</p>';
                contact.connections.forEach(conn => {
                    connectionsHtml += `<p class="ml-2">- ${conn.service}: ${conn.identifier}</p>`;
                });
                connectionsHtml += '</div>';
            }

            contactCard.innerHTML = `
                <div class="mb-2 sm:mb-0 flex-grow">
                    <h3 class="text-lg font-semibold text-gray-900">${contact.name}</h3>
                    ${phonesHtml}
                    ${emailsHtml}
                    ${websiteHtml}
                    ${websiteNotesHtml}
                    ${connectionsHtml}
                    <p class="text-gray-600 text-sm mt-1">Catatan Lain: ${contact.notes || '-'}</p>
                </div>
                <div class="flex space-x-2 mt-2 sm:mt-0">
                    <button data-id="${contact.id}" class="edit-btn bg-yellow-500 text-white py-1 px-3 rounded-md hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-offset-2 shadow-sm">
                        Edit
                    </button>
                    <button data-id="${contact.id}" class="delete-btn bg-red-500 text-white py-1 px-3 rounded-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2 shadow-sm">
                        Hapus
                    </button>
                </div>
            `;
            contactListDiv.appendChild(contactCard);
        });

        // Add event listeners for edit and delete buttons
        document.querySelectorAll('.edit-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const id = e.target.dataset.id;
                const contactToEdit = contacts.find(c => c.id === id);
                if (contactToEdit) {
                    nameInput.value = contactToEdit.name;
                    websiteInput.value = contactToEdit.website || '';
                    websiteNotesInput.value = contactToEdit.websiteNotes || '';
                    notesInput.value = contactToEdit.notes;
                    populateDynamicInputsForm(phonesContainer, addPhoneInput, contactToEdit.phones);
                    populateDynamicInputsForm(emailsContainer, addEmailInput, contactToEdit.emails);
                    populateConnectionsForm(contactToEdit.connections);
                    editingContactId = id;
                    submitButton.textContent = 'Update Contact';
                    cancelEditButton.classList.remove('hidden');
            
