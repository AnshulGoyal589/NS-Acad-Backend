// models/User.js (ensure ref is correct)
const mongoose = require('mongoose');
const passportLocalMongoose = require('passport-local-mongoose');
const Schema = mongoose.Schema; // Add this

const userSchema = new Schema({ // Use Schema constructor
  email: String,
  fullname: String,
  username: String,
  department: String,
  role: String,
  classes: [{
    _id: false, // Often not needed for subdocuments unless referenced elsewhere
    branch: String,
    section: String,
    // Consider making year a String like "2023-2024" for consistency? Or keep as Number.
    year: Number, // Or String, e.g., "III" or "3" - align with how you use it
    semester: Number, // Add semester here if relevant for subject assignment
    academicYear: String, // e.g., "2023-2024" - important for filtering
    subjects: [{
      _id: false,
      code: String,
      name: String,
      assessments: [{
        type: Schema.Types.ObjectId, // Corrected: Use Schema.Types.ObjectId
        ref: 'Assessment' // Ensure this matches the model name
      }]
    }]
  }]
});

userSchema.plugin(passportLocalMongoose);

const User = mongoose.model('User', userSchema);

module.exports = User;