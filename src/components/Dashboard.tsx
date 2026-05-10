import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import LiveCard from './LiveCard';
import Analytics from './Analytics';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  TimeScale,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, TimeScale);

type Row = {
  id: number;
  node_id: string;
  temperature: number;
  humidity: number;
  light: number;
  created_at: string;
};

export default function Dashboard() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from<'sensor_logs', Row>('sensor_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(48);

        if (error) {
          console.error('Supabase fetch error', error);
        } else if (mounted && data) {
          setRows(data.reverse());
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }

    load();

    const interval = setInterval(load, 30_000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const latest = rows.length ? rows[rows.length - 1] : null;

  const labels = rows.map((r) => new Date(r.created_at).toLocaleTimeString());

  const data = {
    labels,
    datasets: [
      {
        label: 'Temperature (°C)',
        data: rows.map((r) => r.temperature),
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.5)',
        tension: 0.2,
      },
      {
        label: 'Humidity (%)',
        data: rows.map((r) => r.humidity),
        borderColor: 'rgb(54, 162, 235)',
        backgroundColor: 'rgba(54, 162, 235, 0.3)',
        tension: 0.2,
      },
      {
        label: 'Light',
        data: rows.map((r) => r.light),
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.3)',
        tension: 0.2,
        yAxisID: 'light',
      },
    ],
  };

  const options: any = {
    responsive: true,
    interaction: { mode: 'index' },
    scales: {
      y: { type: 'linear', position: 'left' },
      light: { type: 'linear', position: 'right', grid: { drawOnChartArea: false } },
    },
  };

  return (
    <div>
      <section className="section">
        <div className="section-heading">
          <p>Dashboard</p>
          <h2>Live readings and recent history</h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
          <div style={{ display: 'grid', gap: 12 }}>
            <LiveCard
              nodeId={latest?.node_id ?? 'node-a'}
              temperature={latest?.temperature ?? null}
              humidity={latest?.humidity ?? null}
              light={latest?.light ?? null}
              updatedAt={latest?.created_at ?? null}
            />
            <Analytics nodeId={latest?.node_id ?? 'node-a'} />
          </div>

          <div className="card" style={{ padding: 12 }}>
            {loading ? <div>Loading…</div> : <Line options={options} data={data} />}
          </div>
        </div>
      </section>
    </div>
  );
}
