/**
 * Demo Seed Script for NS-Acad Portal
 * Run: node seed-demo.js
 * This will create a faculty user with classes, subjects, documents,
 * CO-PO mappings, assessments, and attainment data.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Data = require('./models/Data');
const Assessment = require('./models/Assessment');
const CoPoMapping = require('./models/CoPoMapping');
const CoAttainment = require('./models/CoAttainment');
const PoAttainment = require('./models/PoAttainment');
const AttainmentConfig = require('./models/AttainmentConfig');

const MONGO_URL = process.env.MONGO_URL;

// ── Demo Faculty Credentials ─────────────────────────────────────────────────
const FACULTY_USERNAME = 'demo_faculty';
const FACULTY_PASSWORD = 'Demo@1234';
const FACULTY_INFO = {
  fullname: 'Dr. Anshul Goyal',
  email: 'anshul.goyal@university.edu',
  department: 'CSE',
  role: 'faculty',
}; 

// ── HOD Credentials ──────────────────────────────────────────────────────────
const HOD_USERNAME = 'demo_hod';
const HOD_PASSWORD = 'Demo@1234';
const HOD_INFO = {
  fullname: 'Dr. Rajesh Kumar',
  email: 'rajesh.kumar@university.edu',
  department: 'CSE',
  role: 'hod',
};

// ── Classes & Subjects ───────────────────────────────────────────────────────
const CLASSES = [
  {
    branch: 'CSE', section: 'A', year: 3, semester: 5, academicYear: '2025-2026',
    subjects: [
      { code: 'CS501', name: 'Machine Learning' },
      { code: 'CS502', name: 'Computer Networks' },
    ]
  },
  {
    branch: 'CSE', section: 'B', year: 3, semester: 5, academicYear: '2025-2026',
    subjects: [
      { code: 'CS501', name: 'Machine Learning' },
    ]
  },
];

// ── Student Names ────────────────────────────────────────────────────────────
const STUDENTS = [
  { rollNo: '2023CSE001', name: 'Aarav Sharma' },
  { rollNo: '2023CSE002', name: 'Priya Patel' },
  { rollNo: '2023CSE003', name: 'Rohan Mehta' },
  { rollNo: '2023CSE004', name: 'Sneha Gupta' },
  { rollNo: '2023CSE005', name: 'Vikram Singh' },
  { rollNo: '2023CSE006', name: 'Ananya Reddy' },
  { rollNo: '2023CSE007', name: 'Karan Verma' },
  { rollNo: '2023CSE008', name: 'Ishita Joshi' },
  { rollNo: '2023CSE009', name: 'Arjun Nair' },
  { rollNo: '2023CSE010', name: 'Divya Mishra' },
  { rollNo: '2023CSE011', name: 'Rahul Yadav' },
  { rollNo: '2023CSE012', name: 'Neha Agarwal' },
  { rollNo: '2023CSE013', name: 'Aditya Kapoor' },
  { rollNo: '2023CSE014', name: 'Pooja Chauhan' },
  { rollNo: '2023CSE015', name: 'Manish Tiwari' },
  { rollNo: '2023CSE016', name: 'Sakshi Pandey' },
  { rollNo: '2023CSE017', name: 'Deepak Jain' },
  { rollNo: '2023CSE018', name: 'Ritu Saxena' },
  { rollNo: '2023CSE019', name: 'Amit Dubey' },
  { rollNo: '2023CSE020', name: 'Kavita Thakur' },
];

// ── Helper: random int in range ──────────────────────────────────────────────
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// ══════════════════════════════════════════════════════════════════════════════
// SEED FUNCTIONS
// ══════════════════════════════════════════════════════════════════════════════

async function createUsers() {
  console.log('── Creating Users ──');

  // Faculty
  let faculty = await User.findOne({ username: FACULTY_USERNAME });
  if (faculty) {
    console.log('  Faculty user already exists, updating classes...');
    faculty.classes = CLASSES;
    await faculty.save();
  } else {
    const newUser = new User({ ...FACULTY_INFO, username: FACULTY_USERNAME, classes: CLASSES });
    faculty = await User.register(newUser, FACULTY_PASSWORD);
    console.log('  ✅ Faculty user created:', FACULTY_USERNAME);
  }

  // HOD
  let hod = await User.findOne({ username: HOD_USERNAME });
  if (!hod) {
    const newHod = new User({ ...HOD_INFO, username: HOD_USERNAME, classes: [] });
    hod = await User.register(newHod, HOD_PASSWORD);
    console.log('  ✅ HOD user created:', HOD_USERNAME);
  } else {
    console.log('  HOD user already exists.');
  }

  return { faculty, hod };
}

// ── Seed Self-Appraisal & other document pages ──────────────────────────────
async function seedDocuments(faculty) {
  console.log('── Seeding Documents ──');
  const userID = faculty._id.toString();
  const year = 2026;

  const pages = [
    {
      pageID: 'c4e293e9-1f5c-4edd-a3e5-fa0dfc23e566', // SWAYAM
      entries: [
        ['2025-2026', 'Module 1: ICT in Education', { fileUploaded: null }],
        ['2025-2026', 'Module 2: Instructional Design', { fileUploaded: null }],
        ['2025-2026', 'Module 3: Pedagogical Approaches', { fileUploaded: null }],
      ]
    },
    {
      pageID: '2544a712-bd7d-46ee-8ca8-12c51f8bed35', // FDPs
      entries: [
        ['2025-2026', 'FDP on Deep Learning & AI Applications', '5 Days', { fileUploaded: null }],
        ['2025-2026', 'FDP on Cloud Computing & DevOps', '3 Days', { fileUploaded: null }],
      ]
    },
    {
      pageID: '71bcb869-24e1-4729-af2f-1dc0bdb37160', // MOOCs
      entries: [
        ['2025-2026', 'NPTEL - Deep Learning (IIT Madras)', '12 Weeks', { fileUploaded: null }],
        ['2025-2026', 'NPTEL - Machine Learning (IISc Bangalore)', '8 Weeks', { fileUploaded: null }],
      ]
    },
    {
      pageID: 'd2d32dbb-a6cc-458e-8110-61f192f06163', // Research publications
      entries: [
        ['2025-2026', 'A. Goyal et al., "Transformer-Based Approach for Academic Performance Prediction", Journal of AI in Education, Vol.15, DOI:10.1234/jaie.2025.001', 'Yes', '4.5', { fileUploaded: null }],
        ['2025-2026', 'A. Goyal, R. Kumar, "Federated Learning for Privacy-Preserving Student Analytics", IEEE Trans. on Learning Technologies, Vol.18, DOI:10.1109/TLT.2025.002', 'Yes', '6.2', { fileUploaded: null }],
      ]
    },
    {
      pageID: 'e335269e-e824-41c7-a7f8-dfe32ad563f0', // Patents
      entries: [
        ['2025-2026', 'AI-Powered Automated CO-PO Attainment System for Educational Institutions', 'Published', '2025-08-15', 'National', { fileUploaded: null }],
      ]
    },
    {
      pageID: '2a15c929-294c-4e8c-a145-5f5a207c3acf', // Research Projects
      entries: [
        ['2025-2026', 'Smart Campus Analytics using IoT and ML - PI: Dr. Anshul Goyal', '2 Years', 'Ongoing', '12.5', { fileUploaded: null }],
      ]
    },
    {
      pageID: 'ea758c6c-89aa-4223-9e3c-f053674bdaa7', // Teaching Process
      entries: [
        ['2025-2026', '5', 'CS501/Machine Learning', '45', '43', '22', { fileUploaded: null }],
        ['2025-2026', '5', 'CS502/Computer Networks', '45', '44', '24', { fileUploaded: null }],
      ]
    },
    {
      pageID: 'ef8b0c79-3799-4ba0-b5af-7f23516572c1', // Students Feedback
      entries: [
        ['2025-2026', '5', 'CS501/Machine Learning', '21.5', { fileUploaded: null }],
        ['2025-2026', '5', 'CS502/Computer Networks', '22.0', { fileUploaded: null }],
      ]
    },
    {
      pageID: '58ee31b4-bcd0-4152-84ee-d20541655d4c', // Journals
      entries: [
        ['2025-2026', 'A. Goyal, S. Patel', 'Neural Computing and Applications', '2025-03-15', '10.1007/NCA.2025.123', '1234-5678', '1-15', '38', '2', 'Reffered', { fileUploaded: null }],
      ]
    },
    {
      pageID: 'd4a4b731-0366-42cf-91d8-af45ce1e5c79', // Conferences
      entries: [
        ['2025-2026', 'Attention Mechanisms for Student Engagement Analysis', 'A. Goyal, V. Singh', 'IEEE ICALT 2025', '2025-07-10', '2025-07-12', 'IEEE', '10.1109/ICALT.2025.001', '978-1-234-56789-0', 'Tokyo, Japan', 'International', { fileUploaded: null }],
      ]
    },
    {
      pageID: '5f7b6f6d-fc1a-4086-85ff-adc1c3a4ffd7', // BTech Projects
      entries: [
        ['2025-2026', 'NS-Acad: Academic Performance Management System', 'Ishan, Anshul, Nikhil, Shivam', '2023CSE001, 2023CSE002, 2023CSE003, 2023CSE004', '4th Year', 'Major', { fileUploaded: null }],
        ['2025-2026', 'AI-Based Plagiarism Detection Tool', 'Rohan Mehta, Sneha Gupta', '2023CSE005, 2023CSE006', '4th Year', 'Minor', { fileUploaded: null }],
      ]
    },
    {
      pageID: 'ec5c1827-0dd3-498b-be5c-8d12b53b75cd', // Teaching Duty
      entries: [
        ['2025-2026', '2025-2026', 'CSE-A, CSE-B', 'CS501, CS502', 'Offline', '18', 'CS501', 'Offline', '18', '95%', '2', { fileUploaded: null }],
      ]
    },
  ];

  for (const page of pages) {
    await Data.deleteMany({ userID, pageID: page.pageID, year });
    const doc = new Data({
      userID,
      pageID: page.pageID,
      year,
      formData: page.entries,
    });
    await doc.save();
    console.log(`  ✅ ${page.pageID.substring(0, 8)}... → ${page.entries.length} entries`);
  }
}

// ── Seed CO-PO Mapping ──────────────────────────────────────────────────────
async function seedCoPoMapping(faculty) {
  console.log('── Seeding CO-PO Mappings ──');
  const facultyId = faculty._id.toString();

  const mappings = [
    {
      facultyId, subjectCode: 'CS501', subjectName: 'Machine Learning',
      academicYear: '2025-2026', semester: 5, branch: 'CSE', section: 'A',
      courseOutcomes: [
        { coIdentifier: 'CO1', po1: 3, po2: 3, po3: 2, po4: 1, po5: 2, po6: 0, po7: 0, po8: 0, po9: 1, po10: 0, po11: 0, po12: 2, pso1: 3, pso2: 2, pso3: 1, pso4: 0 },
        { coIdentifier: 'CO2', po1: 2, po2: 3, po3: 3, po4: 2, po5: 3, po6: 0, po7: 0, po8: 0, po9: 1, po10: 0, po11: 0, po12: 1, pso1: 3, pso2: 3, pso3: 2, pso4: 0 },
        { coIdentifier: 'CO3', po1: 2, po2: 2, po3: 3, po4: 3, po5: 2, po6: 1, po7: 0, po8: 0, po9: 2, po10: 0, po11: 1, po12: 2, pso1: 2, pso2: 3, pso3: 3, pso4: 1 },
        { coIdentifier: 'CO4', po1: 1, po2: 2, po3: 2, po4: 3, po5: 3, po6: 1, po7: 0, po8: 1, po9: 2, po10: 1, po11: 1, po12: 2, pso1: 2, pso2: 2, pso3: 3, pso4: 2 },
        { coIdentifier: 'CO5', po1: 2, po2: 1, po3: 2, po4: 2, po5: 3, po6: 2, po7: 1, po8: 1, po9: 3, po10: 2, po11: 2, po12: 3, pso1: 1, pso2: 2, pso3: 2, pso4: 3 },
      ]
    },
    {
      facultyId, subjectCode: 'CS502', subjectName: 'Computer Networks',
      academicYear: '2025-2026', semester: 5, branch: 'CSE', section: 'A',
      courseOutcomes: [
        { coIdentifier: 'CO1', po1: 3, po2: 2, po3: 1, po4: 1, po5: 2, po6: 0, po7: 0, po8: 0, po9: 1, po10: 0, po11: 0, po12: 1, pso1: 2, pso2: 2, pso3: 1, pso4: 0 },
        { coIdentifier: 'CO2', po1: 2, po2: 3, po3: 2, po4: 2, po5: 2, po6: 0, po7: 0, po8: 0, po9: 1, po10: 0, po11: 0, po12: 1, pso1: 2, pso2: 3, pso3: 1, pso4: 0 },
        { coIdentifier: 'CO3', po1: 1, po2: 2, po3: 3, po4: 2, po5: 3, po6: 1, po7: 0, po8: 0, po9: 2, po10: 1, po11: 1, po12: 2, pso1: 2, pso2: 2, pso3: 2, pso4: 1 },
        { coIdentifier: 'CO4', po1: 1, po2: 1, po3: 2, po4: 3, po5: 2, po6: 1, po7: 1, po8: 1, po9: 2, po10: 1, po11: 1, po12: 2, pso1: 1, pso2: 2, pso3: 3, pso4: 2 },
      ]
    },
  ];

  for (const m of mappings) {
    const filter = { subjectCode: m.subjectCode, academicYear: m.academicYear, semester: m.semester, branch: m.branch, section: m.section };
    await CoPoMapping.findOneAndUpdate(filter, m, { upsert: true, new: true, setDefaultsOnInsert: true });
    console.log(`  ✅ CO-PO Mapping for ${m.subjectCode} ${m.branch}-${m.section}`);
  }
}

// ── Seed TMS Assessments ─────────────────────────────────────────────────────
function buildTmsStudents(cos) {
  return STUDENTS.map(s => {
    const questions = cos.map(co => ({
      partA: { maxMarks: 5, coNumber: co, marksObtained: rand(2, 5) },
      partB: { maxMarks: 5, coNumber: co, marksObtained: rand(1, 5) },
    }));
    return {
      rollNo: s.rollNo, name: s.name,
      tmsMarks: [{ type: 'Tutorial', questions }],
      tesMarks: [], tcaMarks: [],
    };
  });
}

// ── Seed TES Assessments ─────────────────────────────────────────────────────
function buildTesStudents(cos) {
  return STUDENTS.map(s => {
    const questions = cos.map(co => ({
      partA: { maxMarks: 5, coNumber: co, marksObtained: rand(2, 5) },
      partB: { maxMarks: 10, coNumber: co, marksObtained: rand(4, 10) },
      partC: { maxMarks: 5, coNumber: co, marksObtained: rand(1, 5) },
    }));
    return {
      rollNo: s.rollNo, name: s.name,
      tesMarks: [{ questions }],
      tmsMarks: [], tcaMarks: [],
    };
  });
}

// ── Seed TCA Assessments ─────────────────────────────────────────────────────
function buildTcaStudents(cos) {
  return STUDENTS.map(s => {
    const marks = {};
    cos.forEach((co, i) => {
      const partKey = `q${i + 1}p1`;
      const obtained = rand(3, 10);
      marks[partKey] = {
        value: obtained,
        coDistribution: { [co]: obtained },
      };
    });
    return {
      rollNo: s.rollNo, name: s.name,
      tcaMarks: [{ assessmentNumber: 1, marks }],
      tmsMarks: [], tesMarks: [],
    };
  });
}

async function seedAssessments(faculty) {
  console.log('── Seeding Assessments ──');
  const facultyId = faculty._id;

  const subjects = [
    { code: 'CS501', name: 'Machine Learning', cos: ['CO1', 'CO2', 'CO3', 'CO4', 'CO5'] },
    { code: 'CS502', name: 'Computer Networks', cos: ['CO1', 'CO2', 'CO3', 'CO4'] },
  ];

  for (const subj of subjects) {
    const base = {
      facultyId, subject: { code: subj.code, name: subj.name },
      academicYear: '2025-2026', semester: 5, branch: 'CSE', section: 'A',
      numberOfStudents: STUDENTS.length,
    };

    // TMS
    const tmsFilter = { ...filterFrom(base), type: 'tms', tmsType: 'Tutorial' };
    await Assessment.findOneAndUpdate(tmsFilter, {
      ...base, type: 'tms', tmsType: 'Tutorial',
      students: buildTmsStudents(subj.cos),
      tmsConfig: { selectedCOs: subj.cos },
    }, { upsert: true, new: true });
    console.log(`  ✅ TMS for ${subj.code}`);

    // TCA
    const tcaFilter = { ...filterFrom(base), type: 'tca' };
    await Assessment.findOneAndUpdate(tcaFilter, {
      ...base, type: 'tca', assessmentNumber: 1,
      students: buildTcaStudents(subj.cos),
      tcaConfig: { tcaSelectedCOs: subj.cos },
    }, { upsert: true, new: true });
    console.log(`  ✅ TCA for ${subj.code}`);

    // TES
    const tesFilter = { ...filterFrom(base), type: 'tes' };
    await Assessment.findOneAndUpdate(tesFilter, {
      ...base, type: 'tes',
      students: buildTesStudents(subj.cos),
      tesConfig: { selectedCOs: subj.cos },
    }, { upsert: true, new: true });
    console.log(`  ✅ TES for ${subj.code}`);
  }
}

function filterFrom(base) {
  return {
    facultyId: base.facultyId,
    'subject.code': base.subject.code,
    academicYear: base.academicYear,
    semester: base.semester,
    branch: base.branch,
    section: base.section,
  };
}

// ── Seed Attainment Config ───────────────────────────────────────────────────
async function seedAttainmentConfig() {
  console.log('── Seeding Attainment Config ──');
  const filter = { department: 'CSE', academicYear: '2025-2026' };
  await AttainmentConfig.findOneAndUpdate(filter, {
    department: 'CSE', academicYear: '2025-2026',
    markThresholdPercentage: 50,
    attainmentLevels: [
      { level: 3, minStudentPercentage: 70 },
      { level: 2, minStudentPercentage: 60 },
      { level: 1, minStudentPercentage: 50 },
    ],
    assessmentWeights: { tca: 40, tms: 20, tes: 40 },
    directWeight: 80, indirectWeight: 20,
  }, { upsert: true, new: true });
  console.log('  ✅ Attainment Config created for CSE 2025-2026');
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════════════
async function main() {
  try {
    console.log('🚀 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URL);
    console.log('✅ Connected!\n');

    const { faculty } = await createUsers();
    await seedDocuments(faculty);
    await seedCoPoMapping(faculty);
    await seedAssessments(faculty);
    await seedAttainmentConfig();

    console.log('\n════════════════════════════════════════════');
    console.log('✅ ALL DEMO DATA SEEDED SUCCESSFULLY!');
    console.log('════════════════════════════════════════════');
    console.log(`\n🔑 Faculty Login:  ${FACULTY_USERNAME} / ${FACULTY_PASSWORD}`);
    console.log(`🔑 HOD Login:      ${HOD_USERNAME} / ${HOD_PASSWORD}`);
    console.log('\n📋 After logging in as faculty:');
    console.log('   • Sidebar pages will show demo entries');
    console.log('   • /copo → Select CS501 or CS502 for assessment');
    console.log('   • /copo/dashboard → Calculate & view attainment');
    console.log('════════════════════════════════════════════\n');

  } catch (err) {
    console.error('❌ Seed failed:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

main();
