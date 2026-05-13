const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Assessment = require('../models/Assessment');
const CoPoMapping = require('../models/CoPoMapping');
const CoAttainment = require('../models/CoAttainment');
const PoAttainment = require('../models/PoAttainment');
const AttainmentConfig = require('../models/AttainmentConfig');

// ============================================================================
// HELPER: Get or create default config for a department
// ============================================================================
async function getConfig(department, academicYear) {
    let config = await AttainmentConfig.findOne({ department, academicYear });
    if (!config) {
        config = await AttainmentConfig.create({ department, academicYear });
    }
    return config;
}

// ============================================================================
// HELPER: Determine attainment level from student percentage
// ============================================================================
function getAttainmentLevel(studentPercentage, attainmentLevels) {
    // Sort levels descending (L3 first)
    const sorted = [...attainmentLevels].sort((a, b) => b.level - a.level);
    for (const lvl of sorted) {
        if (studentPercentage >= lvl.minStudentPercentage) {
            return lvl.level;
        }
    }
    return 0;
}

// ============================================================================
// HELPER: Extract CO marks from TMS assessment
// ============================================================================
function extractTmsCoMarks(assessment) {
    const coMarks = {}; // { CO1: { students: [{ obtained, max }] } }

    if (!assessment || !assessment.students) return coMarks;

    for (const student of assessment.students) {
        if (!student.tmsMarks || student.tmsMarks.length === 0) continue;

        for (const tms of student.tmsMarks) {
            if (!tms.questions) continue;
            for (const q of tms.questions) {
                for (const part of ['partA', 'partB']) {
                    if (q[part] && q[part].coNumber && q[part].maxMarks > 0) {
                        // Parse CO identifiers (could be "CO1+CO2")
                        const cos = q[part].coNumber.split('+').map(c => c.trim());
                        const marksPerCo = (q[part].marksObtained || 0) / cos.length;
                        const maxPerCo = q[part].maxMarks / cos.length;

                        for (const co of cos) {
                            if (!coMarks[co]) coMarks[co] = { students: {} };
                            if (!coMarks[co].students[student.rollNo]) {
                                coMarks[co].students[student.rollNo] = { obtained: 0, max: 0 };
                            }
                            coMarks[co].students[student.rollNo].obtained += marksPerCo;
                            coMarks[co].students[student.rollNo].max += maxPerCo;
                        }
                    }
                }
            }
        }
    }
    return coMarks;
}

// ============================================================================
// HELPER: Extract CO marks from TES assessment
// ============================================================================
function extractTesCoMarks(assessment) {
    const coMarks = {};

    if (!assessment || !assessment.students) return coMarks;

    for (const student of assessment.students) {
        if (!student.tesMarks || student.tesMarks.length === 0) continue;

        for (const tes of student.tesMarks) {
            if (!tes.questions) continue;
            for (const q of tes.questions) {
                for (const part of ['partA', 'partB', 'partC']) {
                    if (q[part] && q[part].coNumber && q[part].maxMarks > 0) {
                        const cos = q[part].coNumber.split('+').map(c => c.trim());
                        const obtained = q[part].marksObtained;
                        // Skip -1 (not attempted)
                        if (obtained < 0) continue;

                        const marksPerCo = obtained / cos.length;
                        const maxPerCo = q[part].maxMarks / cos.length;

                        for (const co of cos) {
                            if (!coMarks[co]) coMarks[co] = { students: {} };
                            if (!coMarks[co].students[student.rollNo]) {
                                coMarks[co].students[student.rollNo] = { obtained: 0, max: 0 };
                            }
                            coMarks[co].students[student.rollNo].obtained += marksPerCo;
                            coMarks[co].students[student.rollNo].max += maxPerCo;
                        }
                    }
                }
            }
        }
    }
    return coMarks;
}

