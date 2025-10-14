
const dotenv = require('dotenv');
dotenv.config();

module.exports = {
  PORT: process.env.PORT || 4000,
  JWT_SECRET: process.env.JWT_SECRET || 'dev-super-secret-change-me',
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  LIMITS: {
    FREE_MAX_PROJECTS: parseInt(process.env.FREE_MAX_PROJECTS || '2', 10),
    FREE_MAX_JOBS_PER_MONTH: parseInt(process.env.FREE_MAX_JOBS_PER_MONTH || '5', 10),
  }
};
