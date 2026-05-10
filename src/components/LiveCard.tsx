import React from 'react';

type Props = {
  nodeId: string;
  temperature?: number | null;
  humidity?: number | null;
  light?: number | null;
  updatedAt?: string | null;
};

export default function LiveCard({ nodeId, temperature, humidity, light, updatedAt }: Props) {
  return (
    <div className="card" style={{ padding: 18, borderRadius: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Live — {nodeId}</div>
          <h3 style={{ margin: '6px 0' }}>{temperature != null ? `${temperature.toFixed(1)} °C` : '—'}</h3>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Humidity</div>
          <div style={{ fontWeight: 600 }}>{humidity != null ? `${humidity.toFixed(0)} %` : '—'}</div>
          <div style={{ fontSize: 12, opacity: 0.8, marginTop: 8 }}>Light</div>
          <div style={{ fontWeight: 600 }}>{light != null ? `${light}` : '—'}</div>
        </div>
      </div>
      <div style={{ marginTop: 12, fontSize: 12, color: 'rgba(255,255,255,0.66)' }}>
        {updatedAt ? `Updated: ${new Date(updatedAt).toLocaleString()}` : 'No recent update'}
      </div>
    </div>
  );
}
