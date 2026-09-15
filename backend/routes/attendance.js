const express = require('express');
const { readDB, writeDB, nextId } = require('../db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// Check in for today
router.post('/checkin', (req, res) => {
  const db = readDB();
  const date = todayStr();
  let record = db.attendance.find(a => a.userId === req.user.id && a.date === date);

  if (record && record.checkIn) {
    return res.status(400).json({ error: 'You have already checked in today' });
  }

  const now = new Date().toISOString();
  if (!record) {
    record = {
      id: nextId(db, 'attendance'),
      userId: req.user.id,
      date,
      checkIn: now,
      checkOut: null,
      status: 'present',
      notes: ''
    };
    db.attendance.push(record);
  } else {
    record.checkIn = now;
    record.status = 'present';
  }
  writeDB(db);
  res.json(record);
});

// Check out for today
router.post('/checkout', (req, res) => {
  const db = readDB();
  const date = todayStr();
  const record = db.attendance.find(a => a.userId === req.user.id && a.date === date);

  if (!record || !record.checkIn) {
    return res.status(400).json({ error: 'You must check in before checking out' });
  }
  if (record.checkOut) {
    return res.status(400).json({ error: 'You have already checked out today' });
  }
  record.checkOut = new Date().toISOString();
  writeDB(db);
  res.json(record);
});

// Full history for the logged-in employee
router.get('/me', (req, res) => {
  const db = readDB();
  const logs = db.attendance
    .filter(a => a.userId === req.user.id)
    .sort((a, b) => b.date.localeCompare(a.date));
  res.json(logs);
});

// Today's record only, so the UI knows whether to show check-in or check-out
router.get('/today', (req, res) => {
  const db = readDB();
  const date = todayStr();
  const record = db.attendance.find(a => a.userId === req.user.id && a.date === date) || null;
  res.json(record);
});

module.exports = router;
