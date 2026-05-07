require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');

const lineWebhook = require('./routes/lineWebhook');
const jobs = require('./routes/jobs');
const applications = require('./routes/applications');
const users = require('./routes/users');
const errorHandler = require('./middleware/errorHandler');
const scheduler = require('./services/scheduler');

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL }));
app.use(morgan('combined'));

// LINE webhookはraw bodyが必要
app.use('/webhook', express.raw({ type: 'application/json' }), lineWebhook);

app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api/jobs', jobs);
app.use('/api/applications', applications);
app.use('/api/users', users);

app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  scheduler.start();
});

module.exports = app;
