const express = require('express');
const router = express.Router();
const Assessment = require('../models/Assessment');



router.post('/course-assessment/create', async (req, res) => {
  try {
    const courseAssessment = new CourseAssessment(req.body);
    const saved = await courseAssessment.save();
    res.status(201).json(saved);
  } catch (error) {
    console.error('Error creating course assessment:', error);
    res.status(500).json({ error: 'Failed to create course assessment' });
  }
});


router.get('/course-assessment/:id', async (req, res) => {
  try {
    const assessment = await CourseAssessment.findById(req.params.id);
    if (!assessment) {
      return res.status(404).json({ error: 'Assessment not found' });
    }
    res.json(assessment);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch assessment' });
  }
});


router.get('/faculty/:facultyId/assessments', async (req, res) => {
  try {
    const assessments = await CourseAssessment.find({ facultyId: req.params.facultyId });
    res.json(assessments);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch faculty assessments' });
  }
});

router.post('/course-assessment/:id/tms', async (req, res) => {
  try {
    const { studentId, tmsMarks } = req.body;
    const assessment = await CourseAssessment.findById(req.params.id);
    
    if (!assessment) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    const student = assessment.students.id(studentId);
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    student.tmsMarks.push(tmsMarks);
    await assessment.save();
    
    res.json(student.tmsMarks);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update TMS marks' });
  }
});


router.post('/course-assessment/:id/tca', async (req, res) => {
  try {
    const { studentId, tcaMarks } = req.body;
    const assessment = await CourseAssessment.findById(req.params.id);
    
    if (!assessment) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    const student = assessment.students.id(studentId);
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    student.tcaMarks.push(tcaMarks);
    await assessment.save();
    
    res.json(student.tcaMarks);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update TCA marks' });
  }
});


router.post('/course-assessment/:id/tes', async (req, res) => {
  try {
    const { studentId, tesSurvey } = req.body;
    const assessment = await CourseAssessment.findById(req.params.id);
    
    if (!assessment) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    const student = assessment.students.id(studentId);
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    student.tesSurvey = tesSurvey;
    await assessment.save();
    
    res.json(student.tesSurvey);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update TES survey' });
  }
});

router.post('/course-assessment/:id/calculate-attainment', async (req, res) => {
  try {
    const assessment = await CourseAssessment.findById(req.params.id);
    
    if (!assessment) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    for (const student of assessment.students) {
      student.copoAttainment = calculateStudentAttainment(student, assessment);
    }

    assessment.overallAttainment = calculateOverallAttainment(assessment);
    
    await assessment.save();
    res.json(assessment.overallAttainment);
  } catch (error) {
    res.status(500).json({ error: 'Failed to calculate attainment' });
  }
});


router.get('/course-assessment/:id/statistics', async (req, res) => {
  try {
    const assessment = await CourseAssessment.findById(req.params.id);
    
    if (!assessment) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    const statistics = {
      tmsAverages: calculateTMSAverages(assessment),
      tcaAverages: calculateTCAAverages(assessment),
      tesAverages: calculateTESAverages(assessment),
      coAttainment: assessment.overallAttainment,
      studentCount: assessment.students.length,
      passPercentage: calculatePassPercentage(assessment)
    };

    res.json(statistics);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});


router.get('/course-assessment/:id/student/:studentId', async (req, res) => {
  try {
    const assessment = await CourseAssessment.findById(req.params.id);
    
    if (!assessment) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    const student = assessment.students.id(req.params.studentId);
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    res.json(student);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch student data' });
  }
});


function calculateStudentAttainment(student, assessment) {
  // Implementation for calculating individual student's attainment
  // This would include TMS, TCA, and TES calculations based on weights
  // Return array of CO attainments
}

function calculateOverallAttainment(assessment) {
  // Implementation for calculating overall course attainment
  // This would aggregate all student attainments and calculate final values
}

function calculateTMSAverages(assessment) {
  // Calculate averages for tutorials, mini projects, and surprise tests
}

function calculateTCAAverages(assessment) {
  // Calculate averages for each CIA
}

function calculateTESAverages(assessment) {
  // Calculate averages for TES responses
}

function calculatePassPercentage(assessment) {
  // Calculate overall pass percentage for the course
}

module.exports = router;
