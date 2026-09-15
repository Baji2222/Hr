require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { readDB, writeDB, ensureDB } = require('./db');

const authRoutes = require('./routes/auth');
const attendanceRoutes = require('./routes/attendance');
const leaveRoutes = require('./routes/leave');
const payslipRoutes = require('./routes/payslips');
const requestRoutes = require('./routes/requests');
const adminRoutes = require('./routes/admin');

const app = express();
app.use(cors());
app.use(express.json());

ensureDB();
seedAdmin();

function seedAdmin() {
  const db = readDB();
  if (db.users.length === 0) {
    const id = (db.counters.users || 0) + 1;
    db.counters.users = id;
    db.users.push({
      id,
      name: 'HR Admin',
      email: 'admin@company.com',
      passwordHash: bcrypt.hashSync('admin123', 10),
      employeeCode: 'ADMIN001',
      department: 'HR',
      designation: 'HR Administrator',
      dateOfJoining: new Date().toISOString().slice(0, 10),
      role: 'admin',
      createdAt: new Date().toISOString()
    });
    writeDB(db);
    console.log('----------------------------------------------------------');
    console.log('Seeded default admin account:');
    console.log('  email:    admin@company.com');
    console.log('  password: admin123');
    console.log('Please log in and change this as soon as possible.');
    console.log('----------------------------------------------------------');
  }
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/leave', leaveRoutes);
app.use('/api/payslips', payslipRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/admin', adminRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Centralized error handler (catches multer errors, JSON parse errors, etc.)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`HR portal backend running on http://localhost:${PORT}`);
});
