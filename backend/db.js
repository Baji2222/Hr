// Simple JSON-file backed data store.
//
// This is deliberately dumb and dependency-free so it runs anywhere with
// zero setup. All reads/writes go through this file, so swapping this out
// for Supabase later just means rewriting the functions below (readDB,
// writeDB, nextId) - the rest of the app never touches the file system
// directly.

const fs = require('fs');
const path = require('path');

const DB_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DB_DIR, 'db.json');

const DEFAULT_DATA = {
  users: [],
  attendance: [],
  leaveRequests: [],
  payslips: [],
  requests: [],
  counters: {
    users: 0,
    attendance: 0,
    leaveRequests: 0,
    payslips: 0,
    requests: 0
  }
};

function ensureDB() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(DEFAULT_DATA, null, 2));
  }
}

function readDB() {
  ensureDB();
  const raw = fs.readFileSync(DB_FILE, 'utf-8');
  return JSON.parse(raw);
}

function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

function nextId(data, collection) {
  data.counters[collection] = (data.counters[collection] || 0) + 1;
  return data.counters[collection];
}

module.exports = { readDB, writeDB, nextId, ensureDB, DB_FILE };
