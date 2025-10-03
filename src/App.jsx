import React, { useState } from 'react';
import { Layout, Modal, Button } from 'antd';
import { Routes, Route, useNavigate } from 'react-router-dom';
import IntervieweeChat from './components/IntervieweeChat';
import InterviewerDashboard from './components/InterviewerDashboard';
import { useSelector, useDispatch } from 'react-redux';
import { resumeInterview } from './slices/interviewSlice';
import { auth } from './firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import './App.css';

function App() {
  const status = useSelector(state => state.interview.status);
  const dispatch = useDispatch();
  const [welcomeVisible, setWelcomeVisible] = React.useState(false);
  const [user, setUser] = useState(null);
  const [authModal, setAuthModal] = useState(true);
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [accountType, setAccountType] = useState('candidate'); // candidate or interviewer
  const [name, setName] = useState(''); // <-- Add name state
  const [showInterviewerRefreshMsg, setShowInterviewerRefreshMsg] = useState(false);
  const [checkingInterviewerClaim, setCheckingInterviewerClaim] = useState(false); // NEW
  const navigate = useNavigate();

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setAuthModal(!u);
      if (u) {
        // Get Firebase token
        const token = await u.getIdToken(true); // force refresh to get latest claims
        // Fetch user info from backend
        try {
          const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/me`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const userInfo = await res.json();
          console.log('User info from /api/me:', userInfo); // <-- Add debug log
          if (userInfo.isInterviewer) {
            setAccountType('interviewer');
            navigate('/dashboard');
          } else {
            setAccountType('candidate');
            navigate('/chat');
          }
        } catch (e) {
          setAccountType('candidate');
          navigate('/chat');
        }
      } else {
        setAccountType('candidate');
        navigate('/');
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  React.useEffect(() => {
    if (status === 'paused') setWelcomeVisible(true);
  }, [status]);

  const handleResume = () => {
    dispatch(resumeInterview());
    setWelcomeVisible(false);
  };

  const handleAuth = async () => {
    setError('');
    try {
      let cred;
      let becameInterviewer = false;
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        // Create user and set displayName
        cred = await createUserWithEmailAndPassword(auth, email, password);
        if (name) {
          await cred.user.updateProfile({ displayName: name });
        }
        // If interviewer (by user selection), call backend to set claim and create user doc
        if (accountType === 'interviewer') {
          try {
            await fetch(`${import.meta.env.VITE_API_URL || ''}/api/add-interviewer`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${await cred.user.getIdToken()}`,
              },
              body: JSON.stringify({ email, name, uid: cred.user.uid }),
            });
            setAccountType('interviewer');
            becameInterviewer = true;
          } catch (e) {
            console.error('Failed to set interviewer claim:', e);
          }
        }
      }
      setAuthModal(false);
      // Force token refresh and re-check role if interviewer
      if (becameInterviewer) {
        setCheckingInterviewerClaim(true); // NEW: show loading
        let found = false;
        for (let i = 0; i < 5; i++) {
          await auth.currentUser.getIdToken(true);
          try {
            const token = await auth.currentUser.getIdToken();
            const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/me`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            const userInfo = await res.json();
            if (userInfo.isInterviewer) {
              found = true;
              setCheckingInterviewerClaim(false);
              break;
            }
          } catch {}
          await new Promise(r => setTimeout(r, 1000)); // wait 1s
        }
        if (!found) {
          setCheckingInterviewerClaim(false);
          setShowInterviewerRefreshMsg(true);
        }
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      setAuthModal(false);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setUser(null);
    setAuthModal(true);
    navigate('/');
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Routes>
        <Route path="/chat" element={user && accountType === 'candidate' ? <IntervieweeChat user={user} /> : <Unauthorized />} />
        <Route path="/dashboard" element={user && accountType === 'interviewer' ? <InterviewerDashboard user={user} /> : <Unauthorized />} />
        <Route path="/" element={<Landing />} />
      </Routes>
      <Modal
        title="Welcome Back"
        open={welcomeVisible}
        onOk={handleResume}
        onCancel={() => setWelcomeVisible(false)}
        okText="Resume Interview"
        cancelText="Close"
      >
        <p>Your interview session is paused. Would you like to resume?</p>
      </Modal>
      <Modal
        title={isLogin ? 'Login' : 'Sign Up'}
        open={authModal}
        footer={null}
        closable={false}
      >
        <div style={{ marginBottom: 16 }}>
          {!isLogin && (
            <input
              type="text"
              placeholder="Full Name"
              value={name}
              onChange={e => setName(e.target.value)}
              style={{ width: '100%', marginBottom: 8 }}
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            style={{ width: '100%', marginBottom: 8 }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={{ width: '100%', marginBottom: 8 }}
          />
          <div style={{ marginBottom: 8 }}>
            <label>Account Type: </label>
            <select value={accountType} onChange={e => setAccountType(e.target.value)} style={{ width: '100%' }}>
              <option value="candidate">Candidate</option>
              <option value="interviewer">Interviewer</option>
            </select>
          </div>
          {error && <div style={{ color: 'red', marginBottom: 8 }}>{error}</div>}
          <button onClick={handleAuth} style={{ width: '100%', marginBottom: 8 }}>
            {isLogin ? 'Login' : 'Sign Up'}
          </button>
          <button onClick={handleGoogleSignIn} style={{ width: '100%', marginBottom: 8 }}>
            Sign in with Google
          </button>
          <button onClick={() => setIsLogin(l => !l)} style={{ width: '100%' }}>
            {isLogin ? 'Need an account? Sign Up' : 'Already have an account? Login'}
          </button>
        </div>
      </Modal>
      <Modal
        title="Interviewer Access"
        open={showInterviewerRefreshMsg || checkingInterviewerClaim}
        onOk={() => setShowInterviewerRefreshMsg(false)}
        onCancel={() => setShowInterviewerRefreshMsg(false)}
        okText="OK"
        closable={!checkingInterviewerClaim}
        footer={checkingInterviewerClaim ? null : undefined}
      >
        {checkingInterviewerClaim ? (
          <div style={{ textAlign: 'center' }}>
            <p>Setting up your interviewer access. This may take a few seconds...</p>
            <div className="spinner" style={{ margin: '16px auto' }}>
              <span className="ant-spin-dot ant-spin-dot-spin">
                <i className="ant-spin-dot-item" />
                <i className="ant-spin-dot-item" />
                <i className="ant-spin-dot-item" />
                <i className="ant-spin-dot-item" />
              </span>
            </div>
          </div>
        ) : (
          <p>Your interviewer access will be active after you log out and log in again.</p>
        )}
      </Modal>
      {user && <Button onClick={handleLogout} style={{ position: 'absolute', top: 16, right: 16 }}>Logout</Button>}
    </Layout>
  );
}

function Unauthorized() {
  return <div style={{ padding: 32, textAlign: 'center' }}><h2>Unauthorized</h2><p>You do not have access to this page.</p></div>;
}

function Landing() {
  return <div style={{ padding: 32, textAlign: 'center' }}><h2>Welcome to AI Interview Assistant</h2><p>Please sign in to continue.</p></div>;
}

export default App;
