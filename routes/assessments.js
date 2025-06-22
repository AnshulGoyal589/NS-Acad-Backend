const express = require("express");
const router = express.Router();
const cors = require("cors");
const mongoose = require('mongoose');
const Assessment = require("../models/Assessment"); // Adjust path if needed
const User = require("../models/User");           // Adjust path if needed

// Configure CORS - Adjust origin as necessary for production
const corsOptions = {
    origin: process.env.FRONTEND_URL || "http://localhost:5173", // Use env variable or default
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    credentials: true, // If you need cookies or authorization headers
    optionsSuccessStatus: 200
};

router.use(cors(corsOptions));
// Optional: Add body parsing middleware if not done globally in your app
// router.use(express.json());

// --- Middleware for Authentication/Authorization (Example Placeholder) ---
// const checkAuth = (req, res, next) => {
//    // Implement your logic: check JWT, session, etc.
//    // Check if user is faculty
//    if (!req.user || req.user.role !== 'faculty') {
//       return res.status(403).json({ error: "Forbidden: Access denied" });
//    }
//    // Check if the facultyId in the request matches the logged-in user
//    if (req.params.facultyId && req.params.facultyId !== req.user._id.toString()) {
//        // Or if facultyId is in body for POST
//        if(req.body.facultyId && req.body.facultyId !== req.user._id.toString()){
//           return res.status(403).json({ error: "Forbidden: Mismatched faculty ID" });
//        }
//    }
//    next();
// };
// router.use(checkAuth); // Apply auth middleware to all routes in this file


// --- Route to CREATE or UPDATE an Assessment ---
// Using POST for both create and update via upsert
router.post("/", async (req, res) => {
    try {
        const assessmentData = req.body;

        // --- Basic Validation ---
        if (!assessmentData || !assessmentData.facultyId || !assessmentData.subject?.code || !assessmentData.type || !assessmentData.academicYear || !assessmentData.semester || !assessmentData.branch || !assessmentData.section) {
            console.log("Validation Failed: ", assessmentData); // Log received data
            return res.status(400).json({ error: "Missing required assessment identifiers (facultyId, subjectCode, type, year, sem, branch, section)" });
        }
        if (!mongoose.Types.ObjectId.isValid(assessmentData.facultyId)) {
            return res.status(400).json({ error: "Invalid Faculty ID format" });
        }

        // --- Define the Unique Query for finding the document ---
        const query = {
            facultyId: assessmentData.facultyId,
            'subject.code': assessmentData.subject.code,
            academicYear: assessmentData.academicYear,
            semester: parseInt(assessmentData.semester, 10), // Ensure number
            branch: assessmentData.branch,
            section: assessmentData.section,
            type: assessmentData.type,
        };

        // Add type-specific identifiers to the query if they are part of uniqueness
        // Note: For TCA, we usually save/update the *entire* TCA record (CT1+CT2),
        // so assessmentNumber isn't typically part of the *unique query* itself.
        // The unique record IS the TCA for that subject/class/faculty.
        if (assessmentData.type === 'tms' && assessmentData.tmsType) {
            query.tmsType = assessmentData.tmsType;
        }
        // If assessmentNumber *is* meant to make TCA records unique (e.g., saving CT1 and CT2 as separate docs)
        // then add it here, but the React structure assumes saving them together.
        // if (assessmentData.type === 'tca' && assessmentData.assessmentNumber) {
        //     query.assessmentNumber = parseInt(assessmentData.assessmentNumber, 10);
        // }


        // --- Prepare the Update Payload ---
        // Use $set to update fields, ensuring atomicity and correct merging
        const update = {
            $set: {
                'subject.name': assessmentData.subject.name, // Update subject name too
                numberOfStudents: assessmentData.numberOfStudents,
                students: assessmentData.students, // Replace the whole students array
                // Update type-specific config
                ...(assessmentData.type === 'tms' && { tmsConfig: assessmentData.tmsConfig }),
                ...(assessmentData.type === 'tca' && { tcaConfig: assessmentData.tcaConfig }),
                ...(assessmentData.type === 'tes' && { tesConfig: assessmentData.tesConfig }),
                updatedAt: new Date() // Use $set for updatedAt as well
            },
             $setOnInsert: { // Fields set only when creating a new document
                facultyId: assessmentData.facultyId,
                'subject.code': assessmentData.subject.code,
                academicYear: assessmentData.academicYear,
                semester: parseInt(assessmentData.semester, 10),
                branch: assessmentData.branch,
                section: assessmentData.section,
                type: assessmentData.type,
                 ...(assessmentData.type === 'tms' && { tmsType: assessmentData.tmsType }),
                // ...(assessmentData.type === 'tca' && { assessmentNumber: assessmentData.assessmentNumber }), // Add if needed for uniqueness
                createdAt: new Date()
            }
        };

        const options = {
            upsert: true, // Create if not found, update if found
            new: true,    // Return the modified document after update/insert
            runValidators: true, // Run schema validations on update
            setDefaultsOnInsert: true // Apply schema defaults if creating
        };

        // Find and update or insert the assessment
        const savedAssessment = await Assessment.findOneAndUpdate(query, update, options);

        if (!savedAssessment) {
             // This should theoretically not happen with upsert: true unless there's a weird race condition or db issue
             console.error("Upsert failed unexpectedly for query:", query);
             return res.status(500).json({ error: "Failed to save or update assessment data." });
        }

        // --- Link Assessment to User (If created or ID not already present) ---
        if (mongoose.Types.ObjectId.isValid(savedAssessment.facultyId)) {
            try {
                // Update user in one go for efficiency
                const userUpdateResult = await User.updateOne(
                    {
                        _id: savedAssessment.facultyId,
                        'classes': { // Find the user with the specific class
                            $elemMatch: {
                                academicYear: savedAssessment.academicYear,
                                semester: savedAssessment.semester,
                                branch: savedAssessment.branch,
                                section: savedAssessment.section,
                                'subjects.code': savedAssessment.subject.code
                            }
                        }
                    },
                    { // Add the assessment ID to the correct subject's assessments array if not already present
                        $addToSet: { 'classes.$[classElem].subjects.$[subjElem].assessments': savedAssessment._id }
                    },
                    { // Array filters to target the correct nested elements
                        arrayFilters: [
                            { 'classElem.academicYear': savedAssessment.academicYear, 'classElem.semester': savedAssessment.semester, 'classElem.branch': savedAssessment.branch, 'classElem.section': savedAssessment.section },
                            { 'subjElem.code': savedAssessment.subject.code }
                        ]
                    }
                );

                if (userUpdateResult.matchedCount === 0) {
                    console.warn(`User (${savedAssessment.facultyId}) or specific class/subject combination not found for linking assessment ${savedAssessment._id}.`);
                    // Potentially add logic here to create the class/subject if it should exist but doesn't
                } else if (userUpdateResult.modifiedCount > 0) {
                    console.log(`Assessment ${savedAssessment._id} linked to user ${savedAssessment.facultyId}.`);
                } else {
                    // Matched but not modified likely means the ID was already there ($addToSet effect)
                     console.log(`Assessment ${savedAssessment._id} was already linked to user ${savedAssessment.facultyId}.`);
                }

            } catch (linkError) {
                 console.error(`Error linking assessment ${savedAssessment._id} to user ${savedAssessment.facultyId}:`, linkError);
                 // Decide if this error should fail the whole request. Usually no.
            }
        } else {
             console.warn(`Invalid facultyId (${savedAssessment.facultyId}) found in saved assessment ${savedAssessment._id}, skipping user link.`);
        }
        // --- End Linking ---


        res.status(200).json({ message: "Assessment data saved successfully", assessment: savedAssessment });

    } catch (error) {
        console.error("Error saving assessment data: ", error);
        if (error.name === 'ValidationError') {
             return res.status(400).json({ error: "Validation Error", details: error.message });
        }
        // Don't specifically check for 11000 here, as findOneAndUpdate with upsert handles uniqueness based on the query
        res.status(500).json({ error: "An error occurred while saving assessment data", details: error.message });
    }
});