// ============================================================================
// HELPER: Extract CO marks from TCA assessment
// ============================================================================
function extractTcaCoMarks(assessment) {
    const coMarks = {};

    if (!assessment || !assessment.students) return coMarks;

    for (const student of assessment.students) {
        if (!student.tcaMarks || student.tcaMarks.length === 0) continue;

        for (const tca of student.tcaMarks) {
            if (!tca.marks) continue;

            // tca.marks is a Map of partIdentifier -> { value, coDistribution }
            const rawMarks = tca.marks && typeof tca.marks.toObject === 'function' ? tca.marks.toObject() : tca.marks;
            const marksEntries = rawMarks instanceof Map
                ? Array.from(rawMarks.entries())
                : Object.entries(rawMarks || {});

            for (const [partKey, partData] of marksEntries) {
                // Skip Mongoose internal keys
                if (partKey.startsWith('$') || partKey.startsWith('_')) continue;
                if (!partData || !partData.coDistribution) continue;

                const rawDist = partData.coDistribution && typeof partData.coDistribution.toObject === 'function'
                    ? partData.coDistribution.toObject()
                    : (partData.coDistribution instanceof Map ? Object.fromEntries(partData.coDistribution) : partData.coDistribution);

                for (const [coKey, coValue] of Object.entries(rawDist || {})) {
                    // Skip Mongoose internal properties
                    if (coKey.startsWith('$') || coKey.startsWith('_')) continue;
                    if (!/^co\d+$/i.test(coKey)) continue; // Only allow CO1, CO2, etc.
                    const coId = coKey.toUpperCase();
                    const marks = Number(coValue) || 0;

                    if (!coMarks[coId]) coMarks[coId] = { students: {} };
                    if (!coMarks[coId].students[student.rollNo]) {
                        coMarks[coId].students[student.rollNo] = { obtained: 0, max: 0 };
                    }
                    coMarks[coId].students[student.rollNo].obtained += marks;
                }
            }

            // Estimate max marks per CO from tcaConfig if available
            if (assessment.tcaConfig) {
                // Max marks need to be distributed proportionally
                // For now, use a simple approach: max is calculated from the config
            }
        }
    }

    // If we couldn't determine max marks from distribution, estimate from total
    // This is a fallback — the max marks per CO should ideally come from the config
    for (const co of Object.keys(coMarks)) {
        const students = Object.values(coMarks[co].students);
        if (students.length > 0 && students[0].max === 0) {
            // Estimate max as the highest obtained marks * 1.25 or a reasonable default
            const maxObtained = Math.max(...students.map(s => s.obtained));
            for (const rollNo of Object.keys(coMarks[co].students)) {
                coMarks[co].students[rollNo].max = Math.max(maxObtained, 10);
            }
        }
    }

    return coMarks;
}

// ============================================================================
// HELPER: Calculate CO attainment for a set of CO marks
// ============================================================================
function calculateCoAttainmentFromMarks(coMarks, config) {
    const result = {};

    for (const [co, data] of Object.entries(coMarks)) {
        const students = Object.values(data.students);
        const totalStudents = students.length;

        if (totalStudents === 0) {
            result[co] = { attainment: 0, total: 0, above: 0, percentage: 0 };
            continue;
        }

        let studentsAboveThreshold = 0;
        for (const s of students) {
            if (s.max > 0) {
                const scorePercentage = (s.obtained / s.max) * 100;
                if (scorePercentage >= config.markThresholdPercentage) {
                    studentsAboveThreshold++;
                }
            }
        }

        const percentage = (studentsAboveThreshold / totalStudents) * 100;
        const attainment = getAttainmentLevel(percentage, config.attainmentLevels);

        result[co] = {
            attainment,
            total: totalStudents,
            above: studentsAboveThreshold,
            percentage: Math.round(percentage * 100) / 100
        };
    }

    return result;
}

