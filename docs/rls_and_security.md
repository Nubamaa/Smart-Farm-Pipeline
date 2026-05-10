# Supabase RLS & Security Guidance (IoT ingestion)

Goal: accept row inserts from a trusted middleware (n8n), avoid exposing sensitive keys in public clients, and limit writes to known devices.

Recommended setup

1) Use n8n (server-side) to receive MQTT messages and insert rows into Supabase.
   - Store the Supabase `service_role` key securely in n8n credentials. The service role key bypasses RLS and should never be used client-side.

2) Harden Supabase with Row Level Security (RLS) for any client-facing access.
   - Keep anonymous (client-side) key limited to read-only queries (or avoid using it publically and use a proxy).

3) Optional: Add a lightweight token check to allow inserts only from known devices.
   - Create a table `allowed_nodes(node_id text primary key, token text)` and provision tokens for each node.
   - Have n8n include the node token in its create-row payload.

Example SQL: create allowed_nodes and enforce inserts

```sql
create table if not exists allowed_nodes (
  node_id text primary key,
  token text not null
);

-- enable RLS on the logs
alter table sensor_logs enable row level security;

-- policy: allow inserts only when the provided token matches allowed_nodes
create policy insert_from_n8n on sensor_logs
  for insert using (true) with check (
    exists (
      select 1 from allowed_nodes
      where allowed_nodes.node_id = new.node_id
        and allowed_nodes.token = new.insert_token
    )
  );
```

Notes about the policy
- `insert_token` is a column you add to `sensor_logs` (nullable) that n8n sets when creating rows. The policy checks that token against the `allowed_nodes` table.
- After insert, you can remove or null `insert_token` via a Postgres trigger if you do not want tokens stored long term.

Alternative: serverless proxy
- Deploy a tiny serverless function (Vercel, Cloud Run, AWS Lambda) that accepts a webhook from n8n and inserts into Supabase using the service_role key. This isolates the sensitive key from n8n's runtime if needed.

Monitoring and audit
- Use Supabase logs to monitor inserts and set up alerts or dashboards for unusual patterns (e.g., bursts of readings, identical timestamps, etc.).
