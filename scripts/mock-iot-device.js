const http = require('http');

const API_URL = 'http://localhost:3000/api/data/ingest';
const NODE_ID = 'ESP32-ENV-001';
const SENSOR_API_KEY = process.env.SENSOR_API_KEY || 'your-sensor-api-key-here';

function sendData() {
  const data = JSON.stringify({
    nodeId: NODE_ID,
    type: 'environmental',
    readings: {
      temperature: 24 + (Math.random() * 2 - 1),
      humidity: 55 + (Math.random() * 5 - 2.5)
    }
  });

  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/data/ingest',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data),
      'x-api-key': SENSOR_API_KEY,
    }
  };

  const req = http.request(options, (res) => {
    console.log(`Status: ${res.statusCode}`);
    res.on('data', (d) => {
      process.stdout.write(d);
    });
  });

  req.on('error', (error) => {
    console.error('Error sending data:', error.message);
  });

  req.write(data);
  req.end();
}

console.log(`Starting mock IoT device: ${NODE_ID}`);
setInterval(sendData, 5000);
sendData();
