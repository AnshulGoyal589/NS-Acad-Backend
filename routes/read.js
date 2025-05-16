const express = require('express');
const router = express.Router();
const cors = require('cors');
const Data = require('../models/Data');
const User = require('../models/User');
const CoPoMapping = require('../models/CoPoMapping');
require('dotenv').config();

const corsOptions = {
  origin: 'http://localhost:5173'
};    

router.post('/:PageID', cors(corsOptions), async (req, res) => {
  const { PageID } = req.params;
  const { userID, year } = req.body;
  try {
    // Build the query object
    const query = { userID: userID, pageID: PageID };
    
    // If year is provided, convert to number and add to query
    if (year) {
      query.year = parseInt(year, 10);
    }
    
    console.log(`PageID: ${PageID}, UserID: ${userID}, Year: ${year}, Query:`, query);
    
    const data = await Data.find(query);
    console.log(`Found Data:`, data);
    
    // Always return an array, even if no data is found
    let formdata = [];
    if (data.length > 0 && data[0].formData) {
      formdata = data[0].formData;
    }
    
    // Ensure we're returning an array
    if (!Array.isArray(formdata)) {
      formdata = [];
    }
    
    res.status(200).json(formdata);
  
  } catch (error) {
    console.error('Error during form data reading: ', error);
    res.status(500).json({ error: 'An error occurred while retrieving the data' });
  }
});

// New endpoint to fetch data for all years for a given PageID
router.post('/:PageID/all', cors(corsOptions), async (req, res) => {
  const { PageID } = req.params;
  const { userID } = req.body;
  
  try {
    // Build the query object - only filter by userID and pageID, no year filter
    const query = { userID: userID, pageID: PageID };
    
    console.log(`All Years Request - PageID: ${PageID}, UserID: ${userID}, Query:`, query);
    
    // Find all documents matching the query
    const data = await Data.find(query);
    console.log(`Found ${data.length} documents across all years`);
    
    // Extract and combine all formData from all years
    let allFormData = [];
    
    data.forEach(item => {
      if (item.formData && Array.isArray(item.formData)) {
        // Add the year to each entry for reference
        const yearData = item.formData.map(entry => {
          // If entry is array, add year to each item in the array
          if (Array.isArray(entry)) {
            // Add a year field to the last object in the array (assuming fileUploaded is there)
            const lastIndex = entry.length - 1;
            const yearObj = { yearAdded: item.year };
            entry.splice(lastIndex, 0, yearObj);
            return entry;
          }
          return entry;
        });
        
        allFormData = [...allFormData, ...yearData];
      }
    });
    
    console.log(`Combined ${allFormData.length} entries from all years`);
    
    // Sort by most recent entries first (assuming timestamp might be present)
    allFormData.sort((a, b) => {
      // If entries have timestamps, sort by timestamp
      if (a.timestamp && b.timestamp) {
        return new Date(b.timestamp) - new Date(a.timestamp);
      }
      return 0; // Keep original order if no timestamp
    });
    
    res.status(200).json(allFormData);
  } catch (error) {
    console.error('Error during all years form data reading: ', error);
    res.status(500).json({ error: 'An error occurred while retrieving data for all years' });
  }
});

