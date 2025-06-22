const express = require('express');
const router = express.Router();
const cors = require('cors');
const File = require('../models/File');
require('dotenv').config();


const corsOptions = {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173' 
};    


router.get('/:fileid', cors(corsOptions), async (req, res) => {
    try {
      const {fileid} = req.params;
      await File.findByIdAndDelete(fileid);
      res.status(200).json({ message : 'File Deleted Successfully' });
  
    } catch (error) {
      console.error('Error during form file deleting: ', error);
      res.status(500).json({ error: 'An error occurred while deleting the file' });
    }
});

router.post('/upload/:userID', cors(corsOptions), async (req, res) => {
    try {
      const fileData = req.files[0];
      const {userID} = req.params;
      
 
      const newFile = new File({
        fileData: fileData.buffer,
        fileName: fileData.originalname,
        user: userID
      });
      const savedFile = await newFile.save();
      
      const fileId = savedFile._id;  
      res.status(200).json({fileId });
  
    } catch (error) {
      console.error('Error during form file saving: ', error);
      res.status(500).json({ error: 'An error occurred while saving the file' });
    }
});

router.get('/view/:pdfID', cors(corsOptions), async (req, res) => {
  try {
      const {pdfID} = req.params;
      const document = await File.findById(pdfID);
      if (!document || !document.fileData) {
        return res.status(404).send('PDF not found');
      }
      
      const base64pdf = document.fileData.toString('base64');
      res.json({ pdfData: base64pdf });
  
    } catch (error) {
      console.error('Error during form file saving: ', error);
      res.status(500).json({ error: 'An error occurred while saving the file' });
    }
});


module.exports = router;
