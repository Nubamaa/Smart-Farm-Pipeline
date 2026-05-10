create table if not exists sensor_logs (
  id bigserial primary key,
  node_id text not null default 'node-a',
  temperature double precision not null,
  humidity double precision not null,
  created_at timestamptz not null default now()
);

create index if not exists sensor_logs_node_created_at_idx
  on sensor_logs (node_id, created_at desc);
