import React, { useEffect, useMemo, useState } from 'react';
import { supabase, SUPABASE_CONFIGURED } from '../lib/supabase';
import LiveCard from './LiveCard';
import Analytics from './Analytics';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
  TimeScale,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend, TimeScale);

type Row = {
  id: number;
  node_id: string;
  temperature: number;
  humidity: number;
  light: number;
  created_at: string;
};

const SAMPLE_INTERVAL_MINUTES = 15;
const ONLINE_WINDOW_MINUTES = 30;
const LIGHT_THRESHOLD = 500;
const MS_PER_HOUR = 60 * 60 * 1000;
const EXPECTED_SAMPLE_INTERVAL_MINUTES = 2;

function normalizeNodeId(nodeId: unknown) {
  const value = String(nodeId ?? '').trim();
  if (!value || value.includes('{{') || value.includes('$json') || value === 'undefined' || value === 'null') {
    return null;
  }
  return value;
}

function isFiniteNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value);
}

function isValidRow(row: Row) {
  return Boolean(normalizeNodeId(row.node_id))
    && isFiniteNumber(row.temperature)
    && isFiniteNumber(row.humidity)
    && isFiniteNumber(row.light);
}

function sortRows(rows: Row[]) {
  return [...rows].sort((left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime());
}

function mean(values: number[]) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getMidnightTimestamp() {
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  return midnight.getTime();
}

function linearRegression(xs: number[], ys: number[]) {
  const n = xs.length;
  if (n === 0) return null;

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  for (let index = 0; index < n; index += 1) {
    sumX += xs[index];
    sumY += ys[index];
    sumXY += xs[index] * ys[index];
    sumXX += xs[index] * xs[index];
  }

  const slope = (n * sumXY - sumX * sumY) / ((n * sumXX - sumX * sumX) || 1e-9);
  const intercept = (sumY - slope * sumX) / n;

  return { slope, intercept };
}

function buildTimeSeriesData(rows: Row[], key: 'temperature' | 'humidity') {
  return {
    labels: rows.map((row) => new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })),
    datasets: [
      {
        label: key === 'temperature' ? 'Temperature (°C)' : 'Humidity (%)',
        data: rows.map((row) => row[key]),
        borderColor: key === 'temperature' ? 'rgba(255, 99, 132, 0.95)' : 'rgba(54, 162, 235, 0.95)',
        backgroundColor: key === 'temperature' ? 'rgba(255, 99, 132, 0.18)' : 'rgba(54, 162, 235, 0.18)',
        tension: 0.3,
        pointRadius: 3,
        pointHoverRadius: 6,
        borderWidth: 2,
        fill: true,
      },
    ],
  };
}

function buildHourlyLightChart(rows: Row[]) {
  const buckets = new Map<string, { timestamp: number; total: number; count: number }>();

  rows.forEach((row) => {
    const timestamp = new Date(row.created_at).getTime();
    const bucketTime = new Date(timestamp);
    bucketTime.setMinutes(0, 0, 0);
    const key = String(bucketTime.getTime());
    const existing = buckets.get(key) ?? { timestamp: bucketTime.getTime(), total: 0, count: 0 };
    existing.total += row.light;
    existing.count += 1;
    buckets.set(key, existing);
  });

  const sorted = [...buckets.values()].sort((left, right) => left.timestamp - right.timestamp);

  return {
    labels: sorted.map((bucket) => new Date(bucket.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })),
    datasets: [
      {
        label: 'Light level',
        data: sorted.map((bucket) => Number((bucket.total / bucket.count).toFixed(1))),
        backgroundColor: 'rgba(75, 192, 192, 0.65)',
        borderRadius: 8,
      },
    ],
  };
}

function getNodeSummaries(rows: Row[]) {
  const grouped = new Map<string, Row[]>();

  sortRows(rows).filter(isValidRow).forEach((row) => {
    const nodeId = normalizeNodeId(row.node_id);
    if (!nodeId) return;

    const existing = grouped.get(nodeId) ?? [];
    existing.push(row);
    grouped.set(nodeId, existing);
  });

  return [...grouped.entries()]
    .map(([nodeId, nodeRows]) => {
      const latest = nodeRows[nodeRows.length - 1];
      const lastUpdated = new Date(latest.created_at).getTime();
      const online = Date.now() - lastUpdated <= ONLINE_WINDOW_MINUTES * 60 * 1000;

      return {
        nodeId,
        rows: nodeRows,
        latest,
        online,
      };
    })
    .sort((left, right) => left.nodeId.localeCompare(right.nodeId));
}

