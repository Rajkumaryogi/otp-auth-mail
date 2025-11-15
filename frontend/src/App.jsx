import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';

export default function App() {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [stage, setStage] = useState('login'); // 'login' | 'otp' | 'dashboard'
  const [message, setMessage] = useState('');
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);

  useEffect(() => {
    if (token) fetchProfile(token);
  }, [token]);

  async function fetchProfile(tkn) {
    try {
      const res = await axios.get(`${API_BASE}/me`, { headers: { Authorization: `Bearer ${tkn}` } });
      if (res.data?.user) {
        setStage('dashboard');
        setMessage('');
      }
    } catch (err) {
      console.log('Not logged in or token invalid', err?.response?.data);
      setToken(null);
      localStorage.removeItem('token');
      setStage('login');
    }
  }

  const sendOtp = async () => {
    if (!email) return setMessage('Enter a valid email');
    setLoading(true);
    setMessage('');
    setPreviewUrl(null);
    try {
      const res = await axios.post(`${API_BASE}/auth/send-otp`, { email });
      setStage('otp');
      setMessage('OTP sent to your email.');
      if (res.data?.preview) setPreviewUrl(res.data.preview);
    } catch (err) {
      setMessage(err?.response?.data?.message || 'Send OTP failed');
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (!otp) return setMessage('Enter OTP');
    setLoading(true);
    setMessage('');
    try {
      const res = await axios.post(`${API_BASE}/auth/verify-otp`, { email, otp });
      const tkn = res.data?.token;
      if (tkn) {
        localStorage.setItem('token', tkn);
        setToken(tkn);
        setStage('dashboard');
        setMessage('Logged in!');
      } else {
        setMessage('No token returned');
      }
    } catch (err) {
      setMessage(err?.response?.data?.message || 'Verify failed');
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setStage('login');
    setEmail('');
    setOtp('');
    setMessage('Logged out');
  };

  return (
    <div className="container">
      <h1>Single Page Email OTP Login</h1>

      {stage === 'login' && (
        <>
          <input className="input" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} />
          <button className="btn" onClick={sendOtp} disabled={!email || loading}>{loading ? 'Sending...' : 'Send OTP'}</button>
        </>
      )}

      {stage === 'otp' && (
        <>
          <div className="note">OTP sent to <b>{email}</b>. Check inbox/spam.</div>
          <input className="input" placeholder="Enter OTP" value={otp} onChange={e => setOtp(e.target.value)} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={verifyOtp} disabled={!otp || loading}>{loading ? 'Verifying...' : 'Verify OTP'}</button>
            <button className="btn secondary" onClick={() => { setStage('login'); setOtp(''); }}>Cancel</button>
          </div>
          {previewUrl && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 13, color:'#555' }}>Dev preview (Ethereal):</div>
              <a href={previewUrl} target="_blank" rel="noreferrer">{previewUrl}</a>
            </div>
          )}
        </>
      )}

      {stage === 'dashboard' && (
        <>
          <div className="success">Welcome — you're logged in as <b>{email}</b></div>
          <div style={{ marginTop: 12 }}>
            <button className="btn" onClick={logout}>Logout</button>
          </div>
        </>
      )}

      {message && <div className="message">{message}</div>}
    </div>
  );
}
