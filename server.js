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

mongoose.connect(process.env.MONGO_URL, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('Connected to the database');
  })
  .catch((error) => {
    console.error('Connection failed:', error);
    process.exit(1);
  });
 
const sessionConfig = { 
  secret: 'weneedagoodsecret',
  resave: false,
  saveUninitialized: true,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
};

app.use(cors({
  // origin: 'http://localhost:5173',
  // origin: 'https://ns-acad-frontend-copy.vercel.app',
  origin: '*',
  credentials: true, 
}));


app.use(cookieParser('weneedagoodsecret'));
app.use(session(sessionConfig));
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(upload.any());


app.use(passport.initialize()); 
app.use(passport.session());
 

passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser()); 
passport.deserializeUser(User.deserializeUser());

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
});
 
