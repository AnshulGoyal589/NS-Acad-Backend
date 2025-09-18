const express = require("express");
const router = express.Router();
const cors = require("cors");
const Data = require("../models/Data");
const File = require("../models/File");
const CoPoMapping = require("../models/CoPoMapping");
 

require("dotenv").config();

const corsOptions = {
  origin: process.env.FRONTEND_URL,
};

router.post("/delete/:PageID/:id", cors(corsOptions), async (req, res) => {
  try {
    const { PageID, id } = req.params;
    const { userID, year } = req.body;
    
    // Convert id to number and validate
    const recordIndex = parseInt(id, 10);
    if (isNaN(recordIndex)) {
      return res.status(400).json({ error: "Invalid record ID format" });
    }
    
    // Ensure we have a year
    const academicYear = year || new Date().getFullYear();
    
    // console.log(`Deleting record - PageID: ${PageID}, recordIndex: ${recordIndex}, userID: ${userID}, year: ${academicYear}`);

    // Find the document
    const doc = await Data.findOne({ userID, pageID: PageID, year: academicYear });

    if (!doc) {
      // console.log(`Document not found for userID: ${userID}, pageID: ${PageID}, year: ${academicYear}`);
      return res.status(404).json({ error: "Document not found" });
    }
    
    // Check if formData exists and has the requested index
    if (!doc.formData || !Array.isArray(doc.formData) || recordIndex >= doc.formData.length) {
      // console.log(`Record at index ${recordIndex} not found in formData array`);
      return res.status(404).json({ error: "Record not found at specified index" });
    }

    // Get the file ID to delete
    let fileID = null;
    try {
      const recordData = doc.formData[recordIndex];
      if (Array.isArray(recordData)) {
        // Look for an object with fileUploaded property in the array
        for (const item of recordData) {
          if (item && typeof item === 'object') {
            if ('fileUploaded' in item) {
              fileID = item.fileUploaded;
              break;
            }
          }
        }
      } else if (recordData && typeof recordData === 'object') {
        // If the record is a single object (not an array)
        if ('fileUploaded' in recordData) {
          fileID = recordData.fileUploaded;
        }
      }
      
      // console.log(`Extracted fileID: ${fileID || 'None found'} from record`);
    } catch (err) {
      console.error("Error extracting file ID:", err);
      console.error("Record data structure:", JSON.stringify(doc.formData[recordIndex] || null, null, 2));
      // Continue even if we couldn't get the file ID
    }

    // Delete the file if we found an ID
    if (fileID) {
      try {
        await File.deleteOne({ _id: fileID });
        // console.log(`Deleted file with ID: ${fileID}`);
      } catch (fileErr) {
        console.error("Error deleting file:", fileErr);
        // Continue even if file deletion fails
      }
    }

    // Remove the record from formData
    doc.formData.splice(recordIndex, 1);
    await doc.save();
    // console.log(`Record successfully deleted, ${doc.formData.length} records remaining`);

    res.status(200).json({
      message: "Record and associated file deleted successfully",
      remainingRecords: doc.formData,
    });
  } catch (error) {
    console.error("Error during record deletion: ", error);
    res.status(500).json({ error: "An error occurred while deleting the record" });
  }
});
router.post('/co-po-mappings', async (req, res) => {
  try {
    const {
      facultyId,
      subjectCode,
      subjectName,
      academicYear,
      semester,
      branch,
      section,
      courseOutcomes
    } = req.body;
    // console.log("CO-PO Mapping Data:", req.body);
    // Create or update the mapping
    const filter = { subjectCode, academicYear, semester, branch, section };

    const update = {
      facultyId,
      subjectCode,
      subjectName,
      academicYear,
      semester,
      branch,
      section,
      courseOutcomes,
      updatedAt: new Date()
    };

    const options = { upsert: true, new: true, setDefaultsOnInsert: true };

    const doc = await CoPoMapping.findOneAndUpdate(filter, update, options);

    res.status(200).json({
      message: 'Data saved successfully',
      doc
    });

  } catch (error) {
    console.error('Error saving CO-PO Mapping:', error);
    res.status(500).json({
      message: 'Error saving CO-PO Mapping',
      error: error.message
    });
  }
});
router.post("/:PageID", cors(corsOptions), async (req, res) => {
  try {
    const { PageID } = req.params;
    const { userID, data, year } = req.body;

    // Default to current year if not provided
    const academicYear = year || new Date().getFullYear();

    let doc = await Data.findOne({ userID, pageID: PageID, year: academicYear });

    if (doc) {
      doc.formData.push(data);
      await doc.save();
    } else {
      doc = new Data({
        pageID: PageID,
        userID: userID,
        year: academicYear,
        formData: [data],
      });
      await doc.save();
    }
    res.status(200).json({ message: "Data saved successfully", doc });
  } catch (error) {
    console.error("Error during the form data saving: ", error);
    res.status(500).json({ error: "An error occurred while saving the data" });
  }
});




module.exports = router;
