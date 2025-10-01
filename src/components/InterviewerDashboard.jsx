import React from 'react';
import { Card, Table, Typography } from 'antd';

const { Title } = Typography;

function InterviewerDashboard() {
  // Placeholder for dashboard logic
  return (
    <Card style={{ margin: 24 }}>
      <Title level={3}>Interviewer Dashboard</Title>
      <Table
        columns={[
          { title: 'Name', dataIndex: 'name', key: 'name' },
          { title: 'Email', dataIndex: 'email', key: 'email' },
          { title: 'Score', dataIndex: 'score', key: 'score', sorter: true },
        ]}
        dataSource={[]}
        rowKey="id"
      />
      {/* TODO: Candidate details, chat history, summary, search/sort */}
    </Card>
  );
}

export default InterviewerDashboard;
