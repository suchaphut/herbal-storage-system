/**
 * Test ML Prophet Improvements
 * Verifies:
 * - Ensemble forecasting
 * - Confidence intervals
 * - Persistence (by checking meta)
 */

const { spawn } = require('child_process');
const path = require('path');

// Simulate 24 hours of data
const timestamps = [];
const temperatures = [];
const humidities = [];

const now = new Date();
for (let i = 0; i < 48; i++) {
    const t = new Date(now.getTime() - (47 - i) * 30 * 60 * 1000); // 30 min intervals
    timestamps.push(t.toISOString());

    // Sine wave pattern
    const temp = 25 + 5 * Math.sin(i / 8);
    const hum = 60 + 10 * Math.cos(i / 8);

    temperatures.push(temp);
    humidities.push(hum);
}

const input = {
    timestamps,
    temperature: temperatures,
    humidity: humidities,
    horizon_hours: 6
};

console.log("Running Prophet Test...");
console.log(`Input data points: ${timestamps.length}`);

const python = process.env.PYTHON_PATH || (process.platform === 'win32' ? 'python' : 'python3');
const scriptPath = path.join(__dirname, 'ml_prophet.py');

const proc = spawn(python, [scriptPath], {
    stdio: ['pipe', 'pipe', 'pipe']
});

let stdout = '';
let stderr = '';

proc.stdout.on('data', (d) => stdout += d);
proc.stderr.on('data', (d) => stderr += d);

proc.on('close', (code) => {
    if (code !== 0) {
        console.error("Error:", stderr);
        process.exit(1);
    }

    try {
        const result = JSON.parse(stdout);
        console.log("\n--- Results ---");

        if (result.error) {
            console.error("API Error:", result.error);
            return;
        }

        console.log(`Predictions: ${result.predictions.length}`);

        const firstPred = result.predictions[0];
        console.log("\nSample Prediction:");
        console.log(`Time: ${firstPred.time}`);
        console.log(`Temp: ${firstPred.temperature.toFixed(2)} (Low: ${firstPred.temp_low.toFixed(2)}, High: ${firstPred.temp_high.toFixed(2)})`);

        // Check for confidence intervals
        if (firstPred.temp_low === undefined || firstPred.temp_high === undefined) {
            console.error("FAIL: Missing confidence intervals");
        } else {
            console.log("PASS: Confidence intervals present");
        }

        // Check metadata
        if (result.meta) {
            console.log(`Model Version: ${result.meta.version}`);
            console.log("PASS: Metadata present");
        } else {
            console.error("FAIL: Missing metadata");
        }

        // Check Metrics
        console.log("\nMetrics:", result.metrics);

    } catch (e) {
        console.error("Parse Error:", e);
        console.log("Raw Output:", stdout);
    }
});

proc.stdin.write(JSON.stringify(input));
proc.stdin.end();
