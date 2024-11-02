const express = require('express');
const router = express.Router();
const cors = require('cors');
const User = require('../models/User');
const passport = require('passport');
require('dotenv').config();


const corsOptions = {
  origin: 'http://localhost:5173'
};    


router.post('/register', cors(corsOptions), async (req, res) => {
  try {

    const { fullname, email, department , username , password , role } = req.body;
    
    const existingUser = await User.findOne({ username });

    if (existingUser) {
      return res.status(400).json({ message: 'User already exists.' });
    } 
    
    const user = new User({ 
      fullname: fullname, 
      email: email,
      department:department,
      username:username,
      role: role 
    });

    const newUser = await User.register(user, password);
    res.status(201).json({ message: 'User registered successfully.', user: newUser });

  } catch (error) {
    console.error('Error during registration:', error);
    res.status(500).json({ message: 'Internal server error. Please try again later.' });
  }
});


router.post("/login", cors(corsOptions) , (req, res, next) => {
  passport.authenticate('local', (err, user, info) => { 
    if (err) {
      return res.status(500).json({ message: 'Internal server error. Please try again later.' });
    }
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid username or password.' });
    }

    req.logIn(user, (err) => {
      if (err) { 
        return res.status(500).json({ message: 'Internal server error. Please try again later.' });
      }
      
      res.json({ message: 'Login successful', user:req.user });
    });
  })(req, res, next);
});


module.exports = router;