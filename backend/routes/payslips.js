const express = require('express');
const path = require('path');
const fs = require('fs');
const { readDB } = require('../db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

// List own payslips
router.get('/me', (req, res) => {
  const db = readDB();
  const list = db.payslips
    .filter(p => p.userId === req.user.id)
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
  res.json(list);
});

// Download a payslip - employees can only download their own, admins can download any
router.get('/:id/download', (req, res) => {
  const db = readDB();
  const payslip = db.payslips.find(p => p.id === Number(req.params.id));
  if (!payslip) return res.status(404).json({ error: 'Payslip not found' });
  if (payslip.userId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'You are not authorized to access this payslip' });
  }
  const filePath = path.join(__dirname, '..', 'uploads', 'payslips', payslip.fileName);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found on server' });
  }
  res.download(filePath, payslip.originalName);
});

module.exports = router;
