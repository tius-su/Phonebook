// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getDatabase, 
    ref, 
    set, 
    get, 
    child, 
    push, 
    update, 
    remove,
    query,
    orderByChild,
    equalTo,
    startAt,
    endAt
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import {
    getAuth,
    signInWithEmailAndPassword,
    signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBfoHst0jysIVBvuKX4KjeIoOCcd66u17w",
    authDomain: "phonebook-tius.firebaseapp.com",
    projectId: "phonebook-tius",
    storageBucket: "phonebook-tius.appspot.com",
    messagingSenderId: "586981446050",
    appId: "1:586981446050:web:4d93b0a39fc4911d03e2fb",
    databaseURL: "https://phonebook-tius-default-rtdb.firebaseio.com/"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const auth = getAuth(app);

// DOM elements
const loginScreen = document.getElementById('login-screen');
const appContainer = document.getElementById('app-container');
const loginForm = document.getElementById('login-form');
const logoutBtn = document.getElementById('logout-btn');
const contactsTab = document.getElementById('contacts-tab');
const addContactTab = document.getElementById('add-contact-tab');
const contactsScreen = document.getElementById('contacts-screen');
const addContactScreen = document.getElementById('add-contact-screen');
const contactsList = document.getElementById('contacts-list');
const contactForm = document.getElementById('contact-form');
const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const addPhoneBtn = document.getElementById('add-phone-btn');
const addEmailBtn = document.getElementById('add-email-btn');
const cancelBtn = document.getElementById('cancel-btn');
const toast = document.getElementById('toast');

// Current user state
let currentUser = null;
let currentContactId = null;

// Initialize the app
function init() {
    // Check if user is already logged in
    auth.onAuthStateChanged((user) => {
        if (user) {
            currentUser = user;
            showApp();
            loadContacts();
        } else {
            showLogin();
        }
    });

    // Event listeners
    loginForm.addEventListener('submit', handleLogin);
    logoutBtn.addEventListener('click', handleLogout);
    contactsTab.addEventListener('click', () => switchTab('contacts'));
    addContactTab.addEventListener('click', () => switchTab('add-contact'));
    contactForm.addEventListener('submit', saveContact);
    addPhoneBtn.addEventListener('click', addPhoneField);
    addEmailBtn.addEventListener('click', addEmailField);
    cancelBtn.addEventListener('click', resetForm);
    searchBtn.addEventListener('click', searchContacts);
    searchInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') searchContacts();
    });

    // Initialize PWA
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('sw.js')
                .then(registration => {
                    console.log('ServiceWorker registration successful');
                })
                .catch(err => {
                    console.log('ServiceWorker registration failed: ', err);
                });
        });
    }
}

// Show login screen
function showLogin() {
    loginScreen.classList.remove('hidden');
    appContainer.classList.add('hidden');
}

// Show app screen
function showApp() {
    loginScreen.classList.add('hidden');
    appContainer.classList.remove('hidden');
}

// Switch between tabs
function switchTab(tab) {
    if (tab === 'contacts') {
        contactsTab.classList.add('active');
        addContactTab.classList.remove('active');
        contactsScreen.classList.add('active');
        addContactScreen.classList.remove('active');
        loadContacts();
    } else {
        contactsTab.classList.remove('active');
        addContactTab.classList.add('active');
        contactsScreen.classList.remove('active');
        addContactScreen.classList.add('active');
        resetForm();
    }
}

// Handle login
async function handleLogin(e) {
    e.preventDefault();
    const userid = document.getElementById('userid').value;
    const password = document.getElementById('password').value;

    try {
        // Firebase requires email format for login
        const email = `${userid}@phonebook.com`;
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        currentUser = userCredential.user;
        showApp();
        loadContacts();
        showToast('Login successful');
    } catch (error) {
        showToast(error.message, true);
    }
}

// Handle logout
function handleLogout() {
    signOut(auth).then(() => {
        currentUser = null;
        showLogin();
        showToast('Logged out successfully');
    }).catch((error) => {
        showToast(error.message, true);
    });
}

// Load contacts from Firebase
async function loadContacts() {
    if (!currentUser) return;

    try {
        const dbRef = ref(database);
        const snapshot = await get(child(dbRef, `users/${currentUser.uid}/contacts`));
        
        contactsList.innerHTML = '';
        
        if (snapshot.exists()) {
            const contacts = snapshot.val();
            Object.keys(contacts).forEach(contactId => {
                const contact = contacts[contactId];
                renderContact(contactId, contact);
            });
        } else {
            contactsList.innerHTML = '<p class="no-contacts">No contacts found. Add your first contact!</p>';
        }
    } catch (error) {
        showToast(error.message, true);
    }
}

