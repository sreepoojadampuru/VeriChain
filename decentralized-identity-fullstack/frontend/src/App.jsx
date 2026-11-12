
import React, { useEffect, useState } from 'react';
import {
  ShieldCheck, LockKeyhole, FileText, Upload, LogOut,
  LayoutDashboard, CheckCircle2, XCircle, Eye, RefreshCw,
  Clock3, AlertCircle, UserRound, Building2, GraduationCap,
  Shield, FileCheck2, KeyRound
} from 'lucide-react';

const API = '';

async function api(path, options = {}, token = '') {
  const headers = { ...(options.headers || {}) };

  if (token) headers.Authorization = `Bearer ${token}`;
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API}${path}`, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }

  return data;
}

function App() {
  const [token, setToken] = useState(() => sessionStorage.getItem('verichain_token') || '');
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem('verichain_user') || 'null');
    } catch {
      return null;
    }
  });

  const [mode, setMode] = useState('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  function saveSession(data) {
    sessionStorage.setItem('verichain_token', data.token);
    sessionStorage.setItem('verichain_user', JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
    setError('');
    setNotice(data.message || 'Welcome to VeriChain.');
  }

  function logout() {
    sessionStorage.removeItem('verichain_token');
    sessionStorage.removeItem('verichain_user');
    setToken('');
    setUser(null);
    setNotice('');
    setError('');
  }

  async function handleAuth(event) {
    event.preventDefault();
    setLoading(true);
    setError('');

    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());

    try {
      const endpoint = mode === 'register'
        ? '/api/auth/register'
        : '/api/auth/login';

      const result = await api(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      saveSession(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!token) return;

    api('/api/auth/me', {}, token)
      .then(profile => setUser(profile))
      .catch(() => logout());
  }, []);

  if (!token || !user) {
    return (
      <AuthScreen
        mode={mode}
        setMode={setMode}
        onSubmit={handleAuth}
        loading={loading}
        error={error}
      />
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><ShieldCheck size={25} /></div>
          <div>
            <h2>VeriChain</h2>
            <span>Trusted Document Locker</span>
          </div>
        </div>

        <div className="side-label">WORKSPACE</div>
        <div className="side-link active">
          <LayoutDashboard size={18} />
          Dashboard
        </div>

        <div className="sidebar-bottom">
          <div className="user-card">
            <div className="avatar">
              {user.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div className="user-info">
              <strong>{user.name}</strong>
              <span>{user.role}</span>
            </div>
          </div>
          <button className="logout-button" onClick={logout}>
            <LogOut size={17} /> Sign out
          </button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div>
            <span className="eyebrow">VERICHAIN WORKSPACE</span>
            <h1>Dashboard</h1>
          </div>
          <div className="secure-indicator">
            <LockKeyhole size={15} /> Secure session
          </div>
        </header>

        <div className="page-content">
          {error && <div className="alert error"><AlertCircle size={17} />{error}</div>}
          {notice && <div className="alert success"><CheckCircle2 size={17} />{notice}</div>}

          {user.role === 'student' && (
            <StudentDashboard token={token} />
          )}
          {user.role === 'authority' && (
            <AuthorityDashboard token={token} />
          )}
          {user.role === 'admin' && (
            <PlaceholderDashboard
              title="Administrator workspace"
              description="The administrator dashboard will manage authority accounts, final approvals, platform oversight and audit records."
              icon={Shield}
            />
          )}
          {user.role === 'institution' && (
            <PlaceholderDashboard
              title="Institution workspace"
              description="The institution dashboard will let approved institutions request access to student documents and view documents shared with them."
              icon={Building2}
            />
          )}
          {!['student', 'authority', 'admin', 'institution'].includes(user.role) && (
            <PlaceholderDashboard
              title="Unknown account role"
              description="This account does not have a supported VeriChain role."
              icon={AlertCircle}
            />
          )}
        </div>
      </main>
    </div>
  );
}

function AuthScreen({ mode, setMode, onSubmit, loading, error }) {
  const registering = mode === 'register';

  return (
    <div className="auth-page">
      <div className="auth-decoration decoration-one" />
      <div className="auth-decoration decoration-two" />

      <div className="auth-brand">
        <div className="brand-mark"><ShieldCheck size={27} /></div>
        <span>VeriChain</span>
      </div>

      <section className="auth-card">
        <div className="auth-icon"><LockKeyhole size={25} /></div>
        <span className="eyebrow">YOUR DOCUMENTS. YOUR CONTROL.</span>
        <h1>{registering ? 'Create your account' : 'Welcome back'}</h1>
        <p className="auth-subtitle">
          {registering
            ? 'Create your secure student document locker.'
            : 'Sign in to access your trusted document locker.'}
        </p>

        {error && <div className="alert error"><AlertCircle size={17} />{error}</div>}

        <form onSubmit={onSubmit} className="auth-form">
          {registering && (
            <label>
              Full name
              <input name="name" placeholder="Enter your full name" required />
            </label>
          )}

          <label>
            Email address
            <input name="email" type="email" placeholder="you@example.com" required />
          </label>

          <label>
            Password
            <input
              name="password"
              type="password"
              placeholder="Enter your password"
              minLength={registering ? 8 : undefined}
              required
            />
            {registering && <small>Use at least 8 characters.</small>}
          </label>

          <button className="primary-button full-button" disabled={loading}>
            {loading ? 'Please wait...' : registering ? 'Create student account' : 'Sign in securely'}
          </button>
        </form>

        <div className="auth-switch">
          {registering ? 'Already have an account?' : 'New to VeriChain?'}
          <button onClick={() => setMode(registering ? 'login' : 'register')}>
            {registering ? 'Sign in' : 'Create account'}
          </button>
        </div>

        <div className="auth-security">
          <ShieldCheck size={15} />
          Student registration is open. Other roles require trusted provisioning.
        </div>
      </section>

      <p className="auth-footer">VERICHAIN · SECURE DOCUMENT VERIFICATION</p>
    </div>
  );
}

function SectionHeading({ eyebrow, title, description, action }) {
  return (
    <div className="section-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}

function StatusBadge({ status }) {
  const value = (status || 'unknown').toLowerCase();
  const label = value.replaceAll('_', ' ');
  return <span className={`status-badge status-${value}`}>{label}</span>;
}

function StudentDashboard({ token }) {
  const [documents, setDocuments] = useState([]);
  const [file, setFile] = useState(null);
  const [documentType, setDocumentType] = useState('Academic certificate');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function loadDocuments() {
    setLoading(true);
    setError('');
    try {
      const data = await api('/api/documents/my', {}, token);
      setDocuments(Array.isArray(data) ? data : data.documents || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadDocuments(); }, []);

  async function uploadDocument(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    if (!file) {
      setError('Please select a document first.');
      return;
    }

    setUploading(true);
    setError('');
    setNotice('');

    const form = new FormData();
    form.append('document', file);
    form.append('documentType', documentType);

    try {
      const result = await api('/api/documents/upload', {
        method: 'POST',
        body: form
      }, token);

      setNotice(result.message || 'Document uploaded successfully.');
      setFile(null);
      formElement.reset();
      await loadDocuments();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <SectionHeading
        eyebrow="STUDENT PORTAL"
        title="Your document locker"
        description="Upload your documents once. Track verification and stay in control of sharing."
        action={<button className="secondary-button" onClick={loadDocuments}><RefreshCw size={15} /> Refresh</button>}
      />

      {error && <div className="alert error"><AlertCircle size={17} />{error}</div>}
      {notice && <div className="alert success"><CheckCircle2 size={17} />{notice}</div>}

      <div className="stats-grid">
        <StatCard icon={FileText} label="Total documents" value={documents.length} />
        <StatCard icon={Clock3} label="Awaiting verification" value={documents.filter(d => ['pending_authority', 'pending_admin', 'review_required'].includes(d.status)).length} />
        <StatCard icon={CheckCircle2} label="Verified" value={documents.filter(d => d.status === 'verified').length} />
      </div>

      <div className="content-grid">
        <section className="panel upload-panel">
          <div className="panel-heading">
            <div className="panel-icon"><Upload size={19} /></div>
            <div><h3>Upload a document</h3><p>Encrypted before being stored.</p></div>
          </div>

          <form onSubmit={uploadDocument} className="upload-form">
            <label>Document category
              <select value={documentType} onChange={e => setDocumentType(e.target.value)}>
                <option>Academic certificate</option>
                <option>Identity document</option>
                <option>Mark sheet</option>
                <option>Other</option>
              </select>
            </label>

            <label className="file-drop">
              <Upload size={24} />
              <strong>{file ? file.name : 'Choose a document'}</strong>
              <span>PDF, PNG or JPG · Maximum 10 MB</span>
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                onChange={e => setFile(e.target.files?.[0] || null)}
              />
            </label>

            <button className="primary-button full-button" disabled={uploading}>
              {uploading ? 'Uploading securely...' : 'Upload to my locker'}
            </button>
          </form>
          <p className="privacy-note"><LockKeyhole size={14} /> Your uploaded file is encrypted in storage.</p>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div className="panel-icon"><FileCheck2 size={19} /></div>
            <div><h3>Verification journey</h3><p>How your documents become trusted.</p></div>
          </div>
          <div className="journey">
            <JourneyStep number="01" title="Upload" text="Your document is encrypted and stored." />
            <JourneyStep number="02" title="Authority review" text="The issuing authority checks authenticity." />
            <JourneyStep number="03" title="Admin approval" text="Platform admin completes final approval." />
            <JourneyStep number="04" title="Share securely" text="You control requests from institutions." />
          </div>
        </section>
      </div>

      <section className="panel documents-panel">
        <div className="panel-heading">
          <div><h3>My documents</h3><p>Your uploaded document records and their current status.</p></div>
        </div>

        {loading ? <p className="empty-state">Loading your documents...</p> :
          documents.length === 0 ? (
            <div className="empty-state"><FileText size={27} /><strong>No documents yet</strong><span>Upload your first document to get started.</span></div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Document</th><th>Uploaded</th><th>Verification status</th></tr></thead>
                <tbody>
                  {documents.map(doc => (
                    <tr key={doc.id}>
                      <td><div className="document-name"><FileText size={18} /><span>{doc.originalName}</span></div></td>
                      <td>{doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : '—'}</td>
                      <td><StatusBadge status={doc.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </section>
    </>
  );
}

function StatCard({ icon: Icon, label, value }) {
  return (
    <div className="stat-card">
      <div className="stat-icon"><Icon size={19} /></div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function JourneyStep({ number, title, text }) {
  return (
    <div className="journey-step">
      <span>{number}</span>
      <div><strong>{title}</strong><p>{text}</p></div>
    </div>
  );
}

function AuthorityDashboard({ token }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewName, setPreviewName] = useState('');

  async function loadPending() {
    setLoading(true);
    setError('');
    try {
      const data = await api('/api/authority/documents/pending', {}, token);
      setDocuments(Array.isArray(data) ? data : data.documents || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadPending(); }, []);

  async function previewDocument(doc) {
    setError('');
    try {
      const response = await fetch(`${API}/api/authority/documents/${doc.id}/view`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Unable to preview document.');
      }
      const blob = await response.blob();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
      setPreviewName(doc.originalName);
    } catch (err) {
      setError(err.message);
    }
  }

  async function reviewDocument(doc, decision) {
    let reason = '';
    if (decision === 'rejected') {
      reason = window.prompt('Enter the reason for rejection:') || '';
      if (!reason.trim()) return;
    } else if (!window.confirm(`Approve ${doc.originalName}?`)) {
      return;
    }

    setBusyId(doc.id);
    setError('');
    setNotice('');

    try {
      const result = await api(`/api/authority/documents/${doc.id}/review`, {
        method: 'PATCH',
        body: JSON.stringify({ decision, reason })
      }, token);

      setNotice(result.message || `Document ${decision}.`);
      await loadPending();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId('');
    }
  }

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  return (
    <>
      <SectionHeading
        eyebrow="ISSUING AUTHORITY"
        title="Document verification"
        description="Review submitted documents and record your verification decision."
        action={<button className="secondary-button" onClick={loadPending}><RefreshCw size={15} /> Refresh queue</button>}
      />

      {error && <div className="alert error"><AlertCircle size={17} />{error}</div>}
      {notice && <div className="alert success"><CheckCircle2 size={17} />{notice}</div>}

      <div className="stats-grid">
        <StatCard icon={Clock3} label="Pending reviews" value={documents.length} />
        <StatCard icon={ShieldCheck} label="Review process" value="Authority" />
        <StatCard icon={KeyRound} label="Access" value="Restricted" />
      </div>

      <section className="panel documents-panel">
        <div className="panel-heading">
          <div><h3>Pending document queue</h3><p>Open a document before approving or rejecting it.</p></div>
        </div>

        {loading ? <p className="empty-state">Loading review queue...</p> :
          documents.length === 0 ? (
            <div className="empty-state"><CheckCircle2 size={27} /><strong>All caught up</strong><span>There are no documents awaiting your review.</span></div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Document</th><th>Submitted</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {documents.map(doc => (
                    <tr key={doc.id}>
                      <td><div className="document-name"><FileText size={18} /><span>{doc.originalName}</span></div></td>
                      <td>{doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : '—'}</td>
                      <td><StatusBadge status={doc.status} /></td>
                      <td>
                        <div className="action-group">
                          <button className="icon-button" title="Preview document" onClick={() => previewDocument(doc)}><Eye size={16} /></button>
                          <button className="approve-button" disabled={busyId === doc.id || doc.duplicateDetected} onClick={() => reviewDocument(doc, 'approved')}><CheckCircle2 size={15} /> Approve</button>
                          <button className="reject-button" disabled={busyId === doc.id || doc.duplicateDetected} onClick={() => reviewDocument(doc, 'rejected')}><XCircle size={15} /> Reject</button>
                        </div>
                        {doc.duplicateDetected && <small className="warning-text">Duplicate flagged — manual review required.</small>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </section>

      {previewUrl && (
        <div className="modal-backdrop" onClick={() => setPreviewUrl('')}>
          <div className="preview-modal" onClick={e => e.stopPropagation()}>
            <div className="preview-header">
              <strong>{previewName}</strong>
              <button className="icon-button" onClick={() => setPreviewUrl('')}><XCircle size={19} /></button>
            </div>
            <iframe title="Document preview" src={previewUrl} />
          </div>
        </div>
      )}
    </>
  );
}

function PlaceholderDashboard({ title, description, icon: Icon }) {
  return (
    <>
      <SectionHeading
        eyebrow="VERICHAIN WORKSPACE"
        title={title}
        description={description}
      />
      <section className="panel coming-soon">
        <div className="panel-icon"><Icon size={25} /></div>
        <h3>Workspace setup in progress</h3>
        <p>This role is recognized by the authentication system. Its workflow and API integration will be added next.</p>
      </section>
    </>
  );
}

export default App;