// --- Route to GET Specific Assessment Data ---
// GET /api/assessments/:facultyId?type=...&subjectCode=... etc.
router.get("/:facultyId", async (req, res) => {
     try {
        const { facultyId } = req.params;
        const {
            type,
            // assessmentNumber, // Not typically used for GET if TCA is stored whole
            tmsType,          // For TMS
            subjectCode,
            branch,
            section,
            semester,
            academicYear
        } = req.query;

         // --- Validation ---
         if (!mongoose.Types.ObjectId.isValid(facultyId)) {
            return res.status(400).json({ error: "Invalid Faculty ID format" });
        }
        if (!type || !subjectCode || !academicYear || !semester || !branch || !section) {
             return res.status(400).json({ error: "Missing required query parameters (type, subjectCode, year, sem, branch, section)" });
        }

        // --- Build Query Object ---
        const query = { facultyId };
        query.type = type;
        query['subject.code'] = subjectCode;
        query.branch = branch;
        query.section = section;
        if (semester) query.semester = parseInt(semester, 10);
        query.academicYear = academicYear;

        // Add type-specific filters to the query
        if (type === 'tms' && tmsType) {
            query.tmsType = tmsType;
        }
        // If fetching individual TCA assessments was intended:
        // if (type === 'tca' && assessmentNumber) {
        //     query.assessmentNumber = parseInt(assessmentNumber, 10);
        // }

        // Use lean() for performance if you only need plain JS objects and don't need Mongoose document methods
        const assessmentData = await Assessment.findOne(query).lean();

        if (!assessmentData) {
            // Return null (or an empty object structure) if not found, allows frontend to initialize cleanly
            return res.status(200).json(null);
        }

        res.status(200).json(assessmentData);

    } catch (error) {
        console.error("Error fetching assessment data:", error);
        res.status(500).json({ error: "An error occurred while fetching assessment data", details: error.message });
    }
});


module.exports = router;