// ============================================================================
// ROUTE: POST /api/copo/calculate-co — Calculate CO attainment
// ============================================================================
router.post('/calculate-co', async (req, res) => {
    try {
        const { facultyId, subjectCode, subjectName, academicYear, semester, branch, section, department } = req.body;

        if (!subjectCode || !academicYear || !semester || !branch || !section) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        // Get config
        const config = await getConfig(department || 'default', academicYear);

        // Fetch all assessments for this subject-class
        const assessmentQuery = {
            'subject.code': subjectCode,
            academicYear,
            semester: parseInt(semester),
            branch,
            section
        };
        if (facultyId) assessmentQuery.facultyId = facultyId;

        const assessments = await Assessment.find(assessmentQuery).lean();

        if (!assessments || assessments.length === 0) {
            return res.status(404).json({ error: 'No assessment data found for this subject/class combination.' });
        }

        // Separate by type
        const tmsAssessments = assessments.filter(a => a.type === 'tms');
        const tcaAssessments = assessments.filter(a => a.type === 'tca');
        const tesAssessments = assessments.filter(a => a.type === 'tes');

        // Extract CO marks per type
        let allTmsCoMarks = {};
        for (const a of tmsAssessments) {
            const marks = extractTmsCoMarks(a);
            // Merge
            for (const [co, data] of Object.entries(marks)) {
                if (!allTmsCoMarks[co]) allTmsCoMarks[co] = { students: {} };
                Object.assign(allTmsCoMarks[co].students, data.students);
            }
        }

        let allTcaCoMarks = {};
        for (const a of tcaAssessments) {
            const marks = extractTcaCoMarks(a);
            for (const [co, data] of Object.entries(marks)) {
                if (!allTcaCoMarks[co]) allTcaCoMarks[co] = { students: {} };
                // Merge by adding marks for same student
                for (const [rollNo, studentMarks] of Object.entries(data.students)) {
                    if (!allTcaCoMarks[co].students[rollNo]) {
                        allTcaCoMarks[co].students[rollNo] = { obtained: 0, max: 0 };
                    }
                    allTcaCoMarks[co].students[rollNo].obtained += studentMarks.obtained;
                    allTcaCoMarks[co].students[rollNo].max += studentMarks.max;
                }
            }
        }

        let allTesCoMarks = {};
        for (const a of tesAssessments) {
            const marks = extractTesCoMarks(a);
            for (const [co, data] of Object.entries(marks)) {
                if (!allTesCoMarks[co]) allTesCoMarks[co] = { students: {} };
                Object.assign(allTesCoMarks[co].students, data.students);
            }
        }

        // Calculate per-type attainment
        const tmsAttainment = calculateCoAttainmentFromMarks(allTmsCoMarks, config);
        const tcaAttainment = calculateCoAttainmentFromMarks(allTcaCoMarks, config);
        const tesAttainment = calculateCoAttainmentFromMarks(allTesCoMarks, config);

        // Collect all COs from all types
        const allCOs = new Set([
            ...Object.keys(tmsAttainment),
            ...Object.keys(tcaAttainment),
            ...Object.keys(tesAttainment)
        ]);

        // Sort COs naturally (CO1, CO2, ..., CO10)
        const sortedCOs = [...allCOs].sort((a, b) => {
            const numA = parseInt(a.replace(/\D/g, '')) || 0;
            const numB = parseInt(b.replace(/\D/g, '')) || 0;
            return numA - numB;
        });

        // Build final attainment data
        const weights = config.assessmentWeights;
        const totalWeight = (weights.tca || 0) + (weights.tms || 0) + (weights.tes || 0);

        const attainmentData = sortedCOs.map(co => {
            const tmsVal = tmsAttainment[co]?.attainment || 0;
            const tcaVal = tcaAttainment[co]?.attainment || 0;
            const tesVal = tesAttainment[co]?.attainment || 0;

            // Weighted direct attainment
            let directAttainment = 0;
            if (totalWeight > 0) {
                directAttainment = (
                    tmsVal * (weights.tms || 0) +
                    tcaVal * (weights.tca || 0) +
                    tesVal * (weights.tes || 0)
                ) / totalWeight;
            }
            directAttainment = Math.round(directAttainment * 100) / 100;

            // Final attainment (direct * weight + indirect * weight)
            const finalAttainment = Math.round(
                (directAttainment * config.directWeight / 100) * 100
            ) / 100;

            return {
                coIdentifier: co,
                tmsAttainment: tmsVal,
                tcaAttainment: tcaVal,
                tesAttainment: tesVal,
                directAttainment,
                indirectAttainment: 0, // Placeholder
                finalAttainment,
                stats: {
                    tms: {
                        totalStudents: tmsAttainment[co]?.total || 0,
                        studentsAboveThreshold: tmsAttainment[co]?.above || 0,
                        percentageAboveThreshold: tmsAttainment[co]?.percentage || 0
                    },
                    tca: {
                        totalStudents: tcaAttainment[co]?.total || 0,
                        studentsAboveThreshold: tcaAttainment[co]?.above || 0,
                        percentageAboveThreshold: tcaAttainment[co]?.percentage || 0
                    },
                    tes: {
                        totalStudents: tesAttainment[co]?.total || 0,
                        studentsAboveThreshold: tesAttainment[co]?.above || 0,
                        percentageAboveThreshold: tesAttainment[co]?.percentage || 0
                    }
                }
            };
        });

        // Overall attainment
        const overallAttainment = attainmentData.length > 0
            ? Math.round(
                (attainmentData.reduce((sum, d) => sum + d.finalAttainment, 0) / attainmentData.length) * 100
            ) / 100
            : 0;

        // Upsert the result
        const filter = { subjectCode, academicYear, semester: parseInt(semester), branch, section };
        const update = {
            facultyId: facultyId || 'unknown',
            subjectCode,
            subjectName: subjectName || subjectCode,
            academicYear,
            semester: parseInt(semester),
            branch,
            section,
            attainmentData,
            overallAttainment,
            configUsed: {
                markThresholdPercentage: config.markThresholdPercentage,
                attainmentLevels: config.attainmentLevels,
                assessmentWeights: config.assessmentWeights,
                directWeight: config.directWeight,
                indirectWeight: config.indirectWeight
            },
            calculatedAt: new Date()
        };

        const saved = await CoAttainment.findOneAndUpdate(filter, update, {
            upsert: true, new: true, setDefaultsOnInsert: true
        });

        res.status(200).json({
            message: 'CO Attainment calculated successfully',
            data: saved
        });

    } catch (error) {
        console.error('Error calculating CO attainment:', error);
        res.status(500).json({ error: 'Failed to calculate CO attainment', details: error.message });
    }
});

