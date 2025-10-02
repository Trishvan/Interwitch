import React, { useState } from 'react';
import { Card, Upload, Button, message, Typography, Form, Input, Modal } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
// PDF.js worker setup for version 3.11.174
import * as pdfjsLib from "pdfjs-dist/build/pdf";
pdfjsLib.GlobalWorkerOptions.workerSrc = "https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
import mammoth from 'mammoth';
import { useDispatch, useSelector } from 'react-redux';
import { startInterview, answerQuestion, nextQuestion, setTimer, finishInterview } from '../slices/interviewSlice';
import axios from 'axios';

const { Dragger } = Upload;
const { Title } = Typography;

function extractFields(text) {
  // Try to extract name from 'Name:' or from the first non-empty line (common in resumes)
  let name = '';
  const nameMatch = text.match(/Name[:\s]+([A-Za-z .'-]+)/i);
  if (nameMatch) {
    name = nameMatch[1].trim();
  } else {
    // Fallback: use the first non-empty line, assuming it's the name
    const lines = text.split(/\r?\n|(?<=\.) /).map(l => l.trim()).filter(Boolean);
    if (lines.length > 0 && lines[0].length < 60 && !lines[0].match(/(curriculum vitae|resume|email|phone|contact|summary|profile|objective|\d{4})/i)) {
      name = lines[0];
    } else {
      // Extra fallback: try first 5 words, skipping common non-name words
      const words = text.split(/\s+/).filter(Boolean);
      const skipWords = ['curriculum', 'vitae', 'resume', 'email', 'phone', 'contact', 'summary', 'profile', 'objective'];
      let possibleName = words.slice(0, 5).join(' ');
      if (!skipWords.some(w => possibleName.toLowerCase().includes(w))) {
        name = possibleName;
      }
    }
  }
  const emailMatch = text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
  const phoneMatch = text.match(/(\+?\d{1,3}[\s-]?)?(\(?\d{3}\)?[\s-]?)?\d{3}[\s-]?\d{4}/);
  // Debug: show what was extracted
  if (!name) {
    console.warn('extractFields: Could not extract name. Text sample:', text.slice(0, 200));
  }
  return {
    name,
    email: emailMatch ? emailMatch[0] : '',
    phone: phoneMatch ? phoneMatch[0] : '',
  };
}

const QUESTION_SET = [
  { level: 'Easy', time: 20, text: 'What is React and why is it useful?' },
  { level: 'Easy', time: 20, text: 'Explain the virtual DOM.' },
  { level: 'Medium', time: 60, text: 'How does Redux help manage state in React apps?' },
  { level: 'Medium', time: 60, text: 'Describe the lifecycle of a React component.' },
  { level: 'Hard', time: 120, text: 'How would you optimize a large React app for performance?' },
  { level: 'Hard', time: 120, text: 'Explain server-side rendering and its benefits for React.' },
];

function IntervieweeChat({ user }) {
  const [fields, setFields] = useState({ name: '', email: '', phone: '' });
  const [missing, setMissing] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [answer, setAnswer] = useState('');
  const [timer, setTimerState] = useState(null);
  const [chatStarted, setChatStarted] = useState(false);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [apiError, setApiError] = useState('');
  const dispatch = useDispatch();
  const interview = useSelector(state => state.interview);

  const handleResume = async (file) => {
    if (
      file.type !== 'application/pdf' &&
      file.type !== 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' &&
      file.type !== 'application/octet-stream'
    ) {
      alert('Only PDF or DOCX files are allowed!');
      return Upload.LIST_IGNORE;
    }
    let text = '';
    try {
      if (file.type === 'application/pdf' || file.type === 'application/octet-stream') {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          text += content.items.map(item => item.str).join(' ');
        }
      } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        text = result.value;
      }
      const extracted = extractFields(text);
      setFields(extracted);
      const missingFields = [];
      if (!extracted.name) missingFields.push('name');
      if (!extracted.email) missingFields.push('email');
      if (!extracted.phone) missingFields.push('phone');
      if (missingFields.length) {
        setMissing(missingFields);
        setModalVisible(true);
      } else {
        alert('All required fields extracted!');
        // TODO: Start interview
      }
    } catch (err) {
      console.error('PDF/DOCX parse error:', err);
      alert('Failed to parse resume: ' + (err.message || err));
    }
    return false;
  };

  const handleModalOk = (values) => {
    setFields({ ...fields, ...values });
    setModalVisible(false);
    message.success('All required fields provided!');
    // TODO: Start interview
  };

  const fetchQuestions = async () => {
    setLoadingQuestions(true);
    setApiError('');
    try {
      const token = await user.getIdToken();
      console.log('VITE_API_URL:', import.meta.env.VITE_API_URL);
      const res = await axios.post(
        import.meta.env.VITE_API_URL + '/api/generate-questions',
        {
          role: 'Full Stack React/Node',
          candidate: fields,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const questions = res.data.questions;
      dispatch(startInterview({ questions }));
      setChatStarted(true);
      setTimerState(questions[0].time || 20);
    } catch (err) {
      let msg = 'Failed to fetch questions. Please try again.';
      if (err.response) {
        msg += ` (Status: ${err.response.status})`;
        if (err.response.data && err.response.data.error) {
          msg += ` - ${err.response.data.error}`;
        }
      } else if (err.message) {
        msg += ` (${err.message})`;
      }
      setApiError(msg);
      console.error('fetchQuestions error:', err);
    } finally {
      setLoadingQuestions(false);
    }
  };

  React.useEffect(() => {
    if (chatStarted && timer !== null) {
      if (timer === 0) {
        handleSubmit();
        return;
      }
      const interval = setInterval(() => {
        setTimerState(t => t - 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [chatStarted, timer]);

  const handleSubmit = () => {
    dispatch(answerQuestion(answer || '[No answer]'));
    setAnswer('');
    if (interview.progress < QUESTION_SET.length - 1) {
      dispatch(nextQuestion());
      setTimerState(QUESTION_SET[interview.progress + 1].time);
    } else {
      dispatch(finishInterview());
      message.success('Interview finished!');
      setChatStarted(false);
    }
  };

  return (
    <Card style={{ margin: 24 }}>
      <Title level={3}>Interviewee Chat</Title>
      <Dragger
        name="resume"
        multiple={false}
        accept=".pdf,.docx"
        showUploadList={false}
        beforeUpload={handleResume}
      >
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">Click or drag resume to upload (PDF/DOCX)</p>
      </Dragger>
      <Modal
        title="Missing Information"
        open={modalVisible}
        footer={null}
        onCancel={() => setModalVisible(false)}
      >
        <Form onFinish={handleModalOk} layout="vertical">
          {missing.includes('name') && <Form.Item name="name" label="Name" rules={[{ required: true }]}> <Input /> </Form.Item>}
          {missing.includes('email') && <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}> <Input /> </Form.Item>}
          {missing.includes('phone') && <Form.Item name="phone" label="Phone" rules={[{ required: true }]}> <Input /> </Form.Item>}
          <Button type="primary" htmlType="submit">Submit</Button>
        </Form>
      </Modal>
      {!chatStarted && (
        <Button
          type="primary"
          onClick={fetchQuestions}
          disabled={!fields.name || !fields.email || !fields.phone || loadingQuestions}
          style={{ marginTop: 16 }}
        >
          {loadingQuestions ? 'Generating Questions...' : 'Start Interview'}
        </Button>
      )}
      {apiError && <div style={{ color: 'red', marginTop: 8 }}>{apiError}</div>}
      {chatStarted && (
        <div style={{ marginTop: 24 }}>
          <Card type="inner" title={`Question ${interview.progress + 1} (${QUESTION_SET[interview.progress].level})`}>
            <p>{QUESTION_SET[interview.progress].text}</p>
            <p>Time left: <b>{timer}s</b></p>
            <Input.TextArea
              value={answer}
              onChange={e => setAnswer(e.target.value)}
              rows={4}
              disabled={timer === 0}
              placeholder="Type your answer..."
              style={{ marginBottom: 12 }}
            />
            <Button type="primary" onClick={handleSubmit} disabled={timer === 0}>
              Submit Answer
            </Button>
          </Card>
        </div>
      )}
      {/* TODO: Show chat history, progress, and final summary */}
    </Card>
  );
}

export default IntervieweeChat;
