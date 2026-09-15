const express = require('express');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { readDB, writeDB, nextId } = require('../db');
const { authRequired, adminOnly } = require('../middleware/auth');
const { sendMail } = require('../utils/mailer');

const router = express.Router();
router.use(authRequired, adminOnly);

// ---------------------------------------------------------------------------
// Employees
// ---------------------------------------------------------------------------

router.get('/employees', (req, res) => {
  const db = readDB();
  res.json(db.users.map(({ passwordHash, ...u }) => u));
});

router.post('/employees', (req, res) => {
  const { name, email, password, employeeCode, department, designation, dateOfJoining, role } = req.body || {};
  if (!name || !email || !password || !employeeCode) {
    return res.status(400).json({ error: 'name, email, password and employeeCode are required' });
  }
  const db = readDB();
  if (db.users.some(u => u.email.toLowerCase() === String(email).toLowerCase())) {
    return res.status(409).json({ error: 'An employee with this email already exists' });
  }
  if (db.users.some(u => u.employeeCode === employeeCode)) {
    return res.status(409).json({ error: 'An employee with this employee code already exists' });
  }
  const user = {
    id: nextId(db, 'users'),
    name,
    email,
    passwordHash: bcrypt.hashSync(password, 10),
    employeeCode,
    department: department || '',
    designation: designation || '',
    dateOfJoining: dateOfJoining || '',
    role: role === 'admin' ? 'admin' : 'employee',
    createdAt: new Date().toISOString()
  };
  db.users.push(user);
  writeDB(db);

  sendMail({
    to: user.email,
    subject: 'Your HR portal account has been created',
    text: `Hi ${user.name},\n\nAn HR portal account has been created for you.\n\nLogin email: ${user.email}\nTemporary password: ${password}\n\nPlease log in and keep your credentials safe.`
  });

  const { passwordHash, ...safeUser } = user;
  res.status(201).json(safeUser);
});

router.put('/employees/:id', (req, res) => {
  const db = readDB();
  const user = db.users.find(u => u.id === Number(req.params.id));
  if (!user) return res.status(404).json({ error: 'Employee not found' });

  const { name, department, designation, dateOfJoining, role, password } = req.body || {};
  if (name) user.name = name;
  if (department !== undefined) user.department = department;
  if (designation !== undefined) user.designation = designation;
  if (dateOfJoining !== undefined) user.dateOfJoining = dateOfJoining;
  if (role) user.role = role === 'admin' ? 'admin' : 'employee';
  if (password) user.passwordHash = bcrypt.hashSync(password, 10);

  writeDB(db);
  const { passwordHash, ...safeUser } = user;
  res.json(safeUser);
});

