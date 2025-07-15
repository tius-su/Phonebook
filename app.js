// Mengimpor modul Firebase
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

// Konfigurasi Firebase Anda (diambil dari yang Anda berikan)
const firebaseConfig = {
    apiKey: "AIzaSyBfoHst0jysIVBvuKX4KjeIoOCcd66u17w",
    authDomain: "phonebook-tius.firebaseapp.com",
    databaseURL: "https://phonebook-tius-default-rtdb.firebaseio.com",
    projectId: "phonebook-tius",
    storageBucket: "phonebook-tius.firebasestorage.app",
    messagingSenderId: "586981446050",
    appId: "1:586981446050:web:4d93b0a39fc4911d03e2fb"
};

// Inisialisasi Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const auth = getAuth(app);

// Elemen DOM
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

// Status pengguna saat ini
let currentUser = null;
let currentContactId = null;

// Inisialisasi aplikasi
function init() {
    // Memeriksa apakah pengguna sudah login
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

    // Inisialisasi PWA
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('sw.js')
                .then(registration => {
                    console.log('Registrasi ServiceWorker berhasil');
                })
                .catch(err => {
                    console.log('Registrasi ServiceWorker gagal: ', err);
                });
        });
    }
}

// Menampilkan layar login
function showLogin() {
    loginScreen.classList.remove('hidden');
    appContainer.classList.add('hidden');
}

// Menampilkan layar aplikasi
function showApp() {
    loginScreen.classList.add('hidden');
    appContainer.classList.remove('hidden');
}

// Beralih antar tab
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

// Menangani login
async function handleLogin(e) {
    e.preventDefault();
    const userid = document.getElementById('userid').value;
    const password = document.getElementById('password').value;

    try {
        // Menggunakan User ID langsung sebagai email karena Firebase Auth mengharapkannya dalam format email
        const email = userid; 
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        currentUser = userCredential.user;
        showApp();
        loadContacts();
        showToast('Login berhasil!');
    } catch (error) {
        // Menampilkan pesan error jika login gagal
        showToast(`Login gagal: ${error.message}`, true);
    }
}

// Menangani logout
function handleLogout() {
    signOut(auth).then(() => {
        currentUser = null;
        showLogin();
        showToast('Berhasil logout!');
    }).catch((error) => {
        showToast(`Logout gagal: ${error.message}`, true);
    });
}

// Memuat kontak dari Firebase
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
            contactsList.innerHTML = '<p class="no-contacts">Tidak ada kontak ditemukan. Tambahkan kontak pertama Anda!</p>';
        }
    } catch (error) {
        showToast(`Gagal memuat kontak: ${error.message}`, true);
    }
}

// Merender satu kontak
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

    // Menambahkan event listener ke tombol aksi
    contactCard.querySelector('.edit-btn').addEventListener('click', () => editContact(contactId));
    contactCard.querySelector('.delete-btn').addEventListener('click', () => deleteContact(contactId));
}

// Menyimpan kontak ke Firebase
async function saveContact(e) {
    e.preventDefault();
    
    if (!currentUser) return;

    const name = document.getElementById('name').value;
    if (!name) {
        showToast('Nama wajib diisi!', true);
        return;
    }

    // Mengumpulkan nomor telepon
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
                label: label || `Telepon ${index + 1}`
            });
        }
    });

    if (!hasPhone) {
        showToast('Setidaknya satu nomor telepon wajib diisi!', true);
        return;
    }

    // Mengumpulkan email
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
            // Memperbarui kontak yang sudah ada
            await update(child(dbRef, currentContactId), contactData);
            showToast('Kontak berhasil diperbarui!');
        } else {
            // Menambahkan kontak baru
            const newContactRef = push(dbRef);
            await set(newContactRef, contactData);
            showToast('Kontak berhasil ditambahkan!');
        }
        
        resetForm();
        switchTab('contacts');
    } catch (error) {
        showToast(`Gagal menyimpan kontak: ${error.message}`, true);
    }
}

// Mengedit kontak
async function editContact(contactId) {
    try {
        const dbRef = ref(database);
        const snapshot = await get(child(dbRef, `users/${currentUser.uid}/contacts/${contactId}`));
        
        if (snapshot.exists()) {
            const contact = snapshot.val();
            currentContactId = contactId;
            
            // Mengatur nilai form
            document.getElementById('name').value = contact.name;
            
            // Mengosongkan field telepon dan email yang ada
            document.querySelectorAll('.phone-number-group:not(:first-child)').forEach(el => el.remove());
            document.querySelectorAll('.email-group:not(:first-child)').forEach(el => el.remove());
            
            // Mengatur nomor telepon
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
            
            // Mengatur email
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
        showToast(`Gagal mengedit kontak: ${error.message}`, true);
    }
}

// Menghapus kontak
async function deleteContact(contactId) {
    // Mengganti confirm() dengan modal kustom jika diperlukan di lingkungan produksi
    if (!confirm('Apakah Anda yakin ingin menghapus kontak ini?')) return;
    
    try {
        const dbRef = ref(database, `users/${currentUser.uid}/contacts/${contactId}`);
        await remove(dbRef);
        showToast('Kontak berhasil dihapus!');
        loadContacts();
    } catch (error) {
        showToast(`Gagal menghapus kontak: ${error.message}`, true);
    }
}

// Mencari kontak
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
                contactsList.innerHTML = '<p class="no-contacts">Tidak ada kontak yang cocok ditemukan.</p>';
            }
        } else {
            contactsList.innerHTML = '<p class="no-contacts">Tidak ada kontak ditemukan.</p>';
        }
    } catch (error) {
        showToast(`Gagal mencari kontak: ${error.message}`, true);
    }
}

// Menambahkan field nomor telepon
function addPhoneField() {
    const container = document.querySelector('.phone-numbers-container');
    const newGroup = document.createElement('div');
    newGroup.className = 'phone-number-group';
    newGroup.innerHTML = `
        <input type="tel" class="phone-number" placeholder="Nomor telepon">
        <input type="text" class="phone-label" placeholder="Label (misalnya, Seluler, Kantor)">
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

// Menambahkan field email
function addEmailField() {
    const container = document.querySelector('.emails-container');
    const newGroup = document.createElement('div');
    newGroup.className = 'email-group';
    newGroup.innerHTML = `
        <input type="email" class="email" placeholder="Email">
        <input type="text" class="email-label" placeholder="Label (misalnya, Pribadi, Kantor)">
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

// Mereset form
function resetForm() {
    contactForm.reset();
    currentContactId = null;
    
    // Mereset nomor telepon (sisakan satu field)
    document.querySelectorAll('.phone-number-group:not(:first-child)').forEach(el => el.remove());
    const firstPhoneGroup = document.querySelector('.phone-number-group');
    firstPhoneGroup.querySelector('.phone-number').value = '';
    firstPhoneGroup.querySelector('.phone-label').value = '';
    
    // Mereset email (sisakan satu field)
    document.querySelectorAll('.email-group:not(:first-child)').forEach(el => el.remove());
    const firstEmailGroup = document.querySelector('.email-group');
    firstEmailGroup.querySelector('.email').value = '';
    firstEmailGroup.querySelector('.email-label').value = '';
}

// Menampilkan pesan toast
function showToast(message, isError = false) {
    toast.textContent = message;
    toast.className = isError ? 'toast error' : 'toast';
    toast.classList.remove('hidden');
    
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}

// Inisialisasi aplikasi saat DOM dimuat
document.addEventListener('DOMContentLoaded', init);
