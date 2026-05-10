import React from 'react';
import Dashboard from './components/Dashboard';

const phases = [
  {
    id: 'PHASE 1',
    title: 'Secure the edge',
    text: 'UNO R4 WiFi publishes through WiFiSSLClient over MQTTS port 8883.',
  },
  {
    id: 'PHASE 2',
    title: 'Power optimization',
    text: 'Wake, publish, disconnect, sleep, and reconnect on the next cycle.',
  },
  {
    id: 'PHASE 3',
    title: 'Permanent storage',
    text: 'Supabase stores temperature, humidity, node identity, and timestamps.',
  },
  {
    id: 'PHASE 4',
    title: 'Event bridge',
    text: 'n8n moves MQTT payloads into the database without extra firmware logic.',
  },
  {
    id: 'PHASE 5',
    title: 'Global dashboard',
    text: 'GitHub Pages serves the presentation layer as a public project site.',
  },
];

const checklist = [
  'Arduino UNO R4 WiFi sketch for secure MQTT and LED control',
  'Supabase SQL for sensor_logs and analytics queries',
  'n8n bridge notes for Adafruit IO to Supabase',
  'GitHub Pages-ready React landing page',
  'Deployment script using gh-pages',
];

const analytics = [
  'Daily averages per node',
  'Heat stress alerts',
  'Node uptime score',
  'Trend detection for rising or falling readings',
];

function App() {
  return (
    <div className="page-shell">
      <div className="orb orb-a" />
      <div className="orb orb-b" />

        <main className="app">
          <Dashboard />
          <section className="hero card">
            <div className="hero-copy">
            <p className="eyebrow">Smart Farm Enterprise Assignment</p>
            <h1>Ready for GitHub, GitHub Pages, and the full cloud pipeline.</h1>
            <p className="lead">
              This repo is set up as the public basis for the project: a polished landing page,
              the UNO R4 WiFi firmware with DHT11, photoresistor, and status LEDs, the Supabase
              schema, and the deployment path for Pages.
            </p>

            <div className="hero-badges">
              <span>Arduino UNO R4 WiFi</span>
              <span>MQTTS on 8883</span>
              <span>DHT11 + LDR</span>
              <span>Supabase</span>
              <span>n8n</span>
              <span>GitHub Pages</span>
            </div>
          </div>

          <aside className="hero-panel">
            <div>
              <span className="panel-label">Deployment mode</span>
              <strong>Static site on Pages</strong>
            </div>
            <div>
              <span className="panel-label">Firmware status</span>
              <strong>Secure MQTT + LEDs + sleep cycle</strong>
            </div>
            <div>
              <span className="panel-label">Analytics layer</span>
              <strong>Warehouse-ready queries</strong>
            </div>
          </aside>
        </section>

        <section className="section">
          <div className="section-heading">
            <p>Architecture</p>
            <h2>The five phases are mapped end to end.</h2>
          </div>

          <div className="phase-grid">
            {phases.map((phase) => (
              <article className="phase-card" key={phase.id}>
                <span>{phase.id}</span>
                <h3>{phase.title}</h3>
                <p>{phase.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section split-section">
          <article className="card checklist-card">
            <div className="section-heading compact">
              <p>Repo contents</p>
              <h2>Everything needed to start the GitHub repo is already in place.</h2>
            </div>

            <ul className="checklist">
              {checklist.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>

          <article className="card analytics-card">
            <div className="section-heading compact">
              <p>Analytics</p>
              <h2>Insight goes beyond graphs.</h2>
            </div>

            <p className="lead small">
              The assignment calls for analysis, not just visualization. This scaffold calls out
              the exact metrics that can be queried from Supabase and surfaced in the dashboard.
            </p>

            <div className="analytics-list">
              {analytics.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          </article>
        </section>

        <section className="section footer-card card">
          <div>
            <p className="eyebrow">Next step</p>
            <h2>Push this scaffold to GitHub, then publish it with gh-pages.</h2>
          </div>
          <p className="lead small">
            The site is intentionally static so GitHub Pages can host it cleanly. The firmware,
            schema, and deployment notes live in the repository beside the front end.
          </p>
        </section>
      </main>
    </div>
  );
}

export default App;
