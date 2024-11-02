const express = require('express');
const router = express.Router();
const cors = require('cors');
const Data = require('../models/Data');
const User = require('../models/User');
require('dotenv').config();

const corsOptions = {
  origin: 'http://localhost:5173'
};    

router.post('/:PageID', cors(corsOptions), async (req, res) => {
  const { PageID } = req.params;
  const { userID } = req.body;
   
  try {
    const data = await Data.find({userID: userID, pageID: PageID});
    let formdata = null;
    if(data.length!=0)formdata = data[0].formData;
    res.status(200).json(formdata);
  
  } catch (error) {
    console.error('Error during form data reading: ', error);
    res.status(500).json({ error: 'An error occurred while retrieving the data' });
  }
});

router.post('/multipage', cors(corsOptions), async (req, res) => {
  const { userID, pageIDs } = req.body;
    
  try {
    

    const data = await Data.find({
      userID: userID,
      pageID: { $in: pageIDs }
    });

    const formDataByPage = {};
    data.forEach(item => {
      if (item.formData) {
        formDataByPage[item.pageID] = item.formData;
      }
    });

    res.status(200).json(formDataByPage);
  
  } catch (error) {
    console.error('Error during form data reading: ', error);
    res.status(500).json({ error: 'An error occurred while retrieving the data' });
  }
});

// router.get('/:userID', cors(corsOptions), async (req, res) => {
//   const { userID } = req.params; 
   
//   try{
//       const data = await User.findById(JSON.parse(userID).id); 
//       res.status(200).json(data.fullname);
//   }catch (error) {
//       console.error('Error during user data reading: ', error);
//       res.status(500).json({ error: 'An error occurred while retrieving the data of user' });
//   }

// });

module.exports = router;