router.post('/multipage', cors(corsOptions), async (req, res) => {
  const { userID, pageIDs, year } = req.body;
    
  try {
    const query = {
      userID: userID,
      pageID: { $in: pageIDs }
    };
    
    // Add year filter if provided
    if (year) {
      query.year = year;
    }

    const data = await Data.find(query);

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


// New endpoint to fetch academic years with data
router.post('/available-years', cors(corsOptions), async (req, res) => {
  const { userID, department } = req.body;
  
  try {
    let query = {};
    
    // Filter based on userID or department
    if (userID) {
      query.userID = userID;
    } else if (department) {
      // Get all faculty users in the department
      const facultyMembers = await User.find({
        department,
        role: 'faculty'
      }).select('username');
      
      const facultyIds = facultyMembers.map(faculty => faculty.username);
      query.userID = { $in: facultyIds };
    }
    
    // Find distinct years
    const years = await Data.distinct('year', query);
    
    // Sort years in descending order
    years.sort((a, b) => b - a);
    
    res.status(200).json(years);
  } catch (error) {
    console.error('Error fetching available years:', error);
    res.status(500).json({ error: 'An error occurred while retrieving academic years' });
  }
});

router.post('/faculty/details', cors(corsOptions), async (req, res) => {
  const { userId, year } = req.body;
  try {
    const query = {userID: userId};
    
    // Add year filter if provided
    if (year) { 
      query.year = year;
    }
   
    const data = await Data.find(query);
    console.log("Faculty Data:", data);
    res.status(200).json(data);
  
  } catch (error) {
    console.error('Error during form data reading: ', error);
    res.status(500).json({ error: 'An error occurred while retrieving the data' });
  }
});

// New endpoint to fetch all department documents for a specific year
router.post('/department/documents', cors(corsOptions), async (req, res) => {
  const { department, year, pageIDs } = req.body;
  console.log("Department:", department, "Year:", year, "PageIDs:", pageIDs);
  try {
    // Validate required parameters
    if (!department) {
      return res.status(400).json({ error: 'Department is required' });
    }
    
    // Get all faculty users in the department - simplified approach
    const facultyMembers = await User.find({
      department,
      role: 'faculty'
    }).select('username fullname email');
    
    console.log(facultyMembers);
    
    if (!facultyMembers || facultyMembers.length === 0) {
      return res.status(404).json({ error: 'No faculty members found in this department' });
    }
    
    // Get all usernames from faculty members
    const userIDs = facultyMembers.map(faculty => faculty.username);
    
    // Create a map for quick faculty lookup
    const facultyMap = {};
    facultyMembers.forEach(faculty => {
      facultyMap[faculty.username] = {
        _id: faculty._id,
        fullname: faculty.fullname,
        email: faculty.email
      };
    });
    
    // Build the query - similar to faculty/details approach
    let query = {
      userID: { $in: userIDs }
    };
    
    // Add year filter if provided
    if (year && year !== 'null' && year !== 'undefined') {
      query.year = parseInt(year, 10);
    }
    
    // Add pageID filter if provided
    if (pageIDs && Array.isArray(pageIDs) && pageIDs.length > 0) {
      query.pageID = { $in: pageIDs };
    }
    
    console.log('Query:', JSON.stringify(query));
    
    // Find all documents matching the criteria - simplified from faculty/details
    const documents = await Data.find(query);
    console.log(`Found ${documents.length} documents`);
    
    // Format the documents with faculty information
    const enhancedDocuments = documents.map(doc => {
      const faculty = facultyMap[doc.userID] || {};
      return {
        id: doc._id,
        type: doc.pageID,
        title: doc.title || doc.pageID,
        year: doc.year,
        date: doc.date,
        facultyId: doc.userID,
        facultyName: faculty.fullname || doc.userID,
        facultyEmail: faculty.email || '',
        status: doc.status || 'completed',
        data: doc.formData
      };
    });
    
    res.status(200).json(enhancedDocuments);
  } catch (error) {
    console.error('Error fetching department documents:', error);
    res.status(500).json({ error: 'An error occurred while retrieving department documents' });
  }
});

// New endpoint specifically for HOD dashboard documents
// router.post('/hod/dashboard/documents', cors(corsOptions), async (req, res) => {
//   const { department, year } = req.body;
//   console.log("Dashboard request - Department:", department, "Year:", year);
  
//   try {
//     // Get all faculty in the department
//     const facultyMembers = await User.find({
//       department,
//       role: 'faculty'
//     }).select('_id username fullname email');
//     console.log("Faculty members:", facultyMembers);
//     if (!facultyMembers || facultyMembers.length === 0) {
//       return res.status(200).json([]); // Return empty array if no faculty
//     }
    
//     // Get usernames for query
//     const usernames = facultyMembers.map(f => f.username);
//     console.log("Faculty usernames:", usernames);
    
//     // Create faculty lookup map
//     const facultyMap = {};
//     facultyMembers.forEach(f => {
//       facultyMap[f.username] = {
//         id: f._id,
//         fullname: f.fullname,
//         email: f.email
//       };
//     });
    
//     // Build query
//     const query = { userID: { $in: usernames } };
    
//     // Add year if specified
//     if (year && year !== 'null' && year !== 'undefined' && year !== 'overall') {
//       query.year = parseInt(year, 10);
//     }
    
//     console.log("Document query:",  query);
    
//     // Fetch documents
//     const documents = await Data.find(query);
//     console.log(`Found ${documents.length} documents`);
    
//     // Format response
//     const formattedDocs = documents.map(doc => ({
//       id: doc._id,
//       type: doc.pageID,
//       title: doc.title || doc.pageID,
//       year: doc.year,
//       date: doc.date,
//       facultyId: doc.userID,
//       facultyName: facultyMap[doc.userID]?.fullname || doc.userID,
//       facultyEmail: facultyMap[doc.userID]?.email || '',
//       status: doc.status || 'completed',
//       data: doc.formData
//     }));
    
//     res.status(200).json(formattedDocs);
//   } catch (error) {
//     console.error("Error fetching dashboard documents:", error);
//     res.status(500).json({ error: 'Failed to fetch dashboard documents' });
//   }
// });
// router.post('./hod/dashboard/documents', cors(corsOptions), async (req, res) => {
//   const { department, year, userId } = req.body;
//   console.log("Dashboard request - Department:", department, "Year:", year, "UserId:", userId);
  
//   try {
//     let query = {};

//     // If searching by userId, prioritize that over department filtering
//     if (userId) {
//       query.userID = userId;  // Direct lookup by user ID
//     } else if (department) {
//       // Get all faculty in the department
//       const facultyMembers = await User.find({
//         department,
//         role: 'faculty'
//       }).select('_id fullname email'); // Fetch _id instead of username

//       if (!facultyMembers.length) {
//         return res.status(200).json([]); // No faculty found
//       }

//       // Extract faculty IDs
//       const facultyIds = facultyMembers.map(f => f._id.toString());  // Convert ObjectId to string
//       query.userID = { $in: facultyIds };  // Use MongoDB ObjectIds instead of usernames

//       // Create faculty lookup map
//       var facultyMap = {};
//       facultyMembers.forEach(f => {
//         facultyMap[f._id.toString()] = {
//           id: f._id,
//           fullname: f.fullname,
//           email: f.email
//         };
//       });
//     }

//     // Add year filter if provided
//     if (year && year !== 'null' && year !== 'undefined' && year !== 'overall') {
//       query.year = parseInt(year, 10);
//     }

//     console.log("Document query:", JSON.stringify(query));

//     // Fetch documents
//     const documents = await Data.find(query);
//     console.log(`Found ${documents.length} documents`);

//     // Format response
//     const formattedDocs = documents.map(doc => ({
//       id: doc._id,
//       type: doc.pageID,
//       title: doc.title || doc.pageID,
//       year: doc.year,
//       date: doc.date,
//       facultyId: doc.userID,
//       facultyName: facultyMap?.[doc.userID]?.fullname || doc.userID,
//       facultyEmail: facultyMap?.[doc.userID]?.email || '',
//       status: doc.status || 'completed',
//       data: doc.formData
//     }));
 
//     res.status(200).json(formattedDocs);
//   } catch (error) {
//     console.error("Error fetching dashboard documents:", error);
//     res.status(500).json({ error: 'Failed to fetch dashboard documents' });
//   }
// });
 

router.post('/hod/dashboard/documents', cors(corsOptions), async (req, res) => {
  const { department, year, userId } = req.body;
  console.log("Dashboard request - Department:", department, "Year:", year, "UserId:", userId);
  
  try {
    let query = {};

    // If searching by userId, prioritize that over department filtering
    if (userId) {
      query.userID = userId;  // Direct lookup by user ID
    } else if (department) {
      // Get all faculty in the department
      const facultyMembers = await User.find({
        department,
        role: 'faculty'
      }).select('_id fullname email'); // Fetch _id instead of username

      if (!facultyMembers.length) {
        return res.status(200).json([]); // No faculty found
      }

      // Extract faculty IDs
      const facultyIds = facultyMembers.map(f => f._id.toString());  // Convert ObjectId to string
      query.userID = { $in: facultyIds };  // Use MongoDB ObjectIds instead of usernames

      // Create faculty lookup map
      var facultyMap = {};
      facultyMembers.forEach(f => {
        facultyMap[f._id.toString()] = {
          id: f._id,
          fullname: f.fullname,
          email: f.email
        };
      });
    }

    // Add year filter if provided
    if (year && year !== 'null' && year !== 'undefined' && year !== 'overall') {
      query.year = parseInt(year, 10);
    }

    console.log("Document query:", JSON.stringify(query));

    // Fetch documents
    const documents = await Data.find(query);
    console.log(`Found ${documents.length} documents`);

    // Format response, ensuring year is included
    const formattedDocs = documents.map(doc => ({
      id: doc._id,
      type: doc.pageID,
      title: doc.title || doc.pageID,
      year: doc.year || new Date().getFullYear(), // Use year from DB or current year as fallback
      date: doc.date,
      facultyId: doc.userID,
      facultyName: facultyMap?.[doc.userID]?.fullname || doc.userID,
      facultyEmail: facultyMap?.[doc.userID]?.email || '',
      status: doc.status || 'completed',
      data: doc.formData
    }));

    res.status(200).json(formattedDocs);
  } catch (error) {
    console.error("Error fetching dashboard documents:", error);
    res.status(500).json({ error: 'Failed to fetch dashboard documents' });
  }
});


router.get('/co-po-mappings', async (req, res) => {
  try {
    const subjectCodeParam = req.query.subjectCode;

    if (!subjectCodeParam) {
      return res.status(400).json({ message: 'Subject code query parameter is required.' });
    }

    console.log('Searching for mappings with subjectCode:', subjectCodeParam);

    const mappings = await CoPoMapping.find({ subjectCode: subjectCodeParam });

    if (!mappings || mappings.length === 0) {
      console.log('No mappings found for subject code:', subjectCodeParam);
      return res.status(404).json({ message: `No CO-PO mappings found for subject code: ${subjectCodeParam}` });
    }

    console.log(`Found ${mappings.length} mapping(s) for subject code: ${subjectCodeParam}`);
    res.status(200).json(mappings);

  } catch (error) {
    console.error('Error fetching CO-PO Mappings by subject code:', error);
    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
});

router.get('/copomap', async (req, res) => {
  try {
    const mappings = await CoPoMapping.find({}); // Fetches everything from the collection

    if (!mappings || mappings.length === 0) {
      return res.status(404).json({ message: 'No CO-PO mappings found in the database.' });
    }

    console.log(`Fetched ${mappings.length} CO-PO mapping(s) from database:`);
    console.dir(mappings, { depth: null }); // Logs full structure

    res.status(200).json(mappings); // Return all mappings to client
  } catch (error) {
    console.error('Error fetching all CO-PO mappings:', error);
    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
});


module.exports = router;
