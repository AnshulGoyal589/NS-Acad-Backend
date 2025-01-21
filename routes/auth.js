// auth.js
const express = require('express');
const router = express.Router();
const cors = require('cors');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const passport = require('passport');
require('dotenv').config();

const corsOptions = {
  origin: 'http://localhost:5173'
};


const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; 

  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

const generateToken = (user) => {
  return jwt.sign( 
    { 
      id: user._id, 
      role: user.role,
      department: user.department 
    },
    process.env.JWT_SECRET, 
    { expiresIn: '24h' }
  );
};

router.post('/register', cors(corsOptions), async (req, res) => {
  try {
    const { fullname, email, department, username, password, role } = req.body;
    
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists.' });
    } 
    
    const user = new User({ 
      fullname,
      email,
      department,
      username,
      role 
    });

    const newUser = await User.register(user, password);
    const token = generateToken(newUser);

    res.status(201).json({ 
      message: 'User registered successfully.',
      user: newUser,
      token 
    });
  } catch (error) {
    console.error('Error during registration:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

router.post("/login", cors(corsOptions), (req, res, next) => {
  passport.authenticate('local', (err, user, info) => { 
    if (err) {
      return res.status(500).json({ message: 'Internal server error.' });
    }
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    req.logIn(user, (err) => {
      if (err) { 
        return res.status(500).json({ message: 'Internal server error.' });
      }
      
      const token = generateToken(user);
      res.json({ 
        message: 'Login successful', 
        user,
        token
      });
    });
  })(req, res, next);
});
 
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json({ user });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/logout', (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

// Protected route example


router.get('/protected', authenticateToken, (req, res) => {
  res.json({ message: 'Protected route accessed', user: req.user });
});

module.exports = router;
