const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const AttainmentLevelSchema = new Schema({
    level: { type: Number, required: true, min: 1, max: 3 },
    minStudentPercentage: { type: Number, required: true, min: 0, max: 100 }
}, { _id: false });

const AttainmentConfigSchema = new Schema({
    department: {
        type: String,
        required: true,
        trim: true,
        index: true
    },
    academicYear: {
        type: String,
        required: true,
        trim: true,
        index: true
    },
    // Threshold: student must score >= this % of max marks for a CO to count as "attained"
    markThresholdPercentage: {
        type: Number,
        default: 50,
        min: 0,
        max: 100
    },
    // Attainment levels: sorted descending by level (3 = highest)
    // If >= 70% students clear threshold → Level 3
    // If >= 60% students clear threshold → Level 2
    // If >= 50% students clear threshold → Level 1
    // Else → Level 0
    attainmentLevels: {
        type: [AttainmentLevelSchema],
        default: [
            { level: 3, minStudentPercentage: 70 },
            { level: 2, minStudentPercentage: 60 },
            { level: 1, minStudentPercentage: 50 }
        ]
    },
    // Weights for combining attainment across assessment types (must sum to 100)
    assessmentWeights: {
        tca: { type: Number, default: 40, min: 0, max: 100 },
        tms: { type: Number, default: 20, min: 0, max: 100 },
        tes: { type: Number, default: 40, min: 0, max: 100 }
    },
    // Direct vs indirect attainment weight (must sum to 100)
    directWeight: { type: Number, default: 80, min: 0, max: 100 },
    indirectWeight: { type: Number, default: 20, min: 0, max: 100 },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

AttainmentConfigSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

// One config per department per academic year
AttainmentConfigSchema.index({ department: 1, academicYear: 1 }, { unique: true });

module.exports = mongoose.model('AttainmentConfig', AttainmentConfigSchema);
