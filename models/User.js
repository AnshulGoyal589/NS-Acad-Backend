const mongoose = require('mongoose');
const passportLocalMongoose = require('passport-local-mongoose');

const userSchema = new mongoose.Schema({
  email: String,
  fullname:String,
  username:String, 
  department:String,
  role: String,
  classes: [
    {
      branch: String,
      section: String,
      year: Number 
    }
  ]

});

userSchema.plugin(passportLocalMongoose);  

const User = mongoose.model('User', userSchema);

module.exports = User;