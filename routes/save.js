const express = require('express');
const router = express.Router();
const cors = require('cors');
const Data = require('../models/Data');
const File = require('../models/File');
require('dotenv').config();


const corsOptions = {
  origin: 'http://localhost:5173'
};    


router.post('/:PageID', cors(corsOptions), async (req, res) => {
    try {
      const { PageID } = req.params;
      const {userID,data} = req.body;
      
      let doc = await Data.findOne({ userID, pageID: PageID });
  
      if (doc) {
        doc.formData.push(data);
        await doc.save();
      } else {
        doc = new Data({
          pageID: PageID,
          userID: userID,
          formData: [data]  
        });
        await doc.save();
      }
      res.status(200).json({ message: 'Data saved successfully', doc });
  
    } catch (error) {
      console.error('Error during form data saving: ', error);
      res.status(500).json({ error: 'An error occurred while saving the data' });
    }
  });


module.exports = router;