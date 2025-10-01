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
  const navigate = useNavigate();

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthModal(!u);
      // Example: check for custom claim or email domain
      // Here, you can set accountType based on user info
      // For demo, use email: if contains 'interviewer', set as interviewer
      if (u?.email?.includes('interviewer')) {
        setAccountType('interviewer');
        navigate('/dashboard');
      } else {
        setAccountType('candidate');
        navigate('/chat');
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
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
      setAuthModal(false);
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