// Render a single contact
function renderContact(contactId, contact) {
    const contactCard = document.createElement('div');
    contactCard.className = 'contact-card';
    contactCard.dataset.id = contactId;

    let phonesHtml = '';
    if (contact.phones) {
        Object.values(contact.phones).forEach(phone => {
            phonesHtml += `
                <div class="contact-phone">
                    <i class="fas fa-phone"></i>
                    <span>${phone.label ? phone.label + ': ' : ''}${phone.number}</span>
                </div>
            `;
        });
    }

    let emailsHtml = '';
    if (contact.emails) {
        Object.values(contact.emails).forEach(email => {
            emailsHtml += `
                <div class="contact-email">
                    <i class="fas fa-envelope"></i>
                    <span>${email.label ? email.label + ': ' : ''}${email.address}</span>
                </div>
            `;
        });
    }

    let websiteHtml = '';
    if (contact.website) {
        websiteHtml = `
            <div class="contact-website">
                <i class="fas fa-globe"></i>
                <a href="${contact.website}" target="_blank">${contact.website}</a>
            </div>
        `;
    }

    let addressHtml = '';
    if (contact.address) {
        addressHtml = `
            <div class="contact-address">
                <i class="fas fa-map-marker-alt"></i>
                <span>${contact.address}</span>
            </div>
        `;
    }

    let tagsHtml = '';
    if (contact.tags) {
        const tagsArray = contact.tags.split(',').map(tag => tag.trim());
        tagsHtml = `
            <div class="contact-tags">
                ${tagsArray.map(tag => `<span class="tag">${tag}</span>`).join('')}
            </div>
        `;
    }

    contactCard.innerHTML = `
        <div class="contact-name">${contact.name}</div>
        ${phonesHtml}
        ${emailsHtml}
        ${websiteHtml}
        ${addressHtml}
        ${contact.notes ? `<div class="contact-notes">${contact.notes}</div>` : ''}
        ${tagsHtml}
        <div class="contact-actions">
            <button class="edit-btn" data-id="${contactId}">Edit</button>
            <button class="delete-btn" data-id="${contactId}">Delete</button>
        </div>
    `;

    contactsList.appendChild(contactCard);

    // Add event listeners to action buttons
    contactCard.querySelector('.edit-btn').addEventListener('click', () => editContact(contactId));
    contactCard.querySelector('.delete-btn').addEventListener('click', () => deleteContact(contactId));
}

