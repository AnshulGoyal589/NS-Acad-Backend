const express = require('express');
const router = express.Router();
const axios = require('axios');
const Assessment = require('../models/Assessment');
const CoAttainment = require('../models/CoAttainment');
const PoAttainment = require('../models/PoAttainment');
const CoPoMapping = require('../models/CoPoMapping');
const User = require('../models/User');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5001';

// ══════════════════════════════════════════════════════════════════════════════
// ML HELPERS — Pure JS implementations (no external ML libs needed)
// ══════════════════════════════════════════════════════════════════════════════

/** Simple Linear Regression: y = mx + b */
function linearRegression(xArr, yArr) {
  const n = xArr.length;
  if (n === 0) return { slope: 0, intercept: 0, r2: 0 };
  const sumX = xArr.reduce((a, b) => a + b, 0);
  const sumY = yArr.reduce((a, b) => a + b, 0);
  const sumXY = xArr.reduce((a, x, i) => a + x * yArr[i], 0);
  const sumX2 = xArr.reduce((a, x) => a + x * x, 0);
  const sumY2 = yArr.reduce((a, y) => a + y * y, 0);
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return { slope: 0, intercept: sumY / n, r2: 0 };
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  const ssRes = yArr.reduce((a, y, i) => a + Math.pow(y - (slope * xArr[i] + intercept), 2), 0);
  const ssTot = yArr.reduce((a, y) => a + Math.pow(y - sumY / n, 2), 0);
  const r2 = ssTot === 0 ? 1 : 1 - ssRes / ssTot;
  return { slope, intercept, r2: Math.max(0, r2) };
}

/** Predict value using regression model */
function predict(model, x) {
  return Math.max(0, model.slope * x + model.intercept);
}

/** K-Means clustering (k=3 for at-risk/average/excellent) */
function kMeansClustering(scores, k = 3) {
  if (scores.length === 0) return { clusters: [], centroids: [] };
  // Initialize centroids
  const sorted = [...scores].sort((a, b) => a - b);
  let centroids = Array.from({ length: k }, (_, i) =>
    sorted[Math.floor((i / k) * sorted.length)] || 0
  );
  let assignments = new Array(scores.length).fill(0);

  for (let iter = 0; iter < 20; iter++) {
    // Assign each point to nearest centroid
    assignments = scores.map(s => {
      let minDist = Infinity, minIdx = 0;
      centroids.forEach((c, i) => {
        const d = Math.abs(s - c);
        if (d < minDist) { minDist = d; minIdx = i; }
      });
      return minIdx;
    });
    // Update centroids
    const newCentroids = centroids.map((_, ci) => {
      const members = scores.filter((_, si) => assignments[si] === ci);
      return members.length > 0 ? members.reduce((a, b) => a + b, 0) / members.length : centroids[ci];
    });
    if (JSON.stringify(newCentroids) === JSON.stringify(centroids)) break;
    centroids = newCentroids;
  }
  // Sort clusters so index 0 = lowest (at-risk)
  const centroidOrder = centroids.map((c, i) => ({ c, i })).sort((a, b) => a.c - b.c);
  const remapIdx = {};
  centroidOrder.forEach((item, newIdx) => { remapIdx[item.i] = newIdx; });
  return {
    clusters: assignments.map(a => remapIdx[a]),
    centroids: centroidOrder.map(item => item.c),
    labels: ['At-Risk', 'Average', 'Excellent']
  };
}

/** Sigmoid for probability output */
function sigmoid(x) { return 1 / (1 + Math.exp(-x)); }

