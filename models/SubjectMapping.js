// Example Schema: models/SubjectMapping.js
const mappingSchema = new mongoose.Schema({
    subjectCode: String,
    academicYear: String,
    branch: String,
    // Map COs to POs
    co_po_mapping: [{
        co: String, // e.g., "CO1"
        po_mapping: [{ po: String, strength: Number }] // e.g., [{ po: "PO1", strength: 3 }, { po: "PO5", strength: 2 }]
    }],
     // Map COs to PSOs (similar structure)
    co_pso_mapping: [{
        co: String,
        pso_mapping: [{ pso: String, strength: Number }]
    }],
    // Define target attainment level for COs (e.g., 60% of students scoring > 50% marks)
    co_attainment_target: {
         thresholdPercentage: Number, // e.g. 50 (score threshold)
         targetStudentPercentage: Number // e.g. 60 (student % threshold)
    }
});