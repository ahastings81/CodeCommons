const express = require('express');
const { read: kvRead, write: kvWrite, defaultFile } = require('../utils/jsonStore');
const { read: arrRead } = require('../utils/db');

const router = express.Router();
const STORE = defaultFile;
const CPM = 2.50; const CPC = 0.50;

function parseDate(s){ return s ? new Date(s) : null; }

function deriveTotals(base) {
  const impressions = Number(base.impressions || 0);
  const clicks = Number(base.clicks || 0);
  const conversions = Number(base.conversions || 0);
  const spend = (impressions/1000)*CPM + clicks*CPC; // align with Business Metrics revenue
  const ctr = impressions ? (clicks / impressions) : 0;
  const cpm = CPM;
  const cpc = CPC;
  return { impressions, clicks, conversions, spend, ctr, cpm, cpc, revenue: spend };
}

function inRange(ts, start, end) {
  if (!ts) return false;
  const t = new Date(ts);
  if (Number.isNaN(t.getTime())) return false;
  if (start && t < start) return false;
  if (end && t > end) return false;
  return true;
}

function emptyRecord(adId, advertiserId) {
  return { adId, advertiserId, totals: { impressions:0, clicks:0, conversions:0, spend:0 }, events: [] };
}

// Track events for an ad
router.post('/ads/:adId/track', async (req, res) => {
  try {
    const { adId } = req.params;
    let { event, advertiserId, value = 0, ts } = req.body || {};
    if (!event || !['impression','click','conversion','spend'].includes(event)) {
      return res.status(400).json({ error: 'Invalid or missing "event"' });
    }
    if (!advertiserId) {
      // Default to per-ad grouping when advertiserId is not provided
      advertiserId = adId;
    }

    const db = await kvRead(STORE);
    const rec = db[adId] ?? emptyRecord(adId, advertiserId);
    rec.advertiserId = advertiserId;

    const now = ts || new Date().toISOString();
    rec.events.push({ type: event, ts: now, value: Number(value) || 0 });

    switch (event) {
      case 'impression': rec.totals.impressions++; break;
      case 'click':      rec.totals.clicks++; break;
      case 'conversion': rec.totals.conversions++; break;
      case 'spend':      rec.totals.spend += Number(value) || 0; break;
    }

    db[adId] = rec;
    await kvWrite(db, STORE);
    res.json({ ok: true, record: rec });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to track event' });
  }
});

// Per-ad metrics
router.get('/ads/:adId/metrics', async (req, res) => {
  try {
    const { adId } = req.params;
    const start = parseDate(req.query.start);
    const end   = parseDate(req.query.end);

    const db = await kvRead(STORE);
    const rec = db ? db[adId] : undefined;

    // Fallback: use ads.json if adMetrics does not contain this ad
    if (!rec) {
      try {
        const ads = arrRead ? arrRead('ads.json') : [];
        const ad = ads.find(a => a.id === adId);
        if (ad) {
          const t = deriveTotals({ impressions: ad.impressions||0, clicks: ad.clicks||0, conversions: 0 });
          // ctr derived in totals
          return res.json({ adId, advertiserId: ad.advertiserId || null, totals: t, ctr: t.ctr, cpm: t.cpm, cpc: t.cpc, revenue: t.revenue });
        }
      } catch {}
      return res.json({ adId, advertiserId: null, totals: { impressions:0, clicks:0, conversions:0, spend:0 }, ctr: 0 });
    }

    if (!start && !end) {
      const { impressions, clicks, conversions, spend } = rec.totals || { impressions:0, clicks:0, conversions:0, spend:0 };
      const ctr = impressions ? +(clicks / impressions).toFixed(4) : 0;
      return res.json({ adId, advertiserId: rec.advertiserId || null, totals: rec.totals || { impressions, clicks, conversions, spend }, ctr });
    }

    const agg = { impressions:0, clicks:0, conversions:0, spend:0 };
    for (const ev of (rec.events || [])) {
      if (!inRange(ev.ts, start, end)) continue;
      if (ev.type === 'impression') agg.impressions++;
      if (ev.type === 'click')      agg.clicks++;
      if (ev.type === 'conversion') agg.conversions++;
      if (ev.type === 'spend')      agg.spend += Number(ev.value) || 0;
    }
    const ctr = agg.impressions ? +(agg.clicks / agg.impressions).toFixed(4) : 0;
    return res.json({ adId, advertiserId: rec.advertiserId || null, totals: agg, ctr });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to get ad metrics' });
  }
});

