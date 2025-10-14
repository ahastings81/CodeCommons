import React, { useEffect, useState } from 'react';
import { API_BASE, getToken } from '../services/api.js';
import { api } from '../services/api.js';

export default function AdRail({ side = 'left' }) {
  const [ads, setAds] = useState([]);
  const [idx, setIdx] = useState(0);
  const impressedRef = React.useRef(new Set());
  async function trackAdEvent(ad, event, extra={}){
    try{
      if (!ad?.id) return;
      const t = getToken?.() || localStorage.getItem('token') || '';
      await fetch(`${API_BASE}/api/ads/${ad.id}/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(t?{'Authorization':'Bearer '+t}:{}) },
        body: JSON.stringify({ event, advertiserId: ad.advertiserId || ad.id, ...extra })
      });
    }catch{}
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const list = await api.ads();
        if (mounted) setAds(Array.isArray(list) ? list : []);
      } catch {}
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!ads.length) return;
    const current = ads[idx];
    if (current?.id) { api.adImpression(current.id).catch(()=>{}); if (!impressedRef.current.has(current.id)) { impressedRef.current.add(current.id); trackAdEvent(current, 'impression'); } }
    const t = setInterval(() => setIdx(p => (p + 1) % ads.length), 12000);
    return () => clearInterval(t);
  }, [ads, idx]);

  if (!ads.length) return <div className="ad-rail" data-side={side}></div>;

  const ad = ads[idx];
  const onClick = () => {
    if (ad?.id) { api.adClick(ad.id).catch(()=>{}); trackAdEvent(ad, 'click'); }
    if (ad?.href) window.open(ad.href, '_blank', 'noopener,noreferrer');
  };

  const imgSrc = ad.image ? api.assetUrl(ad.image) : null;   // e.g. "/uploads/my-banner.jpg" or full URL
  const vidSrc = ad.video ? api.assetUrl(ad.video) : null;   // e.g. "/uploads/my-teaser.mp4"
  const poster = ad.poster ? api.assetUrl(ad.poster) : null; // optional poster for video

  return (
    <div className="ad-rail" data-side={side}>
      <div className="ad-card" role="button" onClick={onClick} tabIndex={0}
           onKeyDown={(e)=> e.key==='Enter' && onClick()}>
        {vidSrc ? (
          <div className="ad-media">
            <video src={vidSrc} poster={poster || undefined} muted playsInline loop autoPlay />
          </div>
        ) : imgSrc ? (
          <div className="ad-media">
            <img src={imgSrc} alt={ad.title || 'Ad'} />
          </div>
        ) : null}
        {ad.title && <div className="ad-title">{ad.title}</div>}
        {ad.body  && <div className="ad-body">{ad.body}</div>}
        <div className="ad-cta">{ad.cta || 'Learn more'}</div>
      </div>
    </div>
  );
}
