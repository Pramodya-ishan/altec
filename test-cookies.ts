import app from './api/index.ts';
import http from 'http';

const server = http.createServer((req, res) => {
  app(req, res);
});

server.listen(3001, () => {
  fetch('http://localhost:3001/api/cookies?email=test@example.com')
    .then(r => r.text())
    .then(console.log)
    .catch(console.error)
    .finally(() => process.exit(0));
});
