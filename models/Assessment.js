const mongoose = require('mongoose');

const TMSMarkSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['Tutorial', 'MiniProject', 'SurpriseTest'],
    required: true
  },
  marksObtained: Number,
  maxMarks: Number,
  date: Date,
  description: String,
  coNumber: String 
});

const TCAMarkSchema = new mongoose.Schema({
  assessmentNumber: {
    type: Number,
    enum: [1, 2, 3],
    required: true
  },
  questionMarks: [{
    questionNumber: Number,
    parts: [{
      partNumber: Number,
      maxMarks: Number,
      marksObtained: Number,
      coNumber: String
    }]
  }],
  totalMarks: Number,
  date: Date 
});

const TESSchema = new mongoose.Schema({
  surveyDate: Date,
  responses: [{
    questionNumber: Number,
    rating: Number,
    coNumber: String
  }],
  comments: String,
  overallRating: Number
});

const StudentAssessmentSchema = new mongoose.Schema({
  rollNo: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  tmsMarks: [TMSMarkSchema],
  tcaMarks: [TCAMarkSchema],
  tesSurvey: TESSchema,
  copoAttainment: [{
    coNumber: String,
    attainmentLevel: Number,
    tmsContribution: Number,
    tcaContribution: Number,
    tesContribution: Number
  }]
});

const CourseAssessmentSchema = new mongoose.Schema({
  academicYear: {
    type: String,
    required: true
  },
  semester: {
    type: Number,
    required: true
  },
  branch: {
    type: String,
    required: true
  },
  section: {
    type: String,
    required: true
  },
  course: {
    code: String,
    name: String,
    credits: Number
  },
  facultyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  numberOfStudents: Number,
  
  tmsConfig: {
    tutorials: {
      count: Number,
      maxMarksEach: Number,
      weightage: Number
    },
    miniProjects: {
      count: Number,
      maxMarksEach: Number,
      weightage: Number
    },
    surpriseTests: {
      count: Number,
      maxMarksEach: Number,
      weightage: Number
    },
    coMapping: [{
      assessmentType: String,
      number: Number,
      coNumber: String
    }]
  },
  
  tcaConfig: {
    numberOfAssessments: {
      type: Number,
      default: 3
    },
    weightage: Number,
    questionPatterns: [{
      assessmentNumber: Number,
      numberOfQuestions: Number,
      marksPerQuestion: Number,
      coMapping: [{
        questionNumber: Number,
        coNumber: String
      }]
    }]
  },
  
  tesConfig: {
    numberOfQuestions: Number,
    weightage: Number,
    coMapping: [{
      questionNumber: Number,
      coNumber: String
    }]
  },
  
  students: [StudentAssessmentSchema],
  
  courseOutcomes: [{
    coNumber: String,
    description: String,
    targetAttainmentLevel: Number
  }],
  
  overallAttainment: {
    tmsAttainment: Number,
    tcaAttainment: Number,
    tesAttainment: Number,
    finalAttainment: Number
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

CourseAssessmentSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const Assessment = mongoose.model('Assessment', CourseAssessmentSchema);

module.exports = {
  Assessment
};
