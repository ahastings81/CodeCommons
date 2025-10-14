import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE, getToken } from '../services/api.js';

// If you already export a helper in api.js you can swap this fetcher to use it.
// Keeping direct fetch here to avoid coupling and to guarantee the correct route.
async function fetchPerAdMetrics(params = {}) {
  const q = new URLSearchParams();
  if (params.advertiserId) q.set('advertiserId', params.advertiserId);
  if (params.start) q.set('start', params.start);
  if (params.end) q.set('end', params.end);

  const res = await fetch(`${API_BASE}/api/ads/metrics?` + q.toString(), { credentials: 'include', headers: (()=>{ const t=getToken?.()||localStorage.getItem('token')||''; return t?{'Authorization':'Bearer '+t}:{ }; })() });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json(); // { items: [...] }
}

function Stat({ label, value, sub }) {
  return (
    <div className="card" style={{ padding: 12 }}>
      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{label}</div>
      <div style={{ fontWeight: 700, fontSize: 18 }}>{value}</div>
      {sub ? <div className="muted" style={{ fontSize: 12 }}>{sub}</div> : null}
    </div>
  );
}

function number(n, d = 0) {
  if (n == null || isNaN(n)) return d ? (0).toFixed(d) : '0';
  return d ? Number(n).toFixed(d) : Number(n).toLocaleString();
}

export default function AdsDashboard() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  // Filters
  const [advertiserId, setAdvertiserId] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [groupByAdvertiser, setGroupByAdvertiser] = useState(false);

  async function load(params = {}) {
    setLoading(true); setErr('');
    try {
      const data = await fetchPerAdMetrics(params);
      setRows(Array.isArray(data?.items) ? data.items : []);
    } catch (e) {
      setErr(e?.message || 'Failed to load metrics');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Initial load with no filters
    load({});
  }, []);

  const totals = useMemo(() => {
    const t = { impressions: 0, clicks: 0, conversions: 0, spend: 0 };
    for (const r of rows) {
      const m = r?.totals || r || {};
      t.impressions += Number(m.impressions || 0);
      t.clicks += Number(m.clicks || 0);
      t.conversions += Number(m.conversions || 0);
      t.spend += Number(m.spend || 0);
    }
    const ctr = t.impressions ? t.clicks / t.impressions : 0;
    const cpc = t.clicks ? t.spend / t.clicks : 0;
    const cpm = t.impressions ? (t.spend / (t.impressions / 1000)) : 0;
    return { ...t, ctr, cpc, cpm };
  }, [rows]);

  const tableData = useMemo(() => {
    if (!groupByAdvertiser) return rows;
    const map = new Map();
    for (const r of rows) {
      const key = r.advertiserId || 'unknown';
      const prev = map.get(key) || { advertiserId: key, totals: { impressions: 0, clicks: 0, conversions: 0, spend: 0 } };
      const m = r?.totals || {};
      prev.totals.impressions += Number(m.impressions || 0);
      prev.totals.clicks += Number(m.clicks || 0);
      prev.totals.conversions += Number(m.conversions || 0);
      prev.totals.spend += Number(m.spend || 0);
      map.set(key, prev);
    }
    return Array.from(map.values()).map(r => ({
      ...r,
      // synthetic row keys
      adId: `—`,
      ctr: r.totals.impressions ? r.totals.clicks / r.totals.impressions : 0
    }));
  }, [rows, groupByAdvertiser]);

  return (
    <div>
      <h2>Ads Dashboard</h2>

      {/* Filters */}
      <div className="card" style={{ display: 'grid', gap: 8 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <input
            placeholder="Advertiser ID"
            value={advertiserId}
            onChange={e => setAdvertiserId(e.target.value)}
            style={{ minWidth: 160 }}
          />
          <input type="date" value={start} onChange={e => setStart(e.target.value)} />
          <input type="date" value={end} onChange={e => setEnd(e.target.value)} />
          <button
            onClick={() => load({ advertiserId: advertiserId || undefined, start: start || undefined, end: end || undefined })}
            disabled={loading}
          >
            Apply
          </button>
          <button
            className="ghost"
            onClick={() => { setAdvertiserId(''); setStart(''); setEnd(''); load({}); }}
            disabled={loading}
          >
            Reset
          </button>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
            <input
              type="checkbox"
              checked={groupByAdvertiser}
              onChange={e => setGroupByAdvertiser(e.target.checked)}
            />
            Group by advertiser
          </label>
        </div>
        {err && <div className="error">{err}</div>}
      </div>

      {/* Summary KPIs */}
      <div className="grid cols-4" style={{ marginTop: 12 }}>
        <Stat label="Impressions" value={number(totals.impressions)} />
        <Stat label="Clicks" value={number(totals.clicks)} sub={`CTR ${(totals.ctr * 100).toFixed(2)}%`} />
        <Stat label="Conversions" value={number(totals.conversions)} />
        <Stat label="Spend" value={`$${number(totals.spend, 2)}`} sub={`CPM $${number(totals.cpm, 2)} • CPC $${number(totals.cpc, 2)}`} />
      </div>

      {/* Table */}
      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>{groupByAdvertiser ? 'By Advertiser' : 'Per Ad'}</h3>
          <span style={{ marginLeft: 'auto' }}>
            <Link className="ghost" to="/admin">Admin → Metrics</Link>
          </span>
        </div>

        {loading ? (
          <div style={{ padding: 12 }}>Loading…</div>
        ) : (
          <div className="table-responsive" style={{ marginTop: 8 }}>
            <table>
              <thead>
                <tr>
                  <th style={{ whiteSpace: 'nowrap' }}>{groupByAdvertiser ? 'Advertiser' : 'Ad ID'}</th>
                  {!groupByAdvertiser && <th>Advertiser</th>}
                  <th>Impr.</th>
                  <th>Clicks</th>
                  <th>Conv.</th>
                  <th>Spend</th>
                  <th>CTR</th>
                </tr>
              </thead>
              <tbody>
                {tableData.length ? tableData.map((r, idx) => {
                  const t = r.totals || r;
                  const ctr = (r.ctr != null) ? r.ctr : (t.impressions ? t.clicks / t.impressions : 0);
                  return (
                    <tr key={r.adId || r.advertiserId || idx}>
                      <td>{groupByAdvertiser ? (r.advertiserId || '—') : (r.adId || '—')}</td>
                      {!groupByAdvertiser && <td>{r.advertiserId || '—'}</td>}
                      <td>{number(t.impressions)}</td>
                      <td>{number(t.clicks)}</td>
                      <td>{number(t.conversions)}</td>
                      <td>${number(t.spend, 2)}</td>
                      <td>{(ctr * 100).toFixed(2)}%</td>
                    </tr>
                  );
                }) : (
                  <tr><td colSpan={groupByAdvertiser ? 6 : 7} style={{ textAlign: 'center' }}>No data</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
