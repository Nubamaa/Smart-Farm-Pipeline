-- Analytics views and functions for trend detection and simple forecasting
-- 1) Per-node trend (slope/intercept) over a given recent window
-- 2) Predicted temperature after N seconds using linear regression

-- Function: node_temperature_trend(node_id text, hours int)
-- Returns slope (°C per epoch-second) and intercept for temperature = intercept + slope * epoch
create or replace function node_temperature_trend(p_node text, p_hours int)
returns table(node_id text, slope double precision, intercept double precision, last_ts timestamptz) as $$
begin
  return query
  select p_node as node_id,
         regr_slope(temperature, extract(epoch from created_at)) as slope,
         regr_intercept(temperature, extract(epoch from created_at)) as intercept,
         max(created_at) as last_ts
  from sensor_logs
  where node_id = p_node
    and created_at > now() - (p_hours || ' hours')::interval;
end;
$$ language plpgsql stable;

-- View: predicted_temperature_next_hour
-- Uses the trend function for each node and projects temperature 3600 seconds into the future
create or replace view predicted_temperature_next_hour as
select t.node_id,
       t.slope,
       t.intercept,
       t.last_ts,
       (t.intercept + t.slope * (extract(epoch from now()) + 3600)) as predicted_temp
from (
  select distinct node_id from sensor_logs
) nodes
cross join lateral (
  select * from node_temperature_trend(nodes.node_id, 6)
) t;

-- View: node_alerts_recent
-- Marks nodes where recent average temperature exceeds heat threshold or humidity is low
create or replace view node_alerts_recent as
select node_id,
       round(avg(temperature)::numeric,2) as avg_temp_1h,
       round(avg(humidity)::numeric,2) as avg_humidity_1h,
       bool_or(temperature > 35) as any_hot_recent
from sensor_logs
where created_at > now() - interval '1 hour'
group by node_id;

-- Indexes to speed analytics queries
create index if not exists sensor_logs_created_at_idx on sensor_logs (created_at desc);
create index if not exists sensor_logs_node_idx on sensor_logs (node_id);
