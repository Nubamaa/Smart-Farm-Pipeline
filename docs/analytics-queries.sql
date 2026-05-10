-- Daily averages per node
select
  node_id,
  date(created_at) as day,
  round(avg(temperature)::numeric, 2) as avg_temp,
  round(avg(humidity)::numeric, 2) as avg_humidity
from sensor_logs
group by node_id, day
order by day desc;

-- Heat stress alerts
select *
from sensor_logs
where temperature > 35 or humidity < 40
order by created_at desc;

-- Uptime score per node
select
  node_id,
  count(*) as reading_count
from sensor_logs
where created_at > now() - interval '7 days'
group by node_id
order by reading_count desc;

-- Rising or falling trend today
select
  node_id,
  first_value(temperature) over (partition by node_id order by created_at) as first_reading,
  last_value(temperature) over (
    partition by node_id
    order by created_at
    rows between unbounded preceding and unbounded following
  ) as last_reading
from sensor_logs
where date(created_at) = current_date;
