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

// CORS Configuration - ONLY allow production frontend
const corsOptions = {
  origin: 'https://ns-acad-frontend-copy.vercel.app',
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
  optionsSuccessStatus: 200
};

console.log('CORS configured for:', corsOptions.origin);

// Apply CORS before any other middleware
app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));

// Session configuration for production
const sessionConfig = { 
  secret: process.env.SESSION_SECRET || 'weneedagoodsecret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    secure: true, // Always true for production (HTTPS)
    sameSite: 'none' // Required for cross-origin cookies
  }
};

// Apply middleware
app.use(cookieParser(process.env.SESSION_SECRET || 'weneedagoodsecret'));
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

// Test route
app.get('/test-cors', (req, res) => {
  res.json({ 
    message: 'CORS working - Production only!',
    origin: req.get('Origin'),
    allowedOrigin: corsOptions.origin,
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

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
  console.log(`CORS allows only: ${corsOptions.origin}`);
});