// ============================================================================
// ROUTE: POST /api/copo/calculate-po — Calculate PO attainment
// ============================================================================
router.post('/calculate-po', async (req, res) => {
    try {
        const { subjectCode, subjectName, academicYear, semester, branch, section } = req.body;

        if (!subjectCode || !academicYear || !semester || !branch || !section) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        // Fetch CO attainment
        const coAttainment = await CoAttainment.findOne({
            subjectCode, academicYear, semester: parseInt(semester), branch, section
        });

        if (!coAttainment) {
            return res.status(404).json({ error: 'CO Attainment not found. Please calculate CO attainment first.' });
        }

        // Fetch CO-PO mapping
        const copoMapping = await CoPoMapping.findOne({
            subjectCode, academicYear, semester: parseInt(semester), branch, section
        });

        if (!copoMapping || !copoMapping.courseOutcomes || copoMapping.courseOutcomes.length === 0) {
            return res.status(404).json({ error: 'CO-PO Mapping not found for this subject. Please create it first.' });
        }

        // Build CO attainment lookup
        const coAttainmentMap = {};
        for (const coData of coAttainment.attainmentData) {
            coAttainmentMap[coData.coIdentifier] = coData.finalAttainment;
        }

        // Calculate PO attainment: weighted average using mapping strengths
        const PO_IDENTIFIERS = Array.from({ length: 12 }, (_, i) => `PO${i + 1}`);
        const PSO_IDENTIFIERS = Array.from({ length: 4 }, (_, i) => `PSO${i + 1}`);

        const calculateAttainmentForTarget = (identifiers, prefix) => {
            return identifiers.map(poId => {
                let weightedSum = 0;
                let totalWeight = 0;
                const contributingCOs = [];

                for (const coMapping of copoMapping.courseOutcomes) {
                    const key = prefix === 'PO'
                        ? `po${poId.replace('PO', '')}`
                        : `pso${poId.replace('PSO', '')}`;
                    const strength = coMapping[key] || 0;

                    if (strength > 0) {
                        const coAtt = coAttainmentMap[coMapping.coIdentifier] || 0;
                        weightedSum += coAtt * strength;
                        totalWeight += strength;
                        contributingCOs.push({
                            coIdentifier: coMapping.coIdentifier,
                            coAttainment: coAtt,
                            mappingStrength: strength
                        });
                    }
                }

                const attainmentValue = totalWeight > 0
                    ? Math.round((weightedSum / totalWeight) * 100) / 100
                    : 0;

                return {
                    poIdentifier: poId,
                    attainmentValue,
                    contributingCOs
                };
            }).filter(po => po.contributingCOs.length > 0); // Only include POs with contributing COs
        };

        const poAttainmentData = calculateAttainmentForTarget(PO_IDENTIFIERS, 'PO');
        const psoAttainmentData = calculateAttainmentForTarget(PSO_IDENTIFIERS, 'PSO');

        const overallPoAttainment = poAttainmentData.length > 0
            ? Math.round(
                (poAttainmentData.reduce((s, p) => s + p.attainmentValue, 0) / poAttainmentData.length) * 100
            ) / 100
            : 0;

        const overallPsoAttainment = psoAttainmentData.length > 0
            ? Math.round(
                (psoAttainmentData.reduce((s, p) => s + p.attainmentValue, 0) / psoAttainmentData.length) * 100
            ) / 100
            : 0;

        // Upsert
        const filter = { subjectCode, academicYear, semester: parseInt(semester), branch, section };
        const update = {
            subjectCode,
            subjectName: subjectName || subjectCode,
            academicYear,
            semester: parseInt(semester),
            branch,
            section,
            poAttainment: poAttainmentData,
            psoAttainment: psoAttainmentData,
            overallPoAttainment,
            overallPsoAttainment,
            calculatedAt: new Date()
        };

        const saved = await PoAttainment.findOneAndUpdate(filter, update, {
            upsert: true, new: true, setDefaultsOnInsert: true
        });

        res.status(200).json({
            message: 'PO Attainment calculated successfully',
            data: saved
        });

    } catch (error) {
        console.error('Error calculating PO attainment:', error);
        res.status(500).json({ error: 'Failed to calculate PO attainment', details: error.message });
    }
});

