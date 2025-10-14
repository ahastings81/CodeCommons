const express = require('express');
const { ensureFile, read, write } = require('../utils/db');

const router = express.Router();

function ensureAdsFile() {
  ensureFile('ads.json', [{
    id: 'ad-your-1',
    title: 'Your Ad Here',
    body: 'Promote your project or service to devs.',
    cta: 'Place Ad',
    href: 'https://example.com/advertise',
    impressions: 0,
    clicks: 0
  }, {
    id: 'ad-your-2',
    title: 'Your Ad Here',
    body: 'Reach engaged builders on CodeCommons.',
    cta: 'Start Now',
    href: 'https://example.com/advertise',
    impressions: 0,
    clicks: 0
  }]);
  return read('ads.json');
}

router.get('/', (req, res) => {
  res.json(ensureAdsFile());
});

router.post('/impression', (req, res) => {
  const { adId } = req.body || {};
  const ads = ensureAdsFile();
  const idx = ads.findIndex(a => a.id === adId);
  if (idx !== -1) {
    ads[idx].impressions = (ads[idx].impressions || 0) + 1;
    write('ads.json', ads);
  }
  res.json({ ok: true });
});

router.post('/click', (req, res) => {
  const { adId } = req.body || {};
  const ads = ensureAdsFile();
  const idx = ads.findIndex(a => a.id === adId);
  if (idx !== -1) {
    ads[idx].clicks = (ads[idx].clicks || 0) + 1;
    write('ads.json', ads);
  }
  res.json({ ok: true });
});

module.exports = router;