// ══════════════════════════════════════════════════════════════════════════════
// HELPER: Extract per-student total scores from assessments
// ══════════════════════════════════════════════════════════════════════════════
function getStudentScores(assessments) {
  const studentMap = {}; // rollNo -> { tms, tca, tes, name }
  for (const a of assessments) {
    for (const s of (a.students || [])) {
      if (!studentMap[s.rollNo]) studentMap[s.rollNo] = { name: s.name, tms: 0, tmsMax: 0, tca: 0, tcaMax: 0, tes: 0, tesMax: 0 };
      const st = studentMap[s.rollNo];
      if (a.type === 'tms') {
        for (const tm of (s.tmsMarks || [])) {
          for (const q of (tm.questions || [])) {
            for (const p of ['partA', 'partB']) {
              if (q[p]) { st.tms += q[p].marksObtained || 0; st.tmsMax += q[p].maxMarks || 0; }
            }
          }
        }
      }
      if (a.type === 'tes') {
        for (const te of (s.tesMarks || [])) {
          for (const q of (te.questions || [])) {
            for (const p of ['partA', 'partB', 'partC']) {
              if (q[p] && q[p].marksObtained >= 0) { st.tes += q[p].marksObtained || 0; st.tesMax += q[p].maxMarks || 0; }
            }
          }
        }
      }
      if (a.type === 'tca') {
        for (const tc of (s.tcaMarks || [])) {
          const rawMarks = tc.marks || {};
          const entries = Object.entries(rawMarks).filter(([k]) => !k.startsWith('$') && !k.startsWith('_'));
          for (const [, part] of entries) {
            if (part && typeof part === 'object' && part.value) { st.tca += part.value; st.tcaMax += 10; }
          }
        }
      }
    }
  }
  return studentMap;
}

