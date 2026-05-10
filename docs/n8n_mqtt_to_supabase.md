n8n: MQTT Trigger → Code (JS) → Supabase Create Row

Place this `Code` node between your MQTT Trigger and the Supabase `Create a row` node. It normalizes the incoming Adafruit IO payload into fields the `sensor_logs` table expects.

Code node (JavaScript)

```javascript
// items[0].json is the MQTT payload object from the trigger.
// Adafruit example (string or object):
// {"node_id":"node-a","temperature":24.5,"humidity":60,"light":512}

const input = items[0].json;
let payload = input.payload ?? input; // some triggers put raw string in `payload`
if (typeof payload === 'string') {
  try {
    payload = JSON.parse(payload);
  } catch (e) {
    // if parse fails, fall back to the raw object
    payload = input;
  }
}

return [{ json: {
  node_id: String(payload.node_id ?? payload.node ?? 'node-a'),
  temperature: parseFloat(payload.temperature ?? NaN),
  humidity: parseFloat(payload.humidity ?? NaN),
  light: parseInt(payload.light ?? payload.lux ?? 0, 10),
  created_at: new Date().toISOString(),
  // Optional: include a pre-shared token if you use RLS policies that require it
  // token: process.env.IOT_SHARED_TOKEN
}}];
```

Supabase `Create a row` node mapping (fields)
- `node_id` ← `{{$json.node_id}}`
- `temperature` ← `{{$json.temperature}}`
- `humidity` ← `{{$json.humidity}}`
- `light` ← `{{$json.light}}`
- `created_at` ← `{{$json.created_at}}`

Notes
- If you run n8n in cloud or a server, store the Supabase `service_role` key in n8n credentials (secret). Use the service key only from the server side (n8n), not client-side.
- If you want stricter security, add a `token` field to the payload and verify it in a Supabase policy or before inserting.
