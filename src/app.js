const express = require('express');
const healthRoutes = require('./routes/healthRoutes');
const notFound = require('./middlewares/notFound');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

app.use(express.json());
app.use('/health', healthRoutes);
app.use('/api/health', healthRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
