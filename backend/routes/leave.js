const express = require('express');
const { readDB, writeDB, nextId } = require('../db');
const { authRequired } = require('../middleware/auth');
const { sendMail } = require('../utils/mailer');

const router = express.Router();
router.use(authRequired);

// Apply for leave
router.post('/', (req, res) => {
  const { fromDate, toDate, type, reason } = req.body || {};
  if (!fromDate || !toDate || !type) {
    return res.status(400).json({ error: 'fromDate, toDate and type are required' });
  }
  if (new Date(toDate) < new Date(fromDate)) {
    return res.status(400).json({ error: 'toDate cannot be before fromDate' });
  }

  const db = readDB();
  const leave = {
    id: nextId(db, 'leaveRequests'),
    userId: req.user.id,
    fromDate,
    toDate,
    type,
    reason: reason || '',
    status: 'pending',
    adminComment: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  db.leaveRequests.push(leave);
  writeDB(db);

  const user = db.users.find(u => u.id === req.user.id);
  const admins = db.users.filter(u => u.role === 'admin');
  admins.forEach(admin => {
    sendMail({
      to: admin.email,
      subject: `New leave request from ${user ? user.name : 'an employee'}`,
      text: `${user ? user.name : 'An employee'} (${user ? user.employeeCode : ''}) requested ${type} leave from ${fromDate} to ${toDate}.\nReason: ${reason || 'N/A'}\n\nLog in to the HR portal to approve or reject this request.`
    });
  });

  res.status(201).json(leave);
});

// Own leave history
router.get('/me', (req, res) => {
  const db = readDB();
  const logs = db.leaveRequests
    .filter(l => l.userId === req.user.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json(logs);
});

module.exports = router;
