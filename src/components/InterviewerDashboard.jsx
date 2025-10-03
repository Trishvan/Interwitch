import React, { useEffect, useState } from 'react';
import { Card, Table, Typography, message } from 'antd';
import { auth } from '../firebase';

const { Title } = Typography;

function InterviewerDashboard() {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchCandidates() {
      setLoading(true);
      try {
        const user = auth.currentUser;
        if (!user) throw new Error('Not authenticated');
        const token = await user.getIdToken();
        const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/results`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Failed to fetch candidates');
        const data = await res.json();
        // Normalize for table: name/email/score/summary
        const normalized = data.map(item => ({
          id: item.id,
          name: item.name || '',
          email: item.Email || item.email || '',
          score: item.score || '',
          summary: item.summary || '',
        }));
        setCandidates(normalized);
      } catch (err) {
        message.error('Could not load candidates');
      } finally {
        setLoading(false);
      }
    }
    fetchCandidates();
  }, []);

  return (
    <Card style={{ margin: 24 }}>
      <Title level={3}>Interviewer Dashboard</Title>
      <Table
        columns={[
          { title: 'Name', dataIndex: 'name', key: 'name' },
          { title: 'Email', dataIndex: 'email', key: 'email' },
          { title: 'Score', dataIndex: 'score', key: 'score', sorter: true },
          { title: 'Summary', dataIndex: 'summary', key: 'summary', render: t => <span style={{ whiteSpace: 'pre-line' }}>{t}</span> },
        ]}
        dataSource={candidates}
        rowKey="id"
        loading={loading}
      />
      {/* TODO: Candidate details, chat history, summary, search/sort */}
    </Card>
  );
}

export default InterviewerDashboard;
