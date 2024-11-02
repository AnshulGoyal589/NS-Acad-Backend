const mongoose = require('mongoose');


const dataSchema = new mongoose.Schema({
  userID: String, 
  pageID:String,
  formData:[[mongoose.Schema.Types.Mixed]]
});


const Data = mongoose.model('Data', dataSchema);

module.exports = Data;  