import React from 'react';

type Props = {
  nodeId: string;
  temperature?: number | null;
  humidity?: number | null;
  light?: number | null;
  updatedAt?: string | null;
  online?: boolean | null;
  selected?: boolean;
};

export default function LiveCard({ nodeId, temperature, humidity, light, updatedAt, online, selected }: Props) {
  return (
    <div className={selected ? 'card live-card selected' : 'card live-card'}>
      <div className="live-card-head">
        <div>
          <div className="panel-label">Live — {nodeId}</div>
          <h3>{temperature != null ? `${temperature.toFixed(1)} °C` : '—'}</h3>
        </div>
        <span className={`status-pill ${online ? 'status-online' : 'status-offline'}`}>
          {online ? 'Online' : 'Offline'}
        </span>
      </div>

      <div className="live-metrics">
        <div>
          <span>Humidity</span>
          <strong>{humidity != null ? `${humidity.toFixed(0)} %` : '—'}</strong>
        </div>
        <div>
          <span>Light</span>
          <strong>{light != null ? `${light}` : '—'}</strong>
        </div>
      </div>

      <div className="live-updated">
        {updatedAt ? `Last updated: ${new Date(updatedAt).toLocaleString()}` : 'No recent update'}
      </div>
    </div>
  );
}