// Per-ad listing (optionally filter by advertiser; supports start/end)
router.get('/ads/metrics', async (req, res) => {
  try {
    const start = parseDate(req.query.start);
    const end   = parseDate(req.query.end);
    const filterAdv = req.query.advertiserId || null;

    const db = await kvRead(STORE);
    const items = [];

    // Fallback from ads.json if no adMetrics records exist
    if (!db || Object.keys(db).length === 0) {
      const ads = arrRead ? arrRead('ads.json') : [];
      for (const ad of ads) {
        if (filterAdv) continue; // advertiser filter unknown with legacy ads.json
        const t = deriveTotals({ impressions: ad.impressions||0, clicks: ad.clicks||0, conversions: 0 });
        // ctr derived in totals
        items.push({ adId: ad.id, advertiserId: ad.advertiserId || null, totals: t, ctr: t.ctr, cpm: t.cpm, cpc: t.cpc, revenue: t.revenue });
      }
      return res.json({ items });
    }

    for (const [adId, rec] of Object.entries(db)) {
      if (filterAdv && rec.advertiserId !== filterAdv) continue;

      if (!start && !end) {
        const t = rec.totals || { impressions:0, clicks:0, conversions:0, spend:0 };
        const ctr = t.impressions ? +(t.clicks / t.impressions).toFixed(4) : 0;
        items.push({ adId, advertiserId: rec.advertiserId || null, totals: t, ctr });
        continue;
      }

      const agg = { impressions:0, clicks:0, conversions:0, spend:0 };
      for (const ev of (rec.events || [])) {
        if (!inRange(ev.ts, start, end)) continue;
        if (ev.type === 'impression') agg.impressions++;
        if (ev.type === 'click')      agg.clicks++;
        if (ev.type === 'conversion') agg.conversions++;
        if (ev.type === 'spend')      agg.spend += Number(ev.value) || 0;
      }
      const ctr = agg.impressions ? +(agg.clicks / agg.impressions).toFixed(4) : 0;
      items.push({ adId, advertiserId: rec.advertiserId || null, totals: agg, ctr });
    }

    res.json({ items });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to get ad metrics' });
  }
});

// Aggregated metrics for an advertiser (totals and perAd breakdown)
router.get('/advertisers/:advertiserId/metrics', async (req, res) => {
  try {
    const { advertiserId } = req.params;
    const start = parseDate(req.query.start);
    const end   = parseDate(req.query.end);

    const db = await kvRead(STORE);
    const agg = { impressions:0, clicks:0, conversions:0, spend:0 };
    const perAd = [];

    for (const [adId, rec] of Object.entries(db || {})) {
      if (rec.advertiserId !== advertiserId) continue;

      if (!start && !end) {
        const t = rec.totals || { impressions:0, clicks:0, conversions:0, spend:0 };
        agg.impressions += t.impressions;
        agg.clicks      += t.clicks;
        agg.conversions += t.conversions;
        agg.spend       += t.spend;
        const ctr = t.impressions ? +(t.clicks / t.impressions).toFixed(4) : 0;
        perAd.push({ adId, totals: t, ctr });
        continue;
      }

      const t = { impressions:0, clicks:0, conversions:0, spend:0 };
      for (const ev of (rec.events || [])) {
        if (!inRange(ev.ts, start, end)) continue;
        if (ev.type === 'impression') t.impressions++;
        if (ev.type === 'click')      t.clicks++;
        if (ev.type === 'conversion') t.conversions++;
        if (ev.type === 'spend')      t.spend += Number(ev.value) || 0;
      }
      agg.impressions += t.impressions;
      agg.clicks      += t.clicks;
      agg.conversions += t.conversions;
      agg.spend       += t.spend;
      const ctr = t.impressions ? +(t.clicks / t.impressions).toFixed(4) : 0;
      perAd.push({ adId, totals: t, ctr });
    }

    const ctr = agg.impressions ? +(agg.clicks / agg.impressions).toFixed(4) : 0;
    res.json({ advertiserId, totals: agg, ctr, perAd });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to get advertiser metrics' });
  }
});

module.exports = router;
