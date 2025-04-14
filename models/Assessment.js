// models/Assessment.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Sub-schema for individual parts of a question (TMS/TES)
const QuestionPartSchema = new Schema({
    maxMarks: Number,
    coNumber: String, // e.g., 'CO1', 'CO2'
    marksObtained: Number // Could be -1 for TES 'not attempted'
}, { _id: false });

// Sub-schema for TMS questions
const TmsQuestionSchema = new Schema({
    partA: QuestionPartSchema,
    partB: QuestionPartSchema
}, { _id: false });

// Sub-schema for TES questions
const TesQuestionSchema = new Schema({
    partA: QuestionPartSchema,
    partB: QuestionPartSchema,
    partC: QuestionPartSchema
}, { _id: false });

// Sub-schema for TCA marks distribution per part
const TcaCoDistributionSchema = new Schema({}, { strict: false, _id: false }); // Allows dynamic keys like 'co1', 'co2'

// Sub-schema for TCA marks for a specific part (e.g., q1p1)
const TcaPartMarkSchema = new Schema({
    value: Number, // Actual marks entered for the part
    coDistribution: TcaCoDistributionSchema // Marks distributed per selected CO
}, { _id: false });

// Sub-schema for TCA marks for a single assessment (CT1 or CT2)
const TcaAssessmentMarkSchema = new Schema({
    assessmentNumber: Number, // 1 or 2
    marks: { // Keys will be like 'q1p1', 'q1p2', 'q2p1', 'q2p2'
        type: Map,
        of: TcaPartMarkSchema
    }
}, { _id: false });


// Sub-schema for individual student data within an assessment
const StudentAssessmentSchema = new Schema({
    rollNo: { type: String, required: true },
    name: { type: String, required: true },
    // Marks will vary based on assessment type
    tmsMarks: [{ // Usually only one entry per assessment type
        type: { type: String, enum: ['Tutorial', 'MiniProject', 'SurpriseTest'] }, // TMS type
        questions: [TmsQuestionSchema] // Array of 5 questions
    }],
    tesMarks: [{ // Usually only one entry
        questions: [TesQuestionSchema] // Array of 5 questions
    }],
    tcaMarks: [TcaAssessmentMarkSchema] // Can have entries for assessmentNumber 1 and 2
}, { _id: false });


// Main Assessment Schema
const AssessmentSchema = new Schema({
    facultyId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['tms', 'tca', 'tes'], required: true },
    assessmentNumber: { // Relevant for TCA (1, 2)
        type: Number,
        required: function() { return this.type === 'tca'; }
    },
    tmsType: { // Relevant for TMS
        type: String,
        enum: ['Tutorial', 'MiniProject', 'SurpriseTest'],
         required: function() { return this.type === 'tms'; }
    },
    subject: {
        code: { type: String, required: true },
        name: { type: String, required: true }
    },
    academicYear: { type: String, required: true }, // e.g., "2023-2024"
    semester: { type: Number, required: true }, // e.g., 5
    branch: { type: String, required: true }, // e.g., "CSE"
    section: { type: String, required: true }, // e.g., "A"

    numberOfStudents: Number,
    students: [StudentAssessmentSchema],

    // Store the config/mapping used when saving this data
    tmsConfig: { type: Schema.Types.Mixed }, // Store selectedCOs and other TMS config
    tcaConfig: { type: Schema.Types.Mixed }, // Store tcaSelectedCOs and other TCA config
    tesConfig: { type: Schema.Types.Mixed }, // Store selectedCOs and other TES config

    // Add createdAt and updatedAt timestamps
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Middleware to update the 'updatedAt' field on save
AssessmentSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Add an index for efficient querying
AssessmentSchema.index({ facultyId: 1, 'subject.code': 1, academicYear: 1, semester: 1, branch: 1, section: 1, type: 1, assessmentNumber: 1, tmsType: 1 }, { unique: true });


const Assessment = mongoose.model('Assessment', AssessmentSchema);

module.exports = Assessment;