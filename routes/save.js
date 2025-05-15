const express = require("express");
const router = express.Router();
const cors = require("cors");
const Data = require("../models/Data");
const File = require("../models/File");
const CoPoMapping = require("../models/CoPoMapping");
 

require("dotenv").config();

const corsOptions = {
  origin: "http://localhost:5173",
};

router.post("/delete/:PageID/:id", cors(corsOptions), async (req, res) => {
  try {
    const { PageID, id } = req.params;
    const { userID, year } = req.body;

    const doc = await Data.findOne({ userID, pageID: PageID, year });

    if (!doc) {
      return res.status(404).json({ error: "Document not found" });
    }

    const fileID = doc.formData[id][1].fileUploaded;
    //console.log(fileID);
    if (fileID) {
      await File.deleteOne({ _id: fileID });
    }

    doc.formData.splice(id, 1);

    await doc.save();

    res.status(200).json({
      message: "Record and associated file deleted successfully",
      remainingRecords: doc.formData,
    });
  } catch (error) {
    console.error("Error during record deletion: ", error);
    res
      .status(500)
      .json({ error: "An error occurred while deleting the record" });
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
    console.log("CO-PO Mapping Data:", req.body);
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
    console.error("Error during form data saving: ", error);
    res.status(500).json({ error: "An error occurred while saving the data" });
  }
});




module.exports = router;
