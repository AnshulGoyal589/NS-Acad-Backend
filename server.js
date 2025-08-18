const express = require('express');
const app = express();
const mongoose = require('mongoose');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const User = require("./models/User"); 
const cors = require('cors');
const multer = require('multer');
require('dotenv').config();   

const port = process.env.PORT || 8000;
const isProduction = process.env.NODE_ENV === 'production';

mongoose.connect(process.env.MONGO_URL, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('Connected to the database');
  })
  .catch((error) => {
    console.error('Connection failed:', error);
    process.exit(1);
  });

const corsOptions = {
  origin: ['https://ns-acad-frontend-copy.vercel.app', 'http://localhost:5173'],
  credentials: true, // Allow cookies to be sent
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

// --- Middleware Setup ---

// Trust the first proxy if in production. 
// This is crucial for `secure: true` cookies to work when your app is behind a reverse proxy (like on Vercel, Heroku, Render).
if (isProduction) {
  app.set('trust proxy', 1);
}

// Apply CORS middleware before any routes.
app.use(cors(corsOptions));

// Built-in Express middleware for parsing JSON and URL-encoded bodies.
// The separate `body-parser` package is no longer needed.
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cookie parser middleware
app.use(cookieParser(process.env.SESSION_SECRET || 'weneedagoodsecret'));

// --- Session Configuration (Environment-Aware) ---
const sessionConfig = { 
  secret: process.env.SESSION_SECRET || 'weneedagoodsecret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    httpOnly: true, // Prevent client-side JS from accessing the cookie
    // `secure` must be true in production for SameSite='none' to work.
    // In development (HTTP), it must be false, or the browser won't save the cookie.
    secure: isProduction,
    // `sameSite` must be 'none' for cross-origin cookies.
    // In development, 'lax' is safer and works since frontend/backend might be on the same domain technically (localhost).
    sameSite: isProduction ? 'none' : 'lax'
  }
};

app.use(session(sessionConfig));

// Multer middleware for handling multipart/form-data.
// NOTE: Using `upload.any()` globally means every request will be processed by multer, which can be inefficient.
// It's often better to apply this middleware only to the specific routes that handle file uploads.
const upload = multer();
app.use(upload.any());

// Passport middleware
app.use(passport.initialize()); 
app.use(passport.session());

// --- Passport Configuration ---
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser()); 
passport.deserializeUser(User.deserializeUser());

// --- Test Route ---
app.get('/test-cors', (req, res) => {
  res.json({ 
    message: 'CORS working!',
    origin: req.get('Origin'),
    allowedOrigins: corsOptions.origin,
    environment: isProduction ? 'production' : 'development',
    secureCookie: sessionConfig.cookie.secure,
    sameSiteCookie: sessionConfig.cookie.sameSite
  });
});

// --- API Routes ---
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

// --- Server Start ---
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
  console.log(`Running in ${isProduction ? 'production' : 'development'} mode.`);
  console.log(`CORS allows origins: ${corsOptions.origin}`);
});