router.delete('/employees/:id', (req, res) => {
  const db = readDB();
  const idx = db.users.findIndex(u => u.id === Number(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Employee not found' });
  if (db.users[idx].id === req.user.id) {
    return res.status(400).json({ error: 'You cannot delete your own account' });
  }
  db.users.splice(idx, 1);
  writeDB(db);
  res.json({ success: true });
});

// ---------------------------------------------------------------------------
// Attendance (read-only overview across everyone)
// ---------------------------------------------------------------------------

router.get('/attendance', (req, res) => {
  const db = readDB();
  const { employeeId, date } = req.query;
  let logs = db.attendance;
  if (employeeId) logs = logs.filter(a => a.userId === Number(employeeId));
  if (date) logs = logs.filter(a => a.date === date);

  const withNames = logs.map(a => {
    const u = db.users.find(u => u.id === a.userId);
    return { ...a, employeeName: u ? u.name : 'Unknown', employeeCode: u ? u.employeeCode : '' };
  });
  res.json(withNames.sort((a, b) => b.date.localeCompare(a.date)));
});

// ---------------------------------------------------------------------------
// Leave requests
// ---------------------------------------------------------------------------

router.get('/leave', (req, res) => {
  const db = readDB();
  const withNames = db.leaveRequests.map(l => {
    const u = db.users.find(u => u.id === l.userId);
    return { ...l, employeeName: u ? u.name : 'Unknown', employeeCode: u ? u.employeeCode : '' };
  });
  res.json(withNames.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
});

router.put('/leave/:id', (req, res) => {
  const db = readDB();
  const leave = db.leaveRequests.find(l => l.id === Number(req.params.id));
  if (!leave) return res.status(404).json({ error: 'Leave request not found' });

  const { status, adminComment } = req.body || {};
  if (!['approved', 'rejected', 'pending'].includes(status)) {
    return res.status(400).json({ error: 'status must be approved, rejected or pending' });
  }
  leave.status = status;
  leave.adminComment = adminComment || '';
  leave.updatedAt = new Date().toISOString();
  writeDB(db);

  const user = db.users.find(u => u.id === leave.userId);
  if (user) {
    sendMail({
      to: user.email,
      subject: `Your leave request has been ${status}`,
      text: `Hi ${user.name},\n\nYour leave request from ${leave.fromDate} to ${leave.toDate} has been ${status}.${adminComment ? '\nHR comment: ' + adminComment : ''}`
    });
  }
  res.json(leave);
});

// ---------------------------------------------------------------------------
// Payslips - HR uploads the file it received/generated, employee downloads it
// ---------------------------------------------------------------------------

const uploadDir = path.join(__dirname, '..', 'uploads', 'payslips');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const safeEmployee = req.body.employeeId || 'unknown';
    const safeMonth = (req.body.month || 'month').replace(/[^a-z0-9]/gi, '');
    const safeYear = (req.body.year || 'year').replace(/[^a-z0-9]/gi, '');
    cb(null, `payslip_${safeEmployee}_${safeYear}_${safeMonth}_${Date.now()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.png', '.jpg', '.jpeg'];
    if (allowed.includes(path.extname(file.originalname).toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, PNG or JPG files are allowed'));
    }
  }
});

router.post('/payslips', upload.single('file'), (req, res) => {
  const { employeeId, month, year } = req.body || {};
  if (!employeeId || !month || !year || !req.file) {
    return res.status(400).json({ error: 'employeeId, month, year and file are all required' });
  }
  const db = readDB();
  const user = db.users.find(u => u.id === Number(employeeId));
  if (!user) return res.status(404).json({ error: 'Employee not found' });

  const payslip = {
    id: nextId(db, 'payslips'),
    userId: Number(employeeId),
    month,
    year,
    fileName: req.file.filename,
    originalName: req.file.originalname,
    uploadedAt: new Date().toISOString()
  };
  db.payslips.push(payslip);
  writeDB(db);

  sendMail({
    to: user.email,
    subject: `Payslip for ${month} ${year} is ready`,
    text: `Hi ${user.name},\n\nYour payslip for ${month} ${year} has been uploaded to the HR portal. Log in to download it any time.`
  });

  res.status(201).json(payslip);
});

router.get('/payslips', (req, res) => {
  const db = readDB();
  const withNames = db.payslips.map(p => {
    const u = db.users.find(u => u.id === p.userId);
    return { ...p, employeeName: u ? u.name : 'Unknown', employeeCode: u ? u.employeeCode : '' };
  });
  res.json(withNames.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)));
});

// Payslip upload errors (e.g. wrong file type) come back through multer's
// error-first callback style rather than throwing, so surface them cleanly.
router.use((err, req, res, next) => {
  if (err) return res.status(400).json({ error: err.message });
  next();
});

// ---------------------------------------------------------------------------
// Generic HR requests
// ---------------------------------------------------------------------------

router.get('/requests', (req, res) => {
  const db = readDB();
  const withNames = db.requests.map(r => {
    const u = db.users.find(u => u.id === r.userId);
    return { ...r, employeeName: u ? u.name : 'Unknown', employeeCode: u ? u.employeeCode : '' };
  });
  res.json(withNames.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
});

router.put('/requests/:id', (req, res) => {
  const db = readDB();
  const request = db.requests.find(r => r.id === Number(req.params.id));
  if (!request) return res.status(404).json({ error: 'Request not found' });

  const { status, adminReply } = req.body || {};
  if (status) request.status = status;
  if (adminReply !== undefined) request.adminReply = adminReply;
  request.updatedAt = new Date().toISOString();
  writeDB(db);

  const user = db.users.find(u => u.id === request.userId);
  if (user) {
    sendMail({
      to: user.email,
      subject: `Update on your request: ${request.subject}`,
      text: `Hi ${user.name},\n\nYour request "${request.subject}" is now: ${request.status}.${adminReply ? '\nHR reply: ' + adminReply : ''}`
    });
  }
  res.json(request);
});

module.exports = router;
