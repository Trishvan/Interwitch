CREATE TABLE candidates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100),
  email VARCHAR(100),
  phone VARCHAR(30),
  score INTEGER,
  summary TEXT,
  chat_history JSONB
);
