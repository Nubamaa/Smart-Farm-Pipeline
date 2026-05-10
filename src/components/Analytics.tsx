import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

type Row = {
  id: number;
  node_id: string;
  temperature: number;
  humidity: number;
  light: number;
  created_at: string;
};

function linearRegression(xs: number[], ys: number[]) {
  const n = xs.length;
  if (n === 0) return null;
  let sumX = 0; let sumY = 0; let sumXY = 0; let sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += xs[i]; sumY += ys[i]; sumXY += xs[i] * ys[i]; sumXX += xs[i] * xs[i];
  }
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX || 1e-9);
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

export default function Analytics({ nodeId = 'node-a' }: { nodeId?: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [prediction, setPrediction] = useState<number | null>(null);
  const [slope, setSlope] = useState<number | null>(null);
  const [alert, setAlert] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      const { data, error } = await supabase
        .from('sensor_logs')
        .select('*')
        .eq('node_id', nodeId)
        .order('created_at', { ascending: false })
        .limit(48);
      if (error) {
        console.error(error);
        return;
      }
      if (!mounted || !data) return;
      const rev = data.reverse();
      setRows(rev);

      // build arrays for regression (time -> temperature)
      const xs = rev.map(r => new Date(r.created_at).getTime() / 1000);
      const ys = rev.map(r => r.temperature);
      const model = linearRegression(xs, ys);
      if (model) {
        setSlope(model.slope);
        const predictTime = (Date.now() / 1000) + 3600; // +1 hour
        const pred = model.intercept + model.slope * predictTime;
        setPrediction(pred);
        // simple alert: predicted temp exceed threshold
        if (pred >= 35) setAlert('Predicted heat stress within 1 hour');
        else setAlert(null);
      }
    }

    load();
    const id = setInterval(load, 30_000);
    return () => { mounted = false; clearInterval(id); };
  }, [nodeId]);

  return (
    <div className="card" style={{ padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p style={{ margin: 0, fontSize: 12, opacity: 0.8 }}>Analytics — {nodeId}</p>
          <h3 style={{ margin: '6px 0' }}>{prediction != null ? `${prediction.toFixed(1)} °C (1h)` : 'No prediction'}</h3>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Trend</div>
          <div style={{ fontWeight: 700 }}>{slope != null ? `${(slope * 3600).toFixed(2)} °C/hr` : '—'}</div>
        </div>
      </div>
      <div style={{ marginTop: 10, fontSize: 13, color: alert ? '#ffb4b4' : 'rgba(255,255,255,0.7)' }}>
        {alert ?? 'No immediate alerts predicted.'}
      </div>
    </div>
  );
}
