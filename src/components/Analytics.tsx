import React, { useMemo } from 'react';
import { Doughnut, Line } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, CategoryScale, LineElement, LinearScale, PointElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(ArcElement, CategoryScale, LineElement, LinearScale, PointElement, Tooltip, Legend);

type Row = {
  id: number;
  node_id: string;
  temperature: number;
  humidity: number;
  light: number;
  created_at: string;
};

const SAMPLE_INTERVAL_MINUTES = 15;
const DEFAULT_EXPECTED_INTERVAL_MINUTES = 2;
const LIGHT_THRESHOLD = 500;
const TEMP_ALERT_THRESHOLD = 35;
const MS_PER_HOUR = 60 * 60 * 1000;
const MINUTES_PER_DAY = 24 * 60;

function mean(values: number[]) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

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
    && isFiniteNumber(row.light)
    && Boolean(row.created_at);
}

function sortRows(rows: Row[]) {
  return [...rows].sort((left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime());
}

function inferSampleIntervalMinutes(rows: Row[], fallbackMinutes: number) {
  if (rows.length < 2) return fallbackMinutes;

  const deltas: number[] = [];
  for (let index = 1; index < rows.length; index += 1) {
    const previous = new Date(rows[index - 1].created_at).getTime();
    const current = new Date(rows[index].created_at).getTime();
    const deltaMinutes = (current - previous) / 60000;
    if (deltaMinutes > 0 && deltaMinutes < 120) {
      deltas.push(deltaMinutes);
    }
  }

  if (!deltas.length) return fallbackMinutes;

  const sorted = deltas.sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

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

function startOfDayTimestamp() {
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  return midnight.getTime();
}

function buildSparklineData(rows: Row[], cooling: boolean) {
  const lastTen = sortRows(rows).slice(-10);

  return {
    labels: lastTen.map((_: Row, index: number) => String(index + 1)),
    datasets: [
      {
        data: lastTen.map((row: Row) => row.temperature),
        borderColor: '#2bbf99',
        backgroundColor: 'rgba(0,0,0,0)',
        pointRadius: 0,
        pointHoverRadius: 0,
        borderWidth: 2,
        tension: 0.35,
      },
    ],
  };
}

export default function Analytics({
  nodeId,
  rows,
  expectedSampleIntervalMinutes = DEFAULT_EXPECTED_INTERVAL_MINUTES,
  allRows = [],
  nodeSummaries = [],
  onSelectNode,
}: {
  nodeId: string;
  rows: Row[];
  expectedSampleIntervalMinutes?: number;
  allRows?: Row[];
  nodeSummaries?: Array<{ nodeId: string }>;
  onSelectNode?: (nodeId: string) => void;
}) {
  const cleanedRows = useMemo(() => rows.filter(isValidRow), [rows]);

  const metrics = useMemo(() => {
    const latest = cleanedRows.length ? cleanedRows[cleanedRows.length - 1] : null;
    const todayStart = startOfDayTimestamp();
    const recentRows = cleanedRows.filter((row) => new Date(row.created_at).getTime() >= Date.now() - MS_PER_HOUR);
    const dayRows = cleanedRows.filter((row) => new Date(row.created_at).getTime() >= todayStart);
    const twentyFourHourRows = cleanedRows.filter((row) => new Date(row.created_at).getTime() >= Date.now() - 24 * MS_PER_HOUR);
    const sampleIntervalMinutes = inferSampleIntervalMinutes(twentyFourHourRows, expectedSampleIntervalMinutes);

    const trendModel = linearRegression(
      recentRows.map((row) => new Date(row.created_at).getTime() / 1000),
      recentRows.map((row) => row.temperature),
    );

    const trendPerHour = trendModel ? trendModel.slope * 3600 : null;
    const safeHumidity = latest ? latest.humidity >= 40 && latest.humidity <= 70 : null;
    const lightHoursToday = dayRows.filter((row) => row.light > LIGHT_THRESHOLD).length * (sampleIntervalMinutes / 60);
    const temperatureAverage = mean(dayRows.map((row) => row.temperature).filter(Number.isFinite));
    const humidityAverage = mean(dayRows.map((row) => row.humidity).filter(Number.isFinite));
    const lightAverage = mean(dayRows.map((row) => row.light).filter(Number.isFinite));
    const alertsToday = dayRows.filter((row) => row.temperature >= TEMP_ALERT_THRESHOLD).length;
    const expectedReadings = Math.max(1, Math.round(MINUTES_PER_DAY / sampleIntervalMinutes));
    const uptime = Math.min(100, (twentyFourHourRows.length / expectedReadings) * 100);

    let heatRiskText = 'No immediate heat risk detected.';

    if (latest && trendPerHour != null) {
      if (trendPerHour > 0.05) {
        const hoursToThreshold = (TEMP_ALERT_THRESHOLD - latest.temperature) / trendPerHour;
        if (hoursToThreshold > 0 && Number.isFinite(hoursToThreshold)) {
          heatRiskText = `At this rate, temperature will exceed ${TEMP_ALERT_THRESHOLD}°C in ${hoursToThreshold.toFixed(1)} hours.`;
        } else {
          heatRiskText = `At this rate, temperature is trending upward and may exceed ${TEMP_ALERT_THRESHOLD}°C soon.`;
        }
      } else if (trendPerHour < -0.05) {
        heatRiskText = 'Temperature is cooling, so heat stress risk is low.';
      }
    }

    return {
      latest,
      trendPerHour,
      safeHumidity,
      lightHoursToday,
      temperatureAverage,
      humidityAverage,
      lightAverage,
      alertsToday,
      uptime,
      heatRiskText,
    };
  }, [cleanedRows, expectedSampleIntervalMinutes]);

  const trendLabel = metrics.trendPerHour != null
    ? `${metrics.trendPerHour >= 0 ? '+' : ''}${metrics.trendPerHour.toFixed(2)}°C/hr`
    : 'No trend yet';

  const humidityLabel = metrics.safeHumidity == null
    ? 'No humidity data'
    : metrics.safeHumidity
      ? 'Safe range for crops'
      : 'Outside safe range';

  const humidityTone = metrics.safeHumidity == null ? 'neutral' : metrics.safeHumidity ? 'ok' : 'warn';
  const heatTone = metrics.trendPerHour != null && metrics.trendPerHour > 0.05 ? 'warn' : 'ok';

  const global = useMemo(() => {
    const rowsAll: Row[] = Array.isArray(allRows) ? allRows.filter(isValidRow) : [];
    const grouped = new Map<string, Row[]>();
    rowsAll.forEach((r) => {
      const id = normalizeNodeId(r.node_id) ?? 'unknown';
      const arr = grouped.get(id) ?? [];
      arr.push(r);
      grouped.set(id, arr);
    });

    const todayStart = startOfDayTimestamp();

    const nodes = [...grouped.entries()].map(([nodeId, nodeRows]) => {
      const sorted = nodeRows.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      const latest = sorted[sorted.length - 1];
      const dayRows = sorted.filter((row) => new Date(row.created_at).getTime() >= todayStart);
      const tempAvg = mean(dayRows.map((r) => r.temperature).filter(Number.isFinite));
      const humAvg = mean(dayRows.map((r) => r.humidity).filter(Number.isFinite));
      const lightAvg = mean(dayRows.map((r) => r.light).filter(Number.isFinite));

      // Crop health score calculation
      const idealTempMin = 20; const idealTempMax = 30;
      const tempScore = latest && Number.isFinite(latest.temperature)
        ? (latest.temperature >= idealTempMin && latest.temperature <= idealTempMax
          ? 100
          : Math.max(0, 100 - (Math.abs(latest.temperature < idealTempMin ? idealTempMin - latest.temperature : latest.temperature - idealTempMax) / 15) * 100))
        : 0;

      const idealHumMin = 40; const idealHumMax = 70;
      const humScore = latest && Number.isFinite(latest.humidity)
        ? (latest.humidity >= idealHumMin && latest.humidity <= idealHumMax
          ? 100
          : latest.humidity < idealHumMin
            ? Math.max(0, 100 - ((idealHumMin - latest.humidity) / 40) * 100)
            : Math.max(0, 100 - ((latest.humidity - idealHumMax) / 30) * 100))
        : 0;

      const lightScore = lightAvg != null && Number.isFinite(lightAvg) ? Math.min(100, (lightAvg / 1000) * 100) : 0;

      const healthScore = Math.round((tempScore + humScore + lightScore) / 3);

      // humidity change in last hour
      const cutoff = Date.now() - MS_PER_HOUR;
      const recent = sorted.filter((r) => new Date(r.created_at).getTime() >= cutoff);
      let humidityChange = null;
      if (recent.length >= 2) {
        humidityChange = recent[recent.length - 1].humidity - recent[0].humidity;
      } else if (sorted.length >= 2) {
        // fallback: compare latest to nearest point ~1hr before
        const latestTs = new Date(latest.created_at).getTime();
        const oneHourAgo = latestTs - MS_PER_HOUR;
        const before = [...sorted].reverse().find((r) => new Date(r.created_at).getTime() <= oneHourAgo) ?? sorted[0];
        humidityChange = latest.humidity - before.humidity;
      }

      const humidityAlert = humidityChange != null && humidityChange <= -10;

      // trends for harvest window
      const recentWindow = sorted.filter((r) => new Date(r.created_at).getTime() >= Date.now() - 4 * MS_PER_HOUR);
      const tempTrend = linearRegression(recentWindow.map((r) => new Date(r.created_at).getTime() / 1000), recentWindow.map((r) => r.temperature));
      const humTrend = linearRegression(recentWindow.map((r) => new Date(r.created_at).getTime() / 1000), recentWindow.map((r) => r.humidity));
      const tempSlopePerHour = tempTrend ? tempTrend.slope * 3600 : 0;
      const humSlopePerHour = humTrend ? humTrend.slope * 3600 : 0;

      return {
        nodeId,
        latest,
        tempAvg,
        humAvg,
        lightAvg,
        healthScore,
        humidityChange,
        humidityAlert,
        tempSlopePerHour,
        humSlopePerHour,
        dayRows,
      };
    });

    // best and worst node today by health score
    const sortedByHealth = [...nodes].sort((a, b) => b.healthScore - a.healthScore);
    const best = sortedByHealth[0] ?? null;
    const worst = sortedByHealth[sortedByHealth.length - 1] ?? null;

    // risk summary
    const humidityAlerts = nodes.filter((n) => n.humidityAlert).map((n) => n.nodeId);
    const heatRisks = nodes.filter((n) => n.tempSlopePerHour != null && n.tempSlopePerHour > 0.05).map((n) => n.nodeId);

    const summaryParts: string[] = [];
    if (heatRisks.length) summaryParts.push(`${heatRisks.join(', ')} is at heat risk` + (heatRisks.length > 1 ? 's' : '') + '.');
    if (best) summaryParts.push(`${best.nodeId} has ideal conditions.`);
    if (humidityAlerts.length) summaryParts.push(`${humidityAlerts.join(', ')} humidity is dropping.`);
    const riskSummary = summaryParts.length ? summaryParts.join(' ') : 'All nodes appear nominal.';

    return { nodes, best, worst, riskSummary };
  }, [allRows]);

  // farm average health score across nodes
  const farmAverageHealth = useMemo(() => {
    const scores = global.nodes.map((n) => Number(n.healthScore || 0)).filter(Number.isFinite);
    if (!scores.length) return 0;
    return Math.round((scores.reduce((s, v) => s + v, 0) / scores.length) || 0);
  }, [global.nodes]);

  const selectedNode = global.nodes.find((node) => node.nodeId === nodeId) ?? null;
  const selectedNodeHealthScore = selectedNode?.healthScore ?? 0;
  const selectedNodeHumidityChange = selectedNode?.humidityChange ?? null;
  const selectedNodeHumidityAlert = selectedNode?.humidityAlert ?? false;
  const coolingTrend = metrics.trendPerHour != null ? metrics.trendPerHour < 0 : true;
  const sparklineData = useMemo(() => buildSparklineData(cleanedRows, coolingTrend), [cleanedRows, coolingTrend]);
  const donutData = useMemo(() => ({
    labels: ['Score', 'Remaining'],
    datasets: [
      {
        data: [selectedNodeHealthScore, Math.max(0, 100 - selectedNodeHealthScore)],
        backgroundColor: [
          selectedNodeHealthScore > 80 ? '#2bbf99' : selectedNodeHealthScore >= 60 ? '#efb26a' : '#ff6c6c',
          'rgba(255,255,255,0.08)',
        ],
        borderWidth: 0,
      },
    ],
  }), [selectedNodeHealthScore]);

  const farmDonutData = useMemo(() => ({
    labels: ['Score', 'Remaining'],
    datasets: [
      {
        data: [farmAverageHealth, Math.max(0, 100 - farmAverageHealth)],
        backgroundColor: [
          farmAverageHealth > 80 ? '#2bbf99' : farmAverageHealth >= 60 ? '#efb26a' : '#ff6c6c',
          'rgba(255,255,255,0.08)',
        ],
        borderWidth: 0,
      },
    ],
  }), [farmAverageHealth]);

  return (
    <section className="section analytics-section">
      <div className="section-heading">
        <p>Analytics Cards</p>
        <h2>Crop-safety metrics for {nodeId}</h2>
      </div>

      <div className="node-selector summary-node-selector" aria-label="Select node">
        {nodeSummaries.length ? (
          nodeSummaries.map((node) => (
            <button
              key={node.nodeId}
              type="button"
              className={node.nodeId === nodeId ? 'node-chip active' : 'node-chip'}
              onClick={() => onSelectNode?.(node.nodeId)}
            >
              {node.nodeId}
            </button>
          ))
        ) : (
          <span className="node-chip muted">Waiting for sensor data</span>
        )}
      </div>

      <div className="summary-row three-col">
        <article className="card metric-card summary-card donut-card summary-col">
          <div className="panel-label">CROP HEALTH SCORE</div>
          <div className="donut-wrap">
            <Doughnut
              data={donutData as any}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                cutout: '72%',
                plugins: { legend: { display: false }, tooltip: { enabled: false } },
              }}
            />
            <strong className="donut-center">{selectedNodeHealthScore}</strong>
          </div>
          <p>{selectedNode ? `Selected node health score for ${selectedNode.nodeId}.` : 'Selected node health score.'}</p>
        </article>

        <article className="card metric-card summary-card donut-card summary-col">
          <div className="panel-label">FARM AVERAGE HEALTH</div>
          <div className="donut-wrap">
            <Doughnut
              data={farmDonutData as any}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                cutout: '72%',
                plugins: { legend: { display: false }, tooltip: { enabled: false } },
              }}
            />
            <strong className="donut-center">{farmAverageHealth}</strong>
          </div>
          <p>Average health score across all nodes.</p>
        </article>

        <article className="card metric-card summary-card stacked-card summary-col">
          <div className="stacked-top">
            <div className="panel-label">Best Node Today</div>
            <strong>{global.best ? global.best.nodeId : '—'}</strong>
            <p>{global.best ? `${global.best.healthScore}/100` : 'Highest crop health score across nodes today.'}</p>
          </div>

          <div className="divider" aria-hidden="true" />

          <div className="stacked-bottom">
            <div className="panel-label">Worst Node Today</div>
            <strong>{global.worst ? global.worst.nodeId : '—'}</strong>
            <p>{global.worst ? `${global.worst.healthScore}/100` : 'Lowest crop health score across nodes today.'}</p>
          </div>
        </article>
      </div>

      <div className="analytics-grid">
        <article className="card metric-card">
          <div className="trend-card">
            <div className="trend-copy">
              <span className="panel-label">Temperature trend</span>
              <strong>{trendLabel}</strong>
              <p>{metrics.trendPerHour == null ? 'Need more recent readings.' : metrics.trendPerHour >= 0 ? 'Warming trend detected.' : 'Cooling trend detected.'}</p>
            </div>

            <div className="sparkline-wrap">
              <Line
                data={sparklineData as any}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false }, tooltip: { enabled: false } },
                  scales: { x: { display: false }, y: { display: false } },
                  elements: { point: { radius: 0 } },
                }}
              />
            </div>
          </div>
        </article>

        <article className="card metric-card">
          <span className="panel-label">ALERTS</span>
          <strong>{metrics.alertsToday} temperature alerts today</strong>
          <p>Counts readings where temperature exceeded 35°C.</p>
        </article>

        <article className="card metric-card">
          <span className="panel-label">NODE UPTIME</span>
          <strong>{Number.isFinite(metrics.uptime) ? `${metrics.uptime.toFixed(0)}% of expected readings received` : 'No uptime yet'}</strong>
          <p>Calculated from the last 24 hours against the 15-minute expected publish interval.</p>
        </article>

        <article className="card metric-card">
          <span className="panel-label">Day / night cycle</span>
          <strong>{metrics.lightHoursToday.toFixed(1)} hours of light today</strong>
          <p>Estimated from readings where light is above the daylight threshold.</p>
        </article>

        <article className="card metric-card">
          <span className={`metric-status ${heatTone}`}>Heat stress risk</span>
          <strong>{metrics.heatRiskText}</strong>
          <p>{metrics.latest ? `Latest temperature: ${metrics.latest.temperature.toFixed(1)}°C` : 'No temperature reading yet.'}</p>
        </article>

        <article className="card metric-card">
          <span className="panel-label">Daily averages</span>
          <strong>
            {metrics.temperatureAverage != null && metrics.humidityAverage != null && metrics.lightAverage != null
              ? `${metrics.temperatureAverage.toFixed(1)}°C / ${metrics.humidityAverage.toFixed(0)}% / ${metrics.lightAverage.toFixed(0)}`
              : 'No daily average yet'}
          </strong>
          <p>Temperature / humidity / light average for today.</p>
        </article>

        <article className="card metric-card">
          <span className="panel-label">Humidity change (1h)</span>
          <strong>{selectedNodeHumidityChange != null ? `${Math.round(selectedNodeHumidityChange)}%` : '—'}</strong>
          <p>{selectedNodeHumidityAlert ? 'Drop >10% in last hour — watering recommended.' : 'No sudden drop detected.'}</p>
        </article>

        <article className="card metric-card">
          <span className="panel-label">Harvest window</span>
          <strong>
            {(() => {
              const node = global.nodes.find((n: any) => n.nodeId === nodeId);
              if (!node || !node.latest) return 'Insufficient data';
              const idealTempMin = 20; const idealTempMax = 30; const idealHumMin = 40; const idealHumMax = 70;
              const nowTemp = node.latest.temperature; const nowHum = node.latest.humidity;
              const tSlope = node.tempSlopePerHour; const hSlope = node.humSlopePerHour;
              const candidateHours: number[] = [];
              if (tSlope > 0) candidateHours.push((idealTempMax - nowTemp) / tSlope);
              if (tSlope < 0) candidateHours.push((idealTempMin - nowTemp) / tSlope);
              if (hSlope > 0) candidateHours.push((idealHumMax - nowHum) / hSlope);
              if (hSlope < 0) candidateHours.push((idealHumMin - nowHum) / hSlope);
              const positive = candidateHours.filter((h) => Number.isFinite(h) && h > 0);
              if (!positive.length) return '>=24 hours';
              const hours = Math.min(...positive);
              if (hours > 24) return '>=24 hours';
              return `${hours.toFixed(1)} hours`;
            })()}
          </strong>
          <p>Estimated time remaining before conditions exit ideal ranges.</p>
        </article>

        <article className="card metric-card">
          <span className={`metric-status ${humidityTone}`}>Humidity status</span>
          <strong>{humidityLabel}</strong>
          <p>{metrics.latest ? `Current humidity: ${metrics.latest.humidity.toFixed(0)}%` : 'No humidity reading yet.'}</p>
        </article>
      </div>

      <div className="card metric-footnote">
        <p>
          {metrics.latest
            ? `Selected node ${nodeId} is currently ${metrics.safeHumidity ? 'within' : 'outside'} the ideal crop humidity range, and the live trend is ${metrics.trendPerHour != null && metrics.trendPerHour >= 0 ? 'rising' : 'falling or stable'}.`
            : 'Wait for sensor data to populate the analytics cards.'}
        </p>
      </div>

    </section>
  );
}
