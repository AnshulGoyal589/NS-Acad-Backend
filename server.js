// BACKEND SOLUTION - Replace your CORS configuration with this:

const express = require('express');
const app = express();
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const User = require("./models/User"); 
const cors = require('cors');
const multer = require('multer');
require('dotenv').config();   
const port = process.env.PORT || 8000;

const upload = multer();

// Database connection
mongoose.connect(process.env.MONGO_URL, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('Connected to the database');
  })
  .catch((error) => {
    console.error('Connection failed:', error);
    process.exit(1);
  });

// CORS Configuration - PLACE THIS BEFORE OTHER MIDDLEWARE
const corsOptions = {
  origin: function (origin, callback) {
    // Allow these origins
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:3000',
      'https://ns-acad-frontend-copy.vercel.app'
    ];
    
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) {
      return callback(null, true);
    }
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log(`CORS blocked origin: ${origin}`);
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With', 
    'Content-Type', 
    'Accept',
    'Authorization',
    'Cache-Control'
  ],
  exposedHeaders: ['Set-Cookie'],
  optionsSuccessStatus: 200 // Some legacy browsers choke on 204
};

// Apply CORS before other middleware
app.use(cors(corsOptions));

// Handle preflight requests explicitly
app.options('*', cors(corsOptions));

// Session configuration
const sessionConfig = { 
  secret: 'weneedagoodsecret',
  resave: false,
  saveUninitialized: false, // Changed to false for better security
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  }
};

// Middleware order is important
app.use(cookieParser('weneedagoodsecret'));
app.use(session(sessionConfig));
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(upload.any());
app.use(passport.initialize()); 
app.use(passport.session());

// Passport configuration
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser()); 
passport.deserializeUser(User.deserializeUser());

// Test route to verify CORS
app.get('/test-cors', (req, res) => {
  res.json({ 
    message: 'CORS is working!', 
    origin: req.get('Origin'),
    timestamp: new Date().toISOString()
  });
});

// Routes
const authApi = require('./routes/auth.js');  
const saveApi = require('./routes/save.js');
const readApi = require('./routes/read.js'); 
const fileApi = require('./routes/file.js');
const updateApi = require('./routes/update.js');
const assessmentRoutes = require('./routes/assessments');

app.use('/auth', authApi);
app.use('/save', saveApi);
app.use('/read', readApi);
app.use('/file', fileApi);
app.use('/update', updateApi);
app.use('/api/assessments', assessmentRoutes);

// Error handling middleware
app.use((error, req, res, next) => {
  if (error.message.includes('CORS')) {
    console.log('CORS Error:', error.message);
    res.status(403).json({ error: 'CORS policy violation' });
  } else {
    next(error);
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// FRONTEND SOLUTION - Make sure your fetch requests look like this:

/*
// Frontend fetch example:
const loginUser = async (credentials) => {
  try {
    const response = await fetch('https://ns-acad-backend.onrender.com/auth/login', {
      method: 'POST',
      credentials: 'include', // CRUCIAL for cookies/sessions
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(credentials)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
};
*/
