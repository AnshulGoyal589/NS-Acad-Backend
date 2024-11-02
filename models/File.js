const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
 
    fileData:Buffer,
    fileName:String,
    user:String,
    department:String
     
});

const File = mongoose.model('File', fileSchema);

module.exports = File;