// ============================================================================
// ROUTE: GET /api/copo/attainment/:subjectCode — Get stored attainment
// ============================================================================
router.get('/attainment/:subjectCode', async (req, res) => {
    try {
        const { subjectCode } = req.params;
        const { academicYear, semester, branch, section } = req.query;

        const query = { subjectCode };
        if (academicYear) query.academicYear = academicYear;
        if (semester) query.semester = parseInt(semester);
        if (branch) query.branch = branch;
        if (section) query.section = section;

        const coAttainment = await CoAttainment.findOne(query).lean();
        const poAttainment = await PoAttainment.findOne(query).lean();

        if (!coAttainment && !poAttainment) {
            return res.status(404).json({
                error: 'Attainment not yet calculated.',
                message: 'No CO/PO attainment data found. Please click "Calculate Attainment" in the dashboard first.',
                subjectCode,
                queryUsed: query
            });
        }

        res.status(200).json({
            coAttainment,
            poAttainment
        });

    } catch (error) {
        console.error('Error fetching attainment:', error);
        res.status(500).json({ error: 'Failed to fetch attainment data', details: error.message });
    }
});


// ============================================================================
// ROUTE: GET /api/copo/dashboard — Dashboard data for a faculty
// ============================================================================
router.get('/dashboard', async (req, res) => {
    try {
        const { facultyId, academicYear, department } = req.query;

        let coQuery = {};
        let poQuery = {};

        if (facultyId) {
            coQuery.facultyId = facultyId;
        }
        if (academicYear) {
            coQuery.academicYear = academicYear;
            poQuery.academicYear = academicYear;
        }

        const coAttainments = await CoAttainment.find(coQuery).lean();

        // Also fetch PO attainments for same subjects
        if (coAttainments.length > 0) {
            const subjectQueries = coAttainments.map(c => ({
                subjectCode: c.subjectCode,
                academicYear: c.academicYear,
                semester: c.semester,
                branch: c.branch,
                section: c.section
            }));
            poQuery = { $or: subjectQueries };
        }

        const poAttainments = await PoAttainment.find(poQuery).lean();

        // Build dashboard summary
        const subjects = coAttainments.map(co => {
            const matchingPo = poAttainments.find(po =>
                po.subjectCode === co.subjectCode &&
                po.academicYear === co.academicYear &&
                po.semester === co.semester &&
                po.branch === co.branch &&
                po.section === co.section
            );

            return {
                subjectCode: co.subjectCode,
                subjectName: co.subjectName,
                academicYear: co.academicYear,
                semester: co.semester,
                branch: co.branch,
                section: co.section,
                overallCoAttainment: co.overallAttainment,
                overallPoAttainment: matchingPo?.overallPoAttainment || 0,
                overallPsoAttainment: matchingPo?.overallPsoAttainment || 0,
                coCount: co.attainmentData.length,
                calculatedAt: co.calculatedAt,
                coAttainment: co,
                poAttainment: matchingPo
            };
        });

        res.status(200).json({
            subjects,
            summary: {
                totalSubjects: subjects.length,
                avgCoAttainment: subjects.length > 0
                    ? Math.round((subjects.reduce((s, sub) => s + sub.overallCoAttainment, 0) / subjects.length) * 100) / 100
                    : 0,
                avgPoAttainment: subjects.filter(s => s.overallPoAttainment > 0).length > 0
                    ? Math.round((subjects.filter(s => s.overallPoAttainment > 0).reduce((s, sub) => s + sub.overallPoAttainment, 0) / subjects.filter(s => s.overallPoAttainment > 0).length) * 100) / 100
                    : 0
            }
        });

    } catch (error) {
        console.error('Error fetching dashboard data:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard data', details: error.message });
    }
});

