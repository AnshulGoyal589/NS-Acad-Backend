const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const PoAttainmentDetailSchema = new Schema({
    poIdentifier: {
        type: String,
        required: true,
        trim: true
    },
    attainmentValue: {
        type: Number,
        default: 0,
        min: 0,
        max: 3
    },
    // Which COs contributed to this PO and their weights
    contributingCOs: [{
        coIdentifier: String,
        coAttainment: Number,
        mappingStrength: Number
    }]
}, { _id: false });

const PoAttainmentSchema = new Schema({
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
    poAttainment: {
        type: [PoAttainmentDetailSchema],
        default: []
    },
    psoAttainment: {
        type: [PoAttainmentDetailSchema],
        default: []
    },
    overallPoAttainment: {
        type: Number,
        default: 0,
        min: 0,
        max: 3
    },
    overallPsoAttainment: {
        type: Number,
        default: 0,
        min: 0,
        max: 3
    },
    calculatedAt: {
        type: Date,
        default: Date.now
    }
});

// One PO attainment record per subject-class-year
PoAttainmentSchema.index(
    { subjectCode: 1, academicYear: 1, semester: 1, branch: 1, section: 1 },
    { unique: true }
);

module.exports = mongoose.model('PoAttainment', PoAttainmentSchema);
