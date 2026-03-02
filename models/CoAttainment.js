const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const CoAttainmentDetailSchema = new Schema({
    coIdentifier: {
        type: String,
        required: true,
        trim: true
    },
    // Per-assessment-type attainment (0-3 levels)
    tmsAttainment: { type: Number, default: 0, min: 0, max: 3 },
    tcaAttainment: { type: Number, default: 0, min: 0, max: 3 },
    tesAttainment: { type: Number, default: 0, min: 0, max: 3 },
    // Weighted combination of above using assessmentWeights
    directAttainment: { type: Number, default: 0, min: 0, max: 3 },
    // From student surveys — placeholder for now
    indirectAttainment: { type: Number, default: 0, min: 0, max: 3 },
    // Final = directWeight * direct + indirectWeight * indirect
    finalAttainment: { type: Number, default: 0, min: 0, max: 3 },
    // Raw statistics for reporting
    stats: {
        tms: {
            totalStudents: { type: Number, default: 0 },
            studentsAboveThreshold: { type: Number, default: 0 },
            percentageAboveThreshold: { type: Number, default: 0 }
        },
        tca: {
            totalStudents: { type: Number, default: 0 },
            studentsAboveThreshold: { type: Number, default: 0 },
            percentageAboveThreshold: { type: Number, default: 0 }
        },
        tes: {
            totalStudents: { type: Number, default: 0 },
            studentsAboveThreshold: { type: Number, default: 0 },
            percentageAboveThreshold: { type: Number, default: 0 }
        }
    }
}, { _id: false });

const CoAttainmentSchema = new Schema({
    facultyId: {
        type: String,
        required: true,
        index: true
    },
    subjectCode: {
        type: String,
        required: true,
        trim: true,
        index: true
    },
    subjectName: {
        type: String,
        required: true,
        trim: true
    },
    academicYear: {
        type: String,
        required: true,
        trim: true,
        index: true
    },
    semester: {
        type: Number,
        required: true,
        index: true
    },
    branch: {
        type: String,
        required: true,
        trim: true,
        index: true
    },
    section: {
        type: String,
        required: true,
        trim: true,
        index: true
    },
    attainmentData: {
        type: [CoAttainmentDetailSchema],
        default: []
    },
    // Average of all CO finalAttainments
    overallAttainment: {
        type: Number,
        default: 0,
        min: 0,
        max: 3
    },
    // Config snapshot used for this calculation
    configUsed: {
        markThresholdPercentage: Number,
        attainmentLevels: [{ level: Number, minStudentPercentage: Number }],
        assessmentWeights: { tca: Number, tms: Number, tes: Number },
        directWeight: Number,
        indirectWeight: Number
    },
    calculatedAt: {
        type: Date,
        default: Date.now
    }
});

// One attainment record per subject-class-year
CoAttainmentSchema.index(
    { subjectCode: 1, academicYear: 1, semester: 1, branch: 1, section: 1 },
    { unique: true }
);

module.exports = mongoose.model('CoAttainment', CoAttainmentSchema);