// Save contact to Firebase
async function saveContact(e) {
    e.preventDefault();
    
    if (!currentUser) return;

    const name = document.getElementById('name').value;
    if (!name) {
        showToast('Name is required', true);
        return;
    }

    // Collect phone numbers
    const phoneElements = document.querySelectorAll('.phone-number-group');
    const phones = [];
    let hasPhone = false;

    phoneElements.forEach((group, index) => {
        const number = group.querySelector('.phone-number').value;
        const label = group.querySelector('.phone-label').value;
        
        if (number) {
            hasPhone = true;
            phones.push({
                number,
                label: label || `Phone ${index + 1}`
            });
        }
    });

    if (!hasPhone) {
        showToast('At least one phone number is required', true);
        return;
    }

    // Collect emails
    const emailElements = document.querySelectorAll('.email-group');
    const emails = [];

    emailElements.forEach((group, index) => {
        const address = group.querySelector('.email').value;
        const label = group.querySelector('.email-label').value;
        
        if (address) {
            emails.push({
                address,
                label: label || `Email ${index + 1}`
            });
        }
    });

    const contactData = {
        name,
        phones,
        emails,
        website: document.getElementById('website').value || null,
        address: document.getElementById('address').value || null,
        notes: document.getElementById('notes').value || null,
        tags: document.getElementById('tags').value || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    try {
        const dbRef = ref(database, `users/${currentUser.uid}/contacts`);
        
        if (currentContactId) {
            // Update existing contact
            await update(child(dbRef, currentContactId), contactData);
            showToast('Contact updated successfully');
        } else {
            // Add new contact
            const newContactRef = push(dbRef);
            await set(newContactRef, contactData);
            showToast('Contact added successfully');
        }
        
        resetForm();
        switchTab('contacts');
    } catch (error) {
        showToast(error.message, true);
    }
}

// Edit contact
async function editContact(contactId) {
    try {
        const dbRef = ref(database);
        const snapshot = await get(child(dbRef, `users/${currentUser.uid}/contacts/${contactId}`));
        
        if (snapshot.exists()) {
            const contact = snapshot.val();
            currentContactId = contactId;
            
            // Set form values
            document.getElementById('name').value = contact.name;
            
            // Clear existing phone and email fields
            document.querySelectorAll('.phone-number-group:not(:first-child)').forEach(el => el.remove());
            document.querySelectorAll('.email-group:not(:first-child)').forEach(el => el.remove());
            
            // Set phone numbers
            if (contact.phones && contact.phones.length > 0) {
                const firstPhoneGroup = document.querySelector('.phone-number-group');
                firstPhoneGroup.querySelector('.phone-number').value = contact.phones[0].number;
                firstPhoneGroup.querySelector('.phone-label').value = contact.phones[0].label || '';
                
                for (let i = 1; i < contact.phones.length; i++) {
                    addPhoneField();
                    const phoneGroup = document.querySelectorAll('.phone-number-group')[i];
                    phoneGroup.querySelector('.phone-number').value = contact.phones[i].number;
                    phoneGroup.querySelector('.phone-label').value = contact.phones[i].label || '';
                }
            }
            
            // Set emails
            if (contact.emails && contact.emails.length > 0) {
                const firstEmailGroup = document.querySelector('.email-group');
                firstEmailGroup.querySelector('.email').value = contact.emails[0].address;
                firstEmailGroup.querySelector('.email-label').value = contact.emails[0].label || '';
                
                for (let i = 1; i < contact.emails.length; i++) {
                    addEmailField();
                    const emailGroup = document.querySelectorAll('.email-group')[i];
                    emailGroup.querySelector('.email').value = contact.emails[i].address;
                    emailGroup.querySelector('.email-label').value = contact.emails[i].label || '';
                }
            }
            
            document.getElementById('website').value = contact.website || '';
            document.getElementById('address').value = contact.address || '';
            document.getElementById('notes').value = contact.notes || '';
            document.getElementById('tags').value = contact.tags || '';
            
            switchTab('add-contact');
        }
    } catch (error) {
        showToast(error.message, true);
    }
}

// Delete contact
async function deleteContact(contactId) {
    if (!confirm('Are you sure you want to delete this contact?')) return;
    
    try {
        const dbRef = ref(database, `users/${currentUser.uid}/contacts/${contactId}`);
        await remove(dbRef);
        showToast('Contact deleted successfully');
        loadContacts();
    } catch (error) {
        showToast(error.message, true);
    }
}

// Search contacts
async function searchContacts() {
    const searchTerm = searchInput.value.trim().toLowerCase();
    
    if (!searchTerm) {
        loadContacts();
        return;
    }
    
    try {
        const dbRef = ref(database, `users/${currentUser.uid}/contacts`);
        const snapshot = await get(dbRef);
        
        contactsList.innerHTML = '';
        
        if (snapshot.exists()) {
            const contacts = snapshot.val();
            let found = false;
            
            Object.keys(contacts).forEach(contactId => {
                const contact = contacts[contactId];
                const searchFields = [
                    contact.name,
                    contact.phones?.map(phone => phone.number).join(' '),
                    contact.emails?.map(email => email.address).join(' '),
                    contact.website,
                    contact.address,
                    contact.notes,
                    contact.tags
                ].join(' ').toLowerCase();
                
                if (searchFields.includes(searchTerm)) {
                    renderContact(contactId, contact);
                    found = true;
                }
            });
            
            if (!found) {
                contactsList.innerHTML = '<p class="no-contacts">No matching contacts found.</p>';
            }
        } else {
            contactsList.innerHTML = '<p class="no-contacts">No contacts found.</p>';
        }
    } catch (error) {
        showToast(error.message, true);
    }
}

// Add phone number field
function addPhoneField() {
    const container = document.querySelector('.phone-numbers-container');
    const newGroup = document.createElement('div');
    newGroup.className = 'phone-number-group';
    newGroup.innerHTML = `
        <input type="tel" class="phone-number" placeholder="Phone number">
        <input type="text" class="phone-label" placeholder="Label (e.g., Mobile, Work)">
        <button type="button" class="remove-phone-btn icon-btn"><i class="fas fa-times"></i></button>
    `;
    container.insertBefore(newGroup, addPhoneBtn);
    newGroup.querySelector('.remove-phone-btn').addEventListener('click', () => {
        if (document.querySelectorAll('.phone-number-group').length > 1) {
            newGroup.remove();
        } else {
            newGroup.querySelector('.phone-number').value = '';
            newGroup.querySelector('.phone-label').value = '';
        }
    });
}

// Add email field
function addEmailField() {
    const container = document.querySelector('.emails-container');
    const newGroup = document.createElement('div');
    newGroup.className = 'email-group';
    newGroup.innerHTML = `
        <input type="email" class="email" placeholder="Email">
        <input type="text" class="email-label" placeholder="Label (e.g., Personal, Work)">
        <button type="button" class="remove-email-btn icon-btn"><i class="fas fa-times"></i></button>
    `;
    container.insertBefore(newGroup, addEmailBtn);
    newGroup.querySelector('.remove-email-btn').addEventListener('click', () => {
        if (document.querySelectorAll('.email-group').length > 1) {
            newGroup.remove();
        } else {
            newGroup.querySelector('.email').value = '';
            newGroup.querySelector('.email-label').value = '';
        }
    });
}

// Reset form
function resetForm() {
    contactForm.reset();
    currentContactId = null;
    
    // Reset phone numbers (keep one field)
    document.querySelectorAll('.phone-number-group:not(:first-child)').forEach(el => el.remove());
    const firstPhoneGroup = document.querySelector('.phone-number-group');
    firstPhoneGroup.querySelector('.phone-number').value = '';
    firstPhoneGroup.querySelector('.phone-label').value = '';
    
    // Reset emails (keep one field)
    document.querySelectorAll('.email-group:not(:first-child)').forEach(el => el.remove());
    const firstEmailGroup = document.querySelector('.email-group');
    firstEmailGroup.querySelector('.email').value = '';
    firstEmailGroup.querySelector('.email-label').value = '';
}

// Show toast message
function showToast(message, isError = false) {
    toast.textContent = message;
    toast.className = isError ? 'toast error' : 'toast';
    toast.classList.remove('hidden');
    
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', init);

