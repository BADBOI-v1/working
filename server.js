const express = require('express');
const multer = require('multer');  // For file uploads
const path = require('path');
const fs = require('fs');

const app = express();
const port = 3000; // Or any port you prefer

// Middleware to serve static files (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, '/'))); // Serves files from the root directory

// Middleware for parsing JSON data (if needed)
app.use(express.json());

// Configure Multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'uploads'); // Directory to store uploads
        // Create the directory if it doesn't exist
        fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });


// **Mock Data (Replace with database later)**
let users = [];  // Array to hold user data
let files = [];  // Array to hold file data

// **Authentication (Very Basic, Replace with Proper Authentication)**
const ADMIN_USERNAME = 'kingbadboi';
const ADMIN_PASSWORD = '001';


// **Routes**

// Root Route (Serves the index.html)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// User Registration Endpoint
app.post('/register', (req, res) => {
    const { username, password } = req.body;

    // Check if username already exists (basic check)
    if (users.find(u => u.username === username)) {
        return res.status(400).send('Username already exists');
    }

    const newUser = {
        id: Date.now(), // Simple ID generation
        username,
        password, // **Important:** Hash the password before storing!
        followers: [],
        following: []
    };

    users.push(newUser);
    console.log('New user registered:', newUser);  // Log to console (for now)
    res.status(201).send('User registered successfully'); // 201 Created status
});

// User Login Endpoint
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username && u.password === password); // **Important: Use password hashing and comparison!**

    if (user) {
        // **Important: Implement proper session management or JWTs for authentication**
        res.status(200).json({ message: 'Login successful', user: { id: user.id, username: user.username } });
    } else {
        res.status(401).send('Invalid username or password'); // 401 Unauthorized status
    }
});

// Admin Login Endpoint
app.post('/admin/login', (req, res) => {
  const { username, password } = req.body;

  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    res.status(200).json({ message: 'Admin login successful' });
  } else {
    res.status(401).send('Invalid admin username or password');
  }
});


// File Upload Endpoint (Admin Only)
app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }

    const newFile = {
        id: Date.now(),
        filename: req.file.filename,
        originalname: req.file.originalname,
        path: req.file.path,  // Store the path to the uploaded file
        size: req.file.size,
        uploaderId: 1, // Link to the admin user (replace with actual admin ID)
        uploadDate: new Date()
    };

    files.push(newFile);
    console.log('File uploaded:', newFile);
    res.status(201).json({ message: 'File uploaded successfully', file: newFile });
});

// Get All Files Endpoint
app.get('/files', (req, res) => {
  //**TODO: Add Pagination and Filtering for Large Datasets**
  res.status(200).json(files);
});


// Start the server
app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});
