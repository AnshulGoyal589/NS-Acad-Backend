const mongoose = require('mongoose');

const nirfDataSchema = new mongoose.Schema({
  university: String,
  year: Number,
  publicationsScopus: Number,
  citationsTotal: Number,
  citationsPerPaper: Number,
  patentsGranted: Number,
  patentsPublished: Number,
  projectsCount: Number,
  fundingAmountLakhs: Number,
  phdFaculty: Number,
  totalFaculty: Number,
  phdFacultyRatio: Number,
  totalStudents: Number,
  facultyStudentRatio: Number,
  tlrScore: Number,
  rpcScore: Number,
  goScore: Number,
  oiScore: Number,
  peerScore: Number,
  nirfScore: Number
});

const NirfData = mongoose.model('NirfData', nirfDataSchema);

module.exports = NirfData;
