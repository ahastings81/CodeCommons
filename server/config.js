
const dotenv = require('dotenv');
dotenv.config();


function toBool(v, d = false) {
  if (v === undefined) return d;
  return ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase());
}

module.exports = {
  PORT: process.env.PORT || 4000,
  JWT_SECRET: process.env.JWT_SECRET || 'dev-super-secret-change-me',
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  TRUST_PROXY: toBool(process.env.TRUST_PROXY, false),
  LIMITS: {
    FREE_MAX_PROJECTS: parseInt(process.env.FREE_MAX_PROJECTS || '2', 10),
    FREE_MAX_JOBS_PER_MONTH: parseInt(process.env.FREE_MAX_JOBS_PER_MONTH || '5', 10),
  }
};
