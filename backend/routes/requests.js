const express = require('express');
const { readDB, writeDB, nextId } = require('../db');
const { authRequired } = require('../middleware/auth');
const { sendMail } = require('../utils/mailer');

const router = express.Router();
router.use(authRequired);

// Submit a general request to HR (document request, query, etc.)
router.post('/', (req, res) => {
  const { subject, message } = req.body || {};
  if (!subject || !message) {
    return res.status(400).json({ error: 'subject and message are required' });
  }
  const db = readDB();
  const request = {
    id: nextId(db, 'requests'),
    userId: req.user.id,
    subject,
    message,
    status: 'open',
    adminReply: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  db.requests.push(request);
  writeDB(db);

  const user = db.users.find(u => u.id === req.user.id);
  const admins = db.users.filter(u => u.role === 'admin');
  admins.forEach(admin => {
    sendMail({
      to: admin.email,
      subject: `New HR request: ${subject}`,
      text: `${user ? user.name : 'An employee'} (${user ? user.employeeCode : ''}) submitted a request:\n\nSubject: ${subject}\nMessage: ${message}`
    });
  });

  res.status(201).json(request);
});

// Own request history
router.get('/me', (req, res) => {
  const db = readDB();
  const list = db.requests
    .filter(r => r.userId === req.user.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json(list);
});

module.exports = router;
