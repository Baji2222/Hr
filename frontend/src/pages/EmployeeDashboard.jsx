import { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import api, { errMsg } from '../api';

const TABS = ['Attendance', 'Leave', 'Payslips', 'Requests'];

export default function EmployeeDashboard() {
  const [tab, setTab] = useState('Attendance');

  return (
    <div className="app-shell">
      <Navbar />
      <main className="main">
        <div className="tabs">
          {TABS.map((t) => (
            <button
              key={t}
              className={`tab ${tab === t ? 'tab-active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === 'Attendance' && <AttendanceTab />}
        {tab === 'Leave' && <LeaveTab />}
        {tab === 'Payslips' && <PayslipsTab />}
        {tab === 'Requests' && <RequestsTab />}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------

function AttendanceTab() {
  const [today, setToday] = useState(null);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const [todayRes, historyRes] = await Promise.all([
        api.get('/attendance/today'),
        api.get('/attendance/me')
      ]);
      setToday(todayRes.data);
      setHistory(historyRes.data);
    } catch (err) {
      setError(errMsg(err));
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function checkIn() {
    setBusy(true);
    setError('');
    try {
      await api.post('/attendance/checkin');
      await load();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  async function checkOut() {
    setBusy(true);
    setError('');
    try {
      await api.post('/attendance/checkout');
      await load();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  const canCheckIn = !today || !today.checkIn;
  const canCheckOut = today && today.checkIn && !today.checkOut;

  return (
    <div className="card">
      <div className="card-header">
        <h2>Today's Attendance</h2>
      </div>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="attendance-actions">
        <button className="btn btn-primary" onClick={checkIn} disabled={!canCheckIn || busy}>
          Check In
        </button>
        <button className="btn btn-secondary" onClick={checkOut} disabled={!canCheckOut || busy}>
          Check Out
        </button>
        {today && (
          <div className="attendance-status">
            {today.checkIn && <span>In: {formatTime(today.checkIn)}</span>}
            {today.checkOut && <span>Out: {formatTime(today.checkOut)}</span>}
          </div>
        )}
      </div>

      <h3 className="section-title">History</h3>
      <table className="table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Check In</th>
            <th>Check Out</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {history.length === 0 && (
            <tr>
              <td colSpan="4" className="empty-row">No attendance records yet.</td>
            </tr>
          )}
          {history.map((h) => (
            <tr key={h.id}>
              <td>{h.date}</td>
              <td>{h.checkIn ? formatTime(h.checkIn) : '—'}</td>
              <td>{h.checkOut ? formatTime(h.checkOut) : '—'}</td>
              <td>
                <span className={`badge status-${h.status}`}>{h.status}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------

function LeaveTab() {
  const [history, setHistory] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ fromDate: '', toDate: '', type: 'casual', reason: '' });

  async function load() {
    try {
      const res = await api.get('/leave/me');
      setHistory(res.data);
    } catch (err) {
      setError(errMsg(err));
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setBusy(true);
    try {
      await api.post('/leave', form);
      setForm({ fromDate: '', toDate: '', type: 'casual', reason: '' });
      setSuccess('Leave request submitted. HR has been notified by email.');
      await load();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid-2">
      <div className="card">
        <div className="card-header">
          <h2>Apply for Leave</h2>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}
        <form onSubmit={handleSubmit}>
          <div className="field-row">
            <label className="field">
              <span>From</span>
              <input
                type="date"
                required
                value={form.fromDate}
                onChange={(e) => setForm({ ...form, fromDate: e.target.value })}
              />
            </label>
            <label className="field">
              <span>To</span>
              <input
                type="date"
                required
                value={form.toDate}
                onChange={(e) => setForm({ ...form, toDate: e.target.value })}
              />
            </label>
          </div>
          <label className="field">
            <span>Type</span>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="casual">Casual</option>
              <option value="sick">Sick</option>
              <option value="earned">Earned</option>
              <option value="unpaid">Unpaid</option>
            </select>
          </label>
          <label className="field">
            <span>Reason</span>
            <textarea
              rows="3"
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="Brief reason for HR"
            />
          </label>
          <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
            {busy ? 'Submitting...' : 'Submit Request'}
          </button>
        </form>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Leave History</h2>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Dates</th>
              <th>Type</th>
              <th>Status</th>
              <th>HR Comment</th>
            </tr>
          </thead>
          <tbody>
            {history.length === 0 && (
              <tr>
                <td colSpan="4" className="empty-row">No leave requests yet.</td>
              </tr>
            )}
            {history.map((l) => (
              <tr key={l.id}>
                <td>{l.fromDate} → {l.toDate}</td>
                <td>{l.type}</td>
                <td><span className={`badge status-${l.status}`}>{l.status}</span></td>
                <td>{l.adminComment || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function PayslipsTab() {
  const [payslips, setPayslips] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/payslips/me')
      .then((res) => setPayslips(res.data))
      .catch((err) => setError(errMsg(err)));
  }, []);

  async function download(id, originalName) {
    try {
      const res = await api.get(`/payslips/${id}/download`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = originalName || 'payslip';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(errMsg(err));
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <h2>Payslips</h2>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      <table className="table">
        <thead>
          <tr>
            <th>Month</th>
            <th>Year</th>
            <th>Uploaded</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {payslips.length === 0 && (
            <tr>
              <td colSpan="4" className="empty-row">
                No payslips uploaded yet. HR will upload them here once available.
              </td>
            </tr>
          )}
          {payslips.map((p) => (
            <tr key={p.id}>
              <td>{p.month}</td>
              <td>{p.year}</td>
              <td>{formatDate(p.uploadedAt)}</td>
              <td>
                <button className="btn btn-ghost btn-sm" onClick={() => download(p.id, p.originalName)}>
                  Download
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------

function RequestsTab() {
  const [history, setHistory] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ subject: '', message: '' });

  async function load() {
    try {
      const res = await api.get('/requests/me');
      setHistory(res.data);
    } catch (err) {
      setError(errMsg(err));
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setBusy(true);
    try {
      await api.post('/requests', form);
      setForm({ subject: '', message: '' });
      setSuccess('Request sent to HR by email.');
      await load();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid-2">
      <div className="card">
        <div className="card-header">
          <h2>Raise a Request to HR</h2>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}
        <form onSubmit={handleSubmit}>
          <label className="field">
            <span>Subject</span>
            <input
              type="text"
              required
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              placeholder="e.g. Need Form 16"
            />
          </label>
          <label className="field">
            <span>Message</span>
            <textarea
              rows="4"
              required
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              placeholder="Describe your request"
            />
          </label>
          <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
            {busy ? 'Sending...' : 'Send Request'}
          </button>
        </form>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>My Requests</h2>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Subject</th>
              <th>Status</th>
              <th>HR Reply</th>
            </tr>
          </thead>
          <tbody>
            {history.length === 0 && (
              <tr>
                <td colSpan="3" className="empty-row">No requests yet.</td>
              </tr>
            )}
            {history.map((r) => (
              <tr key={r.id}>
                <td>{r.subject}</td>
                <td><span className={`badge status-${r.status}`}>{r.status}</span></td>
                <td>{r.adminReply || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString();
}
