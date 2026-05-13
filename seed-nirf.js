require('dotenv').config();
const mongoose = require('mongoose');
const NirfData = require('./models/NirfData');

const MONGO_URL = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017/ns-acad';

async function seed() {
  try {
    await mongoose.connect(MONGO_URL, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB');

    // Clear existing data
    await NirfData.deleteMany({});
    console.log('Cleared existing NIRF data');

    const dummyData = [];
    
    // Generate realistic data for 30 universities across 5 years
    for (let i = 1; i <= 30; i++) {
      for (let year = 2019; year <= 2023; year++) {
        const base_quality = 0.5 + (Math.random() * 0.45);
        const publications = Math.floor(150 + base_quality * 300 + (Math.random() * 50));
        const citations = Math.floor(publications * (3 + Math.random() * 12) * base_quality);
        const citations_per_paper = parseFloat((citations / publications).toFixed(2));
        const patents_granted = Math.floor(5 * base_quality + Math.random() * 2);
        const patents_published = Math.floor(8 * base_quality + Math.random() * 3);
        const projects = Math.floor(20 + base_quality * 30 + Math.random() * 10);
        const funding = parseFloat((5 + base_quality * 20 + Math.random() * 5).toFixed(2));
        const phd_faculty = Math.floor(80 + base_quality * 100 + Math.random() * 20);
        const total_faculty = Math.floor(phd_faculty / (0.7 + Math.random() * 0.2));
        const phd_ratio = parseFloat((phd_faculty / total_faculty).toFixed(2));
        const students = Math.floor(1500 + base_quality * 2000 + Math.random() * 500);
        const fs_ratio = parseFloat((total_faculty / students).toFixed(3));
        
        const tlr = parseFloat(((publications * 0.3 + citations * 0.02 + patents_granted * 5) / 10).toFixed(2));
        const rpc = parseFloat(((projects * 2 + funding) / 10).toFixed(2));
        const go = parseFloat((Math.random() * 30 + 40).toFixed(2));
        const oi = parseFloat((Math.random() * 30 + 40).toFixed(2));
        const peer = parseFloat((Math.random() * 30 + 40).toFixed(2));
        const nirf = parseFloat((tlr * 0.3 + rpc * 0.2 + go * 0.15 + oi * 0.15 + peer * 0.2).toFixed(2));

        dummyData.push({
          university: `University_${i}`,
          year: year,
          publicationsScopus: publications,
          citationsTotal: citations,
          citationsPerPaper: citations_per_paper,
          patentsGranted: patents_granted,
          patentsPublished: patents_published,
          projectsCount: projects,
          fundingAmountLakhs: funding,
          phdFaculty: phd_faculty,
          totalFaculty: total_faculty,
          phdFacultyRatio: phd_ratio,
          totalStudents: students,
          facultyStudentRatio: fs_ratio,
          tlrScore: tlr,
          rpcScore: rpc,
          goScore: go,
          oiScore: oi,
          peerScore: peer,
          nirfScore: nirf
        });
      }
    }

    await NirfData.insertMany(dummyData);
    console.log(`Successfully seeded ${dummyData.length} records into the NirfData collection.`);

  } catch (error) {
    console.error('Error seeding data:', error);
  } finally {
    mongoose.connection.close();
    console.log('MongoDB connection closed.');
  }
}

seed();