// ============================================================================
// ROUTE: GET /api/copo/config — Get attainment config
// ============================================================================
router.get('/config', async (req, res) => {
    try {
        const { department, academicYear } = req.query;
        const config = await getConfig(department || 'default', academicYear || '2024-2025');
        res.status(200).json(config);
    } catch (error) {
        console.error('Error fetching config:', error);
        res.status(500).json({ error: 'Failed to fetch config', details: error.message });
    }
});

// ============================================================================
// ROUTE: PUT /api/copo/config — Update attainment config
// ============================================================================
router.put('/config', async (req, res) => {
    try {
        const {
            department,
            academicYear,
            markThresholdPercentage,
            attainmentLevels,
            assessmentWeights,
            directWeight,
            indirectWeight
        } = req.body;

        const dept = department || 'default';
        const year = academicYear || '2024-2025';

        const update = {};
        if (markThresholdPercentage !== undefined) update.markThresholdPercentage = markThresholdPercentage;
        if (attainmentLevels) update.attainmentLevels = attainmentLevels;
        if (assessmentWeights) update.assessmentWeights = assessmentWeights;
        if (directWeight !== undefined) update.directWeight = directWeight;
        if (indirectWeight !== undefined) update.indirectWeight = indirectWeight;
        update.updatedAt = new Date();

        const config = await AttainmentConfig.findOneAndUpdate(
            { department: dept, academicYear: year },
            { $set: update },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        res.status(200).json({ message: 'Configuration updated successfully', config });

    } catch (error) {
        console.error('Error updating config:', error);
        res.status(500).json({ error: 'Failed to update config', details: error.message });
    }
});

// ============================================================================
// ROUTE: GET /api/copo/report/:subjectCode — Generate NBA report data
// ============================================================================
router.get('/report/:subjectCode', async (req, res) => {
    try {
        const { subjectCode } = req.params;
        const { academicYear, semester, branch, section } = req.query;

        const query = { subjectCode };
        if (academicYear) query.academicYear = academicYear;
        if (semester) query.semester = parseInt(semester);
        if (branch) query.branch = branch;
        if (section) query.section = section;

        const coAttainment = await CoAttainment.findOne(query).lean();
        const poAttainment = await PoAttainment.findOne(query).lean();
        const copoMapping = await CoPoMapping.findOne(query).lean();

        if (!coAttainment) {
            return res.status(404).json({ error: 'Attainment data not found. Please calculate attainment first.' });
        }

        res.status(200).json({
            subjectCode,
            subjectName: coAttainment.subjectName,
            academicYear: coAttainment.academicYear,
            semester: coAttainment.semester,
            branch: coAttainment.branch,
            section: coAttainment.section,
            copoMapping: copoMapping?.courseOutcomes || [],
            coAttainment: coAttainment.attainmentData,
            overallCoAttainment: coAttainment.overallAttainment,
            configUsed: coAttainment.configUsed,
            poAttainment: poAttainment?.poAttainment || [],
            psoAttainment: poAttainment?.psoAttainment || [],
            overallPoAttainment: poAttainment?.overallPoAttainment || 0,
            overallPsoAttainment: poAttainment?.overallPsoAttainment || 0,
            calculatedAt: coAttainment.calculatedAt
        });

    } catch (error) {
        console.error('Error generating report data:', error);
        res.status(500).json({ error: 'Failed to generate report', details: error.message });
    }
});

module.exports = router;
