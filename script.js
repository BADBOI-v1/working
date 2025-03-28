
document.addEventListener('DOMContentLoaded', () => {
    const homeSection = document.getElementById('home');
    const downloadsSection = document.getElementById('downloads');
    const accountSection = document.getElementById('account');
    const searchSection = document.getElementById('search');
    const fileContainer = document.getElementById('file-container');
    const searchInput = document.getElementById('search-input');
    const searchButton = document.getElementById('search-button');
    const searchResults = document.getElementById('search-results');
    const loginLink = document.getElementById('login-link');
    const loginModal = document.getElementById('login-modal');
    const modalClose = document.querySelector('.close');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const adminLoginForm = document.getElementById('admin-login-form');
    const loginSubmit = document.getElementById('login-submit');
    const registerSubmit = document.getElementById('register-submit');
    const adminLoginSubmit = document.getElementById('admin-login-submit');
    const accountUsername = document.getElementById('account-username');
    const accountFollowers = document.getElementById('account-followers');
    const accountFollowing = document.getElementById('account-following');

    // Mock user data and file data (replace with actual data fetching later)
    let currentUser = null;
    const files = [
        { name: 'Document 1', url: 'document1.pdf' },
        { name: 'Image 2', url: 'image2.jpg' },
        { name: 'Audio File 3', url: 'audio3.mp3' }
    ];
    const users = [];
    let isAdminLoggedIn = false;

    // Function to hide all sections
    function hideAllSections() {
        homeSection.classList.add('hidden');
        downloadsSection.classList.add('hidden');
        accountSection.classList.add('hidden');
        searchSection.classList.add('hidden');
    }

    // Function to display a section
    function showSection(sectionId) {
        hideAllSections();
        document.getElementById(sectionId).classList.remove('hidden');
    }

    //Navigation
    document.querySelector('nav').addEventListener('click', function(event) {
        if (event.target.tagName === 'A') {
            event.preventDefault();
            const target = event.target.getAttribute('href').substring(1); // remove the '#'
            showSection(target);
        }
    });


    // Function to display files as circles
    function displayFiles(filesToDisplay) {
        fileContainer.innerHTML = ''; // Clear existing files
        filesToDisplay.forEach(file => {
            const fileCircle = document.createElement('a');
            fileCircle.classList.add('file-circle');
            fileCircle.href = file.url; // Set download link
            fileCircle.textContent = file.name;
            fileCircle.download = file.name;  // Suggest a filename for download
            fileContainer.appendChild(fileCircle);
        });
    }

    // Initial file display
    displayFiles(files);

    // Search Functionality
    searchButton.addEventListener('click', () => {
        const searchTerm = searchInput.value.toLowerCase();
        const filteredFiles = files.filter(file => file.name.toLowerCase().includes(searchTerm));
        displayFiles(filteredFiles);
    });

    // Account Section Update (Mock Data)
    function updateAccountInfo() {
        if (currentUser) {
            accountUsername.textContent = currentUser.username;
            accountFollowers.textContent = currentUser.followers.length;
            accountFollowing.textContent = currentUser.following.length;
        } else {
            accountUsername.textContent = 'Not logged in';
            accountFollowers.textContent = 'N/A';
            accountFollowing.textContent = 'N/A';
        }
    }

    // Login/Registration Modal
    loginLink.addEventListener('click', (e) => {
        e.preventDefault();
        loginModal.style.display = "block";
        hideAllSections();  // Hide all sections when modal opens
    });

    modalClose.addEventListener('click', () => {
        loginModal.style.display = "none";
        showSection('home'); // Go back to the home section after closing modal
    });

    window.addEventListener('click', (event) => {
        if (event.target == loginModal) {
            loginModal.style.display = "none";
            showSection('home'); // Go back to the home section after closing modal
        }
    });

    // Login Form Submission
    loginSubmit.addEventListener('click', () => {
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;

        // Mock Authentication (Replace with server-side authentication)
        const user = users.find(u => u.username === username && u.password === password);
        if (user) {
            currentUser = user;
            updateAccountInfo();
            loginModal.style.display = "none";
            showSection('account');
        } else {
            alert('Invalid username or password');
        }
    });

    // Registration Form Submission
    registerSubmit.addEventListener('click', () => {
        const username = document.getElementById('register-username').value;
        const password = document.getElementById('register-password').value;
        const confirmPassword = document.getElementById('register-confirm-password').value;

        if (password !== confirmPassword) {
            alert('Passwords do not match');
            return;
        }

        // Mock User Creation (Replace with server-side user creation)
        const newUser = {
            username: username,
            password: password,
            followers: [],
            following: []
        };
        users.push(newUser);
        alert('Registration successful! Please log in.');
    });

    // Admin Login Form Submission
    adminLoginSubmit.addEventListener('click', () => {
        const adminUsername = document.getElementById('admin-username').value;
        const adminPassword = document.getElementById('admin-password').value;

        if (adminUsername === 'kingbadboi' && adminPassword === '001') {
            isAdminLoggedIn = true;
            loginModal.style.display = "none";
            alert('Admin login successful!');
            // Redirect to admin panel or display admin options (not implemented here)
        } else {
            alert('Invalid admin username or password');
        }
    });

    // Initial Section Display (Show Home initially)
    showSection('home');
});
