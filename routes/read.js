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


router.post('/faculty/list', cors(corsOptions), async (req, res) => {
  const { department } = req.body;
  try {
    const facultyMembers = await User.find({
      department,
      role: 'faculty'
    }).select('fullname email username');
    console.log(facultyMembers);
    res.status(200).json(facultyMembers);
  } catch (error) {
    console.error('Error fetching faculty list:', error); 
    res.status(500).json({ error: 'An error occurred while retrieving faculty list' });
  }
});

router.get('/classes', async (req, res) => {
  try {
    const users = await User.find({}, 'classes');
    
    const uniqueClasses = Array.from(new Set(
      users.flatMap(user => user.classes.map(cls => 
        JSON.stringify({ 
          branch: cls.branch, 
          section: cls.section, 
          year: cls.year,
          subjects: cls.subjects || []
        })
      ))
    )).map(str => JSON.parse(str));

    res.json(uniqueClasses);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching classes', error: error.message });
  }
});




router.post('/faculty/details', cors(corsOptions), async (req, res) => {
  const { userId } = req.body;
  try {
    const data = await Data.find({userID: userId});
    res.status(200).json(data);
  
  } catch (error) {
    console.error('Error during form data reading: ', error);
    res.status(500).json({ error: 'An error occurred while retrieving the data' });
  }
});



module.exports = router;
