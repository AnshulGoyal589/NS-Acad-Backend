const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Define the structure for a single CO's mapping to all POs/PSOs
const CourseOutcomeMappingDetailSchema = new Schema({
    coIdentifier: { // e.g., "CO1", "CO2"
        type: String,
        required: [true, 'CO Identifier (e.g., CO1) is required.'],
        trim: true
    },
    po1: { type: Number, min: 0, max: 3, default: 0 },
    po2: { type: Number, min: 0, max: 3, default: 0 },
    po3: { type: Number, min: 0, max: 3, default: 0 },
    po4: { type: Number, min: 0, max: 3, default: 0 },
    po5: { type: Number, min: 0, max: 3, default: 0 },
    po6: { type: Number, min: 0, max: 3, default: 0 },
    po7: { type: Number, min: 0, max: 3, default: 0 },
    po8: { type: Number, min: 0, max: 3, default: 0 },
    po9: { type: Number, min: 0, max: 3, default: 0 },
    po10: { type: Number, min: 0, max: 3, default: 0 },
    po11: { type: Number, min: 0, max: 3, default: 0 },
    po12: { type: Number, min: 0, max: 3, default: 0 },
    pso1: { type: Number, min: 0, max: 3, default: 0 },
    pso2: { type: Number, min: 0, max: 3, default: 0 },
    pso3: { type: Number, min: 0, max: 3, default: 0 },
    pso4: { type: Number, min: 0, max: 3, default: 0 },
}, { _id: false }); // Don't create separate _id for each mapping detail


// Main schema for the overall mapping for a course
const CoPoMappingSchema = new Schema({
    facultyId: { // Identifies the faculty member responsible or associated
        type: String,
        required: true,
        index: true
    },
    subjectCode: {
        type: String,
        required: [true, 'Subject Code is required.'],
        trim: true,
        index: true
    },
    subjectName: { // Added for display purposes
        type: String,
        required: [true, 'Subject Name is required.'],
        trim: true
    },
    academicYear: { // e.g., "2023-2024"
        type: String,
        required: [true, 'Academic Year is required.'],
        trim: true,
        index: true
    },
    semester: { // e.g., 5
        type: Number,
        required: [true, 'Semester is required.'],
        index: true
    },
    branch: { // e.g., "CSE"
        type: String,
        required: [true, 'Branch is required.'],
        trim: true,
        index: true
    },
    section: { // e.g., "A"
        type: String,
        required: [true, 'Section is required.'],
        trim: true,
        index: true
    },
    courseOutcomes: { // An array containing the mapping for each CO
        type: [CourseOutcomeMappingDetailSchema],
        validate: [v => Array.isArray(v) && v.length > 0, 'At least one Course Outcome mapping is required.']
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Middleware to update the 'updatedAt' timestamp on save
CoPoMappingSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// Add a compound index for efficient searching of a specific course mapping
CoPoMappingSchema.index({ subjectCode: 1, academicYear: 1, semester: 1, branch: 1, section: 1 }, { unique: true }); // Ensure only one mapping per course instance


module.exports = mongoose.model('CoPoMapping', CoPoMappingSchema);