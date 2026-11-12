
import * as React from 'react';
import { useEffect, useState } from 'react';
import { BrowserProvider, Contract } from 'ethers';
import { ShieldCheck, Wallet, FileCheck2, SearchCheck, Ban, Copy, RefreshCw, Blocks, ArrowUpRight, CheckCircle2, AlertCircle, GraduationCap } from 'lucide-react';
import { ABI } from './contract.js';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || '';

async function api(path, options = {}) {
  const response = await fetch(`${API}${path}`, { headers: { 'Content-Type': 'application/json' }, ...options });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export default function App() {
  const [account, setAccount] = useState('');
  const [network, setNetwork] = useState('Not connected');
  const [tab, setTab] = useState('issue');
  const [form, setForm] = useState({ studentName: '', credentialName: 'Course Completion Certificate', studentId: '', issuedOn: new Date().toISOString().slice(0, 10) });
  const [credentialId, setCredentialId] = useState('');
  const [records, setRecords] = useState([]);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  const contractReady = Boolean(CONTRACT_ADDRESS && /^0x[a-fA-F0-9]{40}$/.test(CONTRACT_ADDRESS));
  const notify = (type, message) => setNotice({ type, message });
  const updateForm = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  async function connectWallet() {
    try {
      if (!window.ethereum) throw new Error('MetaMask not found. Install the MetaMask browser extension.');
      const provider = new BrowserProvider(window.ethereum);
      await provider.send('eth_requestAccounts', []);
      const signer = await provider.getSigner();
      const net = await provider.getNetwork();
      setAccount(await signer.getAddress());
      setNetwork(`${net.name} Â· chain ${net.chainId}`);
      notify('success', 'Wallet connected.');
    } catch (e) { notify('error', e.message); }
  }

  async function getContract(write = false) {
    if (!contractReady) throw new Error('Set VITE_CONTRACT_ADDRESS in frontend/.env after deploying the contract.');
    if (!window.ethereum) throw new Error('Install MetaMask first.');
    const provider = new BrowserProvider(window.ethereum);
    if (write) {
      await provider.send('eth_requestAccounts', []);
      return new Contract(CONTRACT_ADDRESS, ABI, await provider.getSigner());
    }
    return new Contract(CONTRACT_ADDRESS, ABI, provider);
  }

  async function loadRecords() {
    try { setRecords(await api('/api/credentials')); } catch (e) { notify('error', `Backend unavailable: ${e.message}`); }
  }
  useEffect(() => { loadRecords(); }, []);

  async function issue(e) {
    e.preventDefault(); setBusy(true); setResult(null); setNotice(null);
    try {
      const record = await api('/api/credentials', { method: 'POST', body: JSON.stringify(form) });
      const contract = await getContract(true);
      const tx = await contract.issueCredential(record.credentialId, record.dataHash);
      notify('success', 'Transaction submitted. Confirming on blockchainâ€¦');
      await tx.wait();
      await api(`/api/credentials/${record.credentialId}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'issued' }) });
      setCredentialId(record.credentialId);
      setResult({ type: 'issued', record, tx: tx.hash });
      notify('success', 'Credential issued and recorded on blockchain.');
      await loadRecords();
    } catch (e) { notify('error', e.shortMessage || e.reason || e.message); }
    finally { setBusy(false); }
  }

  async function verify(e) {
    e.preventDefault(); setBusy(true); setResult(null); setNotice(null);
    try {
      const record = await api(`/api/credentials/${credentialId.trim()}`);
      const contract = await getContract(false);
      const valid = await contract.verifyCredential(record.credentialId, record.dataHash);
      const onChain = await contract.getCredential(record.credentialId);
      setResult({ type: 'verified', record, valid, revoked: onChain.revoked, issuer: onChain.issuer, issuedAt: onChain.issuedAt.toString() });
      notify(valid ? 'success' : 'error', valid ? 'Credential is authentic and active.' : 'Credential is invalid or revoked.');
    } catch (e) { notify('error', e.shortMessage || e.reason || e.message); }
    finally { setBusy(false); }
  }

  async function revoke(id) {
    setBusy(true); setNotice(null); setResult(null);
    try {
      const contract = await getContract(true);
      const tx = await contract.revokeCredential(id);
      notify('success', 'Revocation transaction submittedâ€¦');
      await tx.wait();
      await api(`/api/credentials/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'revoked' }) });
      notify('success', 'Credential revoked on blockchain.');
      await loadRecords();
    } catch (e) {
      notify('error', e.shortMessage || e.reason || e.message);
    } finally {
      setBusy(false);
    }
  }

  async function copy(text) { try { await navigator.clipboard.writeText(text); notify('success', 'Copied to clipboard.'); } catch { notify('error', 'Copy failed; select and copy the text manually.'); } }

  return <div className="app-shell">
    <header className="topbar"><a className="brand" href="#top"><span className="brand-mark"><ShieldCheck size={23}/></span><span>VeriChain<small>DECENTRALIZED CREDENTIALS</small></span></a><div className="top-actions"><span className={`network-pill ${contractReady ? 'ready' : ''}`}><span className="dot"/>{contractReady ? 'Contract configured' : 'Setup required'}</span><button className="wallet-btn" onClick={connectWallet}><Wallet size={17}/>{account ? `${account.slice(0,6)}â€¦${account.slice(-4)}` : 'Connect wallet'}</button></div></header>
    <main id="top" className="main-wrap"><section className="hero"><div className="hero-copy"><div className="eyebrow"><span className="eyebrow-line"/> BLOCKCHAIN IDENTITY PLATFORM</div><h1>Credentials you can <span>trust.</span></h1><p>Issue, verify, and revoke digital credentials with transparent blockchain records.</p><div className="hero-meta"><span><Blocks size={16}/> Ethereum-compatible</span><span><ShieldCheck size={16}/> Tamper-resistant</span></div></div><div className="hero-art"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="credential-card"><div className="card-top"><span>VERICHAIN</span><ShieldCheck size={22}/></div><div className="card-seal"><GraduationCap size={36}/></div><div className="card-lines"><i/><i/><i/></div><div className="card-foot"><span>VERIFIABLE CREDENTIAL</span><span className="mini-check"><CheckCircle2 size={16}/></span></div></div><span className="float-icon float-one"><Blocks size={20}/></span><span className="float-icon float-two"><ShieldCheck size={20}/></span></div></section>
    {notice && <div className={`notice ${notice.type}`}><span>{notice.type === 'success' ? <CheckCircle2 size={18}/> : <AlertCircle size={18}/>}</span><span>{notice.message}</span><button onClick={() => setNotice(null)} aria-label="Dismiss">Ã—</button></div>}
    <section className="stats-grid"><div className="stat-card"><span className="stat-icon purple"><FileCheck2 size={19}/></span><div><strong>{records.filter(r => r.status === 'issued').length}</strong><small>Issued credentials</small></div></div><div className="stat-card"><span className="stat-icon green"><ShieldCheck size={19}/></span><div><strong>{records.filter(r => r.status === 'issued').length}</strong><small>Active in registry*</small></div></div><div className="stat-card"><span className="stat-icon orange"><Ban size={19}/></span><div><strong>{records.filter(r => r.status === 'revoked').length}</strong><small>Revoked credentials</small></div></div></section>
    <section className="workspace"><div className="section-heading"><div><span className="eyebrow">CREDENTIAL MANAGEMENT</span><h2>Manage credentials</h2></div><button className="icon-btn" onClick={loadRecords} title="Refresh records"><RefreshCw size={17}/></button></div><div className="tabs"><button className={tab === 'issue' ? 'active' : ''} onClick={() => {setTab('issue');setResult(null)}}><FileCheck2 size={17}/> Issue credential</button><button className={tab === 'verify' ? 'active' : ''} onClick={() => {setTab('verify');setResult(null)}}><SearchCheck size={17}/> Verify credential</button><button className={tab === 'records' ? 'active' : ''} onClick={() => {setTab('records');setResult(null);loadRecords()}}><Blocks size={17}/> Registry</button></div>
    <div className="panel">
      {tab === 'issue' && <div className="form-layout"><div className="panel-intro"><span className="large-icon"><FileCheck2 size={25}/></span><h3>Issue a new credential</h3><p>Enter the holder and credential details. A unique ID and hash will be prepared, then registered on-chain.</p><div className="info-note"><ShieldCheck size={17}/><span>Only the credential hash is stored on the blockchain. Keep real personal data out of public-chain transactions.</span></div></div><form className="form" onSubmit={issue}><label>Student full name<input name="studentName" value={form.studentName} onChange={updateForm} placeholder="e.g. Ananya Rao" required/></label><label>Credential / certificate name<input name="credentialName" value={form.credentialName} onChange={updateForm} placeholder="e.g. Course Completion Certificate" required/></label><label>Student ID<input name="studentId" value={form.studentId} onChange={updateForm} placeholder="e.g. STUDENT-001" required/></label><label>Issue date<input type="date" name="issuedOn" value={form.issuedOn} onChange={updateForm} required/></label><button className="primary-btn" disabled={busy}>{busy ? 'Processingâ€¦' : 'Issue on blockchain'}<ArrowUpRight size={17}/></button></form></div>}
      {tab === 'verify' && <div className="verify-layout"><div className="panel-intro"><span className="large-icon"><SearchCheck size={25}/></span><h3>Verify a credential</h3><p>Enter the full credential ID. The app retrieves the expected hash and checks it against the deployed smart contract.</p><div className="info-note"><Blocks size={17}/><span>Verification requires the backend record and the correct deployed contract address.</span></div></div><form className="form" onSubmit={verify}><label>Credential ID<input value={credentialId} onChange={e => setCredentialId(e.target.value)} placeholder="0xâ€¦ paste credential ID" required/></label><button className="primary-btn" disabled={busy}>{busy ? 'Checkingâ€¦' : 'Verify credential'}<SearchCheck size={17}/></button></form></div>}
      {tab === 'records' && <div className="records-panel"><div className="records-head"><div><h3>Credential registry</h3><p>Records stored by the backend for this demo.</p></div><button className="secondary-btn" onClick={loadRecords}><RefreshCw size={15}/> Refresh</button></div>{records.length === 0 ? <div className="empty-state"><Blocks size={30}/><strong>No credentials yet</strong><span>Issue your first credential to populate the registry.</span></div> : <div className="table-wrap"><table><thead><tr><th>Holder / credential</th><th>Credential ID</th><th>Status</th><th>Action</th></tr></thead><tbody>{records.map(r => <tr key={r.credentialId}><td><strong>{r.studentName}</strong><small>{r.credentialName}</small></td><td><button className="id-copy" onClick={() => {setCredentialId(r.credentialId);setTab('verify')}} title="Use this ID to verify">{r.credentialId.slice(0,10)}â€¦{r.credentialId.slice(-6)} <Copy size={13}/></button></td><td><span className={`status ${r.status}`}>{r.status}</span></td><td>{r.status === 'issued' ? <button className="revoke-btn" disabled={busy} onClick={() => revoke(r.credentialId)}><Ban size={14}/> Revoke</button> : <span className="muted">â€”</span>}</td></tr>)}</tbody></table></div>}</div>}
    </div>
    {result && <section className="result-card"><div className="result-heading"><span className={`result-icon ${result.type === 'verified' ? (result.valid ? 'good' : 'bad') : 'good'}`}>{result.type === 'issued' || result.valid ? <CheckCircle2 size={21}/> : <AlertCircle size={21}/>}</span><div><h3>{result.type === 'issued' ? 'Credential issued' : result.valid ? 'Credential is authentic' : 'Credential is not valid'}</h3><p>{result.type === 'issued' ? 'The transaction was confirmed on the blockchain.' : result.valid ? 'The hash matches and the credential is not revoked.' : 'The hash did not verify or the credential has been revoked.'}</p></div></div><div className="result-fields"><div><small>Credential ID</small><button onClick={() => copy(result.record.credentialId)}>{result.record.credentialId.slice(0,22)}â€¦ <Copy size={13}/></button></div><div><small>Holder</small><strong>{result.record.studentName}</strong></div>{result.tx && <div><small>Transaction hash</small><button onClick={() => copy(result.tx)}>{result.tx.slice(0,18)}â€¦ <Copy size={13}/></button></div>}{result.type === 'verified' && <div><small>Revocation status</small><strong>{result.revoked ? 'Revoked' : 'Not revoked'}</strong></div>}</div><button className="secondary-btn" onClick={() => copy(result.record.credentialId)}><Copy size={15}/> Copy credential ID</button></section>}
    </section>
    <section className="setup-strip"><div className="setup-icon"><Blocks size={21}/></div><div><strong>Development configuration</strong><p>Network: {network}. Contract: {contractReady ? `${CONTRACT_ADDRESS.slice(0,10)}â€¦${CONTRACT_ADDRESS.slice(-6)}` : 'not configured'}.</p></div><a href="https://remix.ethereum.org/" target="_blank" rel="noreferrer">Open Remix <ArrowUpRight size={14}/></a></section>
    <p className="disclaimer">*Counts are based on backend demo records, not an independent scan of the blockchain. This is an academic prototype, not a production identity service. Do not enter sensitive real personal information.</p>
    </main><footer><span>VeriChain <span className="footer-dot">â€¢</span> Engineering Capstone Project</span><span>Decentralized Identity &amp; Verifiable Credentials</span></footer>
  </div>;
}


