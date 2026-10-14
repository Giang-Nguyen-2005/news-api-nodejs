const { port } = require('./config/env');
const app = require('./app');

const server = app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

server.on('error', (error) => {
  console.error('Failed to start server:', error.message);
  process.exit(1);
});