export default function Dashboard() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string>('');
  const [timeRange, setTimeRange] = useState<'2H'|'6H'|'12H'|'24H'|'7D'>('24H');

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!SUPABASE_CONFIGURED) {
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const { data, error } = await supabase
          .from('sensor_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(500);

        if (error) {
          console.error('Supabase fetch error', error);
          return;
        }

        if (mounted && data) {
          setRows(sortRows(data as Row[]).filter(isValidRow));
        }
      } catch (error) {
        console.error(error);
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

  const nodeSummaries = useMemo(() => getNodeSummaries(rows), [rows]);
  const currentNodeId = selectedNodeId || nodeSummaries[0]?.nodeId || '';
  const selectedRows = useMemo(
    () => sortRows(rows.filter((row) => normalizeNodeId(row.node_id) === currentNodeId)),
    [rows, currentNodeId],
  );

  useEffect(() => {
    if (!selectedNodeId && nodeSummaries[0]) {
      setSelectedNodeId(nodeSummaries[0].nodeId);
    }
  }, [nodeSummaries, selectedNodeId]);

  const selectedNodeSummary = nodeSummaries.find((node) => node.nodeId === currentNodeId) ?? null;
  const latestUpdate = selectedNodeSummary?.latest?.created_at ?? null;
  const latestData = selectedNodeSummary?.latest ?? null;
  const onlineNodeCount = nodeSummaries.filter((node) => node.online).length;
  const latestReadingAgeMinutes = latestUpdate ? Math.max(0, Math.round((Date.now() - new Date(latestUpdate).getTime()) / 60000)) : null;

  const rangeHoursMap: Record<string, number> = { '2H': 2, '6H': 6, '12H': 12, '24H': 24, '7D': 24 * 7 };
  const hours = rangeHoursMap[timeRange];
  const cutoff = Date.now() - hours * 60 * 60 * 1000;
  const filteredRows = selectedRows.filter((r) => new Date(r.created_at).getTime() >= cutoff);

  const temperatureData = buildTimeSeriesData(filteredRows, 'temperature');
  const humidityData = buildTimeSeriesData(filteredRows, 'humidity');
  const lightData = buildHourlyLightChart(filteredRows);

  const chartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'nearest', intersect: false },
    plugins: {
      legend: { position: 'top', labels: { color: '#e6eef6', boxWidth: 12, padding: 12 } },
      tooltip: {
        enabled: true,
        mode: 'index',
        intersect: false,
        padding: 8,
        backgroundColor: 'rgba(10,10,10,0.9)',
        titleColor: '#fff',
        bodyColor: '#fff',
        callbacks: {
          label: (context: any) => `${context.dataset.label}: ${context.formattedValue}`,
        },
      },
    },
    layout: { padding: { top: 8, right: 12, bottom: 8, left: 8 } },
    scales: {
      x: {
        ticks: { color: 'rgba(230, 238, 246, 0.9)', maxRotation: 0, autoSkip: true },
        grid: { color: 'rgba(255,255,255,0.04)' },
      },
      y: {
        ticks: { color: 'rgba(230, 238, 246, 0.9)' },
        grid: { color: 'rgba(255,255,255,0.04)' },
      },
    },
  };

  return (
    <main className="dashboard-page">
      <section className="dashboard-header card">
        <div>
          <p className="eyebrow">Farm telemetry dashboard</p>
          <h1>Live status, analytics, and history</h1>
          <p className="lead">Live node status, crop-safety analytics, and historical temperature, humidity, and light charts.</p>
        </div>

        <div className="dashboard-meta">
          <div>
            <span className="panel-label">Nodes</span>
            <strong>{nodeSummaries.length || 0}</strong>
            <p>Tracked across the farm</p>
          </div>
          <div>
            <span className="panel-label">Online</span>
            <strong>{onlineNodeCount}</strong>
            <p>Reporting within 30 minutes</p>
          </div>
          <div>
            <span className="panel-label">Selected node</span>
            <strong>{currentNodeId || '—'}</strong>
            <p>Active node view</p>
          </div>
          <div>
            <span className="panel-label">Latest temp</span>
            <strong>{latestData ? `${latestData.temperature.toFixed(1)} °C` : '—'}</strong>
            <p>From the selected node</p>
          </div>
          <div>
            <span className="panel-label">Latest humidity</span>
            <strong>{latestData ? `${latestData.humidity.toFixed(0)} %` : '—'}</strong>
            <p>Useful for crop safety</p>
          </div>
          <div>
            <span className="panel-label">Last update</span>
            <strong>{latestUpdate ? new Date(latestUpdate).toLocaleString() : '—'}</strong>
            <p>{latestReadingAgeMinutes != null ? `${latestReadingAgeMinutes} min ago` : 'Waiting on fresh data'}</p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <p>Live Status Panel</p>
          <h2>Current readings for each node</h2>
        </div>

        <div className="node-grid">
          {nodeSummaries.map((node) => (
            <LiveCard
              key={node.nodeId}
              nodeId={node.nodeId}
              temperature={node.latest.temperature}
              humidity={node.latest.humidity}
              light={node.latest.light}
              updatedAt={node.latest.created_at}
              online={node.online}
              selected={node.nodeId === currentNodeId}
            />
          ))}
        </div>

        {!nodeSummaries.length && (
          <div className="card empty-state">
            {loading ? 'Loading sensor readings…' : 'No sensor rows found yet.'}
          </div>
        )}
      </section>

      <Analytics
        nodeId={currentNodeId || 'node-a'}
        rows={selectedRows}
        allRows={rows}
        nodeSummaries={nodeSummaries}
        onSelectNode={setSelectedNodeId}
        expectedSampleIntervalMinutes={EXPECTED_SAMPLE_INTERVAL_MINUTES}
      />

      <section className="section">
        <div className="section-heading">
          <p>Historical Charts</p>
          <h2>Temperature, humidity, and light over time</h2>
        </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
            <div className="chart-filters" role="tablist" aria-label="Time range filters">
              {(['2H', '6H', '12H', '24H', '7D'] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  className={`chart-filter-btn ${timeRange === opt ? 'active' : ''}`}
                  onClick={() => setTimeRange(opt)}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div className="chart-grid">
          <article className="card chart-card">
            <h3>Temperature over time</h3>
            <div className="chart-body">
              {selectedRows.length ? <Line options={chartOptions} data={temperatureData} /> : <div className="empty-state">No temperature history yet.</div>}
            </div>
          </article>

          <article className="card chart-card">
            <h3>Humidity over time</h3>
            <div className="chart-body">
              {selectedRows.length ? <Line options={chartOptions} data={humidityData} /> : <div className="empty-state">No humidity history yet.</div>}
            </div>
          </article>

          <article className="card chart-card">
            <h3>Light level pattern</h3>
            <div className="chart-body">
              {selectedRows.length ? <Bar options={chartOptions} data={lightData} /> : <div className="empty-state">No light history yet.</div>}
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}