// ══════════════════════════════════════════════════════════════════════════════
// ROUTE: POST /api/analytics/predict — Full AI analytics for a subject
// ══════════════════════════════════════════════════════════════════════════════
router.post('/predict', async (req, res) => {
  try {
    const { facultyId, subjectCode, academicYear, semester, branch, section } = req.body;
    if (!subjectCode || !academicYear) return res.status(400).json({ error: 'Missing required params' });

    const query = { 'subject.code': subjectCode, academicYear, semester: parseInt(semester), branch, section };
    if (facultyId) query.facultyId = facultyId;
    const assessments = await Assessment.find(query).lean();
    if (!assessments.length) return res.status(404).json({ error: 'No assessment data found' });

    const studentMap = getStudentScores(assessments);
    const students = Object.entries(studentMap).map(([rollNo, d]) => ({
      rollNo, name: d.name,
      tmsPercent: d.tmsMax > 0 ? (d.tms / d.tmsMax) * 100 : 0,
      tcaPercent: d.tcaMax > 0 ? (d.tca / d.tcaMax) * 100 : 0,
      tesPercent: d.tesMax > 0 ? (d.tes / d.tesMax) * 100 : 0,
      tmsRaw: d.tms, tcaRaw: d.tca, tesRaw: d.tes,
    }));

    // ── 1. Performance Prediction (TMS+TCA → predict TES) ──
    const xData = students.map(s => s.tmsPercent * 0.5 + s.tcaPercent * 0.5);
    const yData = students.map(s => s.tesPercent);
    const model = linearRegression(xData, yData);
    const predictions = students.map(s => {
      const inputScore = s.tmsPercent * 0.5 + s.tcaPercent * 0.5;
      const predictedTes = Math.min(100, Math.max(0, predict(model, inputScore)));
      return { ...s, predictedTes: Math.round(predictedTes * 100) / 100, inputScore: Math.round(inputScore * 100) / 100 };
    });

    // ── 2. At-Risk Classification (K-Means) ──
    const overallScores = predictions.map(s => (s.tmsPercent + s.tcaPercent + s.tesPercent) / 3);
    const clustering = kMeansClustering(overallScores, 3);
    const classifiedStudents = predictions.map((s, i) => ({
      ...s,
      overallPercent: Math.round(overallScores[i] * 100) / 100,
      riskCategory: clustering.labels[clustering.clusters[i]],
      riskScore: Math.round((1 - overallScores[i] / 100) * 100),
    }));

    const atRiskStudents = classifiedStudents.filter(s => s.riskCategory === 'At-Risk');
    const excellentStudents = classifiedStudents.filter(s => s.riskCategory === 'Excellent');

    // ── 3. CO Attainment Gap Analysis ──
    const coAttainment = await CoAttainment.findOne({ subjectCode, academicYear, semester: parseInt(semester), branch, section }).lean();
    const copoMapping = await CoPoMapping.findOne({ subjectCode, academicYear, semester: parseInt(semester), branch, section }).lean();

    let attainmentGaps = [];
    let recommendations = [];
    if (coAttainment && coAttainment.attainmentData) {
      // Filter out Mongoose internal fields — only keep valid CO identifiers (CO1, CO2, ...)
      const validCoData = coAttainment.attainmentData.filter(co => co.coIdentifier && /^CO\d+$/i.test(co.coIdentifier));
      attainmentGaps = validCoData.map(co => ({
        co: co.coIdentifier,
        current: co.finalAttainment,
        target: 2.0,
        gap: Math.max(0, 2.0 - co.finalAttainment),
        status: co.finalAttainment >= 2.0 ? 'Achieved' : co.finalAttainment >= 1.5 ? 'Needs Improvement' : 'Critical',
      }));
      // Generate AI recommendations
      const criticalCOs = attainmentGaps.filter(g => g.status === 'Critical');
      const improveCOs = attainmentGaps.filter(g => g.status === 'Needs Improvement');
      if (criticalCOs.length > 0) {
        recommendations.push({ type: 'critical', icon: '🚨', text: `${criticalCOs.map(c => c.co).join(', ')} have critical attainment gaps. Consider additional tutorials and remedial sessions for weak students.` });
      }
      if (improveCOs.length > 0) {
        recommendations.push({ type: 'warning', icon: '⚠️', text: `${improveCOs.map(c => c.co).join(', ')} need improvement. Focus on practice problems and lab exercises for these outcomes.` });
      }
      if (atRiskStudents.length > 0) {
        recommendations.push({ type: 'info', icon: '🎯', text: `${atRiskStudents.length} student(s) identified as at-risk. Recommend personalized mentoring sessions.` });
      }
      if (model.r2 > 0.5) {
        recommendations.push({ type: 'success', icon: '📊', text: `Prediction model accuracy (R²): ${(model.r2 * 100).toFixed(1)}%. Mid-sem performance is a strong predictor of end-sem results.` });
      }
      recommendations.push({ type: 'info', icon: '💡', text: `Class average: ${Math.round(overallScores.reduce((a, b) => a + b, 0) / overallScores.length)}%. ${excellentStudents.length} students performing excellently.` });
    }

    // ── 4. Department Health Score (NIRF-style) ──
    const avgAttainment = coAttainment ? coAttainment.overallAttainment : 0;
    const passRate = students.filter(s => ((s.tmsPercent + s.tcaPercent + s.tesPercent) / 3) >= 40).length / students.length * 100;
    const excellenceRate = excellentStudents.length / students.length * 100;
    const healthScore = Math.round(
      avgAttainment / 3 * 30 +   // 30% weight to attainment
      passRate / 100 * 35 +       // 35% weight to pass rate
      excellenceRate / 100 * 20 + // 20% weight to excellence
      model.r2 * 15               // 15% weight to prediction confidence
    );

    res.json({
      subjectCode,
      modelMetrics: { slope: model.slope, intercept: model.intercept, r2: model.r2, accuracy: `${(model.r2 * 100).toFixed(1)}%` },
      students: classifiedStudents.sort((a, b) => a.overallPercent - b.overallPercent),
      summary: {
        total: students.length,
        atRisk: atRiskStudents.length,
        average: classifiedStudents.filter(s => s.riskCategory === 'Average').length,
        excellent: excellentStudents.length,
        classAverage: Math.round(overallScores.reduce((a, b) => a + b, 0) / overallScores.length * 100) / 100,
        clusterCentroids: clustering.centroids.map(c => Math.round(c * 100) / 100),
      },
      attainmentGaps,
      recommendations,
      healthScore: { score: healthScore, maxScore: 100, grade: healthScore >= 80 ? 'A+' : healthScore >= 60 ? 'A' : healthScore >= 40 ? 'B' : 'C' },
    });
  } catch (err) {
    console.error('Analytics error:', err);
    res.status(500).json({ error: 'Analytics failed', details: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// ROUTE: GET /api/analytics/department-score
// ══════════════════════════════════════════════════════════════════════════════
router.get('/department-score', async (req, res) => {
  try {
    const { department, academicYear } = req.query;
    const coAttainments = await CoAttainment.find({ academicYear: academicYear || '2025-2026' }).lean();
    const poAttainments = await PoAttainment.find({ academicYear: academicYear || '2025-2026' }).lean();

    const avgCO = coAttainments.length > 0
      ? coAttainments.reduce((s, c) => s + c.overallAttainment, 0) / coAttainments.length : 0;
    const avgPO = poAttainments.length > 0
      ? poAttainments.reduce((s, p) => s + p.overallPoAttainment, 0) / poAttainments.length : 0;

    // NIRF-style scoring
    const tlr = Math.min(100, (avgCO / 3) * 100); // Teaching Learning Resources
    const oi = Math.min(100, (avgPO / 3) * 100);   // Outcome Index
    const nirfScore = Math.round(tlr * 0.3 + oi * 0.3 + 70 * 0.2 + 60 * 0.2); // simulated GO + Perception

    res.json({
      department: department || 'CSE',
      academicYear: academicYear || '2025-2026',
      metrics: {
        avgCoAttainment: Math.round(avgCO * 100) / 100,
        avgPoAttainment: Math.round(avgPO * 100) / 100,
        subjectsAnalyzed: coAttainments.length,
      },
      nirfIndicators: {
        teachingLearning: Math.round(tlr),
        outcomeIndex: Math.round(oi),
        graduateOutcome: 70,
        perception: 60,
        overallScore: nirfScore,
        estimatedBand: nirfScore >= 60 ? '51-100' : nirfScore >= 40 ? '101-150' : '151-200',
      }
    });
  } catch (err) {
    console.error('Dept score error:', err);
    res.status(500).json({ error: 'Failed to compute department score' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// PYTHON ML SERVICE PROXY ROUTES
// ══════════════════════════════════════════════════════════════════════════════

/** Forward to Python ML service for real scikit-learn/XGBoost predictions */
router.post('/ml/predict', async (req, res) => {
  try {
    const { facultyId, subjectCode, academicYear, semester, branch, section } = req.body;
    const query = { 'subject.code': subjectCode, academicYear, semester: parseInt(semester), branch, section };
    if (facultyId) query.facultyId = facultyId;
    const assessments = await Assessment.find(query).lean();
    if (!assessments.length) return res.status(404).json({ error: 'No assessment data found' });

    const studentMap = getStudentScores(assessments);
    const students = Object.entries(studentMap).map(([rollNo, d]) => ({
      rollNo, name: d.name,
      tms_marks: d.tms, tca_marks: d.tca,
      attendance: 75, assignments: 15, lab_marks: 20,  // defaults for demo
    }));

    const mlResponse = await axios.post(`${ML_SERVICE_URL}/api/ml/predict`, { students }, { timeout: 10000 });
    res.json(mlResponse.data);
  } catch (err) {
    if (err.code === 'ECONNREFUSED') {
      return res.status(503).json({ error: 'Python ML service is not running. Start it with: cd ml-service && python app.py' });
    }
    console.error('ML proxy error:', err.message);
    res.status(500).json({ error: 'ML prediction failed', details: err.message });
  }
});

/** NIRF prediction proxy */
router.post('/ml/nirf-predict', async (req, res) => {
  try {
    const mlResponse = await axios.post(`${ML_SERVICE_URL}/api/ml/nirf-predict`, req.body, { timeout: 10000 });
    res.json(mlResponse.data);
  } catch (err) {
    if (err.code === 'ECONNREFUSED') {
      return res.status(503).json({ error: 'Python ML service not running' });
    }
    res.status(500).json({ error: 'NIRF prediction failed', details: err.message });
  }
});

/** Model info proxy */
router.get('/ml/model-info', async (req, res) => {
  try {
    const mlResponse = await axios.get(`${ML_SERVICE_URL}/api/ml/model-info`, { timeout: 5000 });
    res.json(mlResponse.data);
  } catch (err) {
    if (err.code === 'ECONNREFUSED') {
      return res.status(503).json({ error: 'Python ML service not running' });
    }
    res.status(500).json({ error: 'Failed to get model info' });
  }
});

/** ML service health check */
router.get('/ml/health', async (req, res) => {
  try {
    const mlResponse = await axios.get(`${ML_SERVICE_URL}/health`, { timeout: 3000 });
    res.json({ ...mlResponse.data, service: 'Python Flask + scikit-learn + XGBoost' });
  } catch (err) {
    res.json({ status: 'offline', error: 'Python ML service not reachable' });
  }
});

/** ML model retrain proxy */
router.post('/ml/retrain', async (req, res) => {
  try {
    const { facultyId, subjectCode, academicYear, semester, branch, section } = req.body;
    let students = [];
    
    // Fetch real data to train on if query parameters provided
    if (academicYear) {
      const query = { academicYear };
      if (subjectCode) query['subject.code'] = subjectCode;
      if (semester) query.semester = parseInt(semester);
      if (branch) query.branch = branch;
      if (section) query.section = section;
      if (facultyId) query.facultyId = facultyId;
      
      const assessments = await Assessment.find(query).lean();
      if (assessments.length > 0) {
        const studentMap = getStudentScores(assessments);
        students = Object.entries(studentMap).map(([rollNo, d]) => ({
          rollNo, name: d.name,
          tms_marks: d.tms, tca_marks: d.tca,
          tes_marks: d.tes,
          attendance: 75, assignments: 15, lab_marks: 20, // Example defaults
        }));
      }
    }
    
    const mlResponse = await axios.post(`${ML_SERVICE_URL}/api/ml/retrain`, { students }, { timeout: 15000 });
    res.json(mlResponse.data);
  } catch (err) {
    if (err.code === 'ECONNREFUSED') {
      return res.status(503).json({ error: 'Python ML service not running' });
    }
    res.status(500).json({ error: 'Retraining failed', details: err.message });
  }
});

const NirfData = require('../models/NirfData');

/** Export NIRF format data for Colab */
router.get('/export/nirf-data', async (req, res) => {
  try {
    // Fetch data directly from the MongoDB database
    const nirfRecords = await NirfData.find().lean();
    
    if (!nirfRecords || nirfRecords.length === 0) {
      return res.status(404).json({ error: 'No NIRF data found in the database.' });
    }

    const headers = [
      'University', 'Year', 'Publications_Scopus', 'Citations_Total', 
      'Citations_Per_Paper', 'Patents_Granted', 'Patents_Published', 
      'Projects_Count', 'Funding_Amount_Lakhs', 'PhD_Faculty', 
      'Total_Faculty', 'PhD_Faculty_Ratio', 'Total_Students', 
      'Faculty_Student_Ratio', 'TLR_Score', 'RPC_Score', 'GO_Score', 
      'OI_Score', 'Peer_Score', 'NIRF_Score'
    ];

    let csvContent = headers.join(',') + '\n';
    
    // Generate CSV string from database records
    nirfRecords.forEach(record => {
      const row = [
        record.university,
        record.year,
        record.publicationsScopus,
        record.citationsTotal,
        record.citationsPerPaper,
        record.patentsGranted,
        record.patentsPublished,
        record.projectsCount,
        record.fundingAmountLakhs,
        record.phdFaculty,
        record.totalFaculty,
        record.phdFacultyRatio,
        record.totalStudents,
        record.facultyStudentRatio,
        record.tlrScore,
        record.rpcScore,
        record.goScore,
        record.oiScore,
        record.peerScore,
        record.nirfScore
      ];
      csvContent += row.join(',') + '\n';
    });

    res.header('Content-Type', 'text/csv');
    res.attachment('nirf_training_data_from_db.csv');
    return res.send(csvContent);
  } catch (err) {
    console.error('Database export error:', err);
    res.status(500).json({ error: 'Database export failed' });
  }
});

module.exports = router;
