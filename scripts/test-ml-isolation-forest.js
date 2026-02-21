/**
 * Test ML Isolation Forest Improvements
 * Verifies:
 * - Severity levels
 * - Explanations
 */

const { spawn } = require('child_process');
const path = require('path');

// Simulate data: [temp, humidity]
const data = [];

// Normal data (around 25C, 50%)
for (let i = 0; i < 50; i++) {
    data.push([
        25 + Math.random() * 2,
        50 + Math.random() * 5
    ]);
}

// Anomalies
data.push([45, 10]); // High Temp (should be critical/high)
data.push([5, 90]);  // Low Temp, High Hum
data.push([25, 50]); // Normal point mixed in

const input = {
    data,
    contamination: 0.1,
    feature_set: "environmental"
};

console.log("Running Isolation Forest Test...");

const python = process.env.PYTHON_PATH || (process.platform === 'win32' ? 'python' : 'python3');
const scriptPath = path.join(__dirname, 'ml_isolation_forest.py');

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

        if (result.error) {
            console.error("API Error:", result.error);
            return;
        }

        const anomalyIdx = 50; // The first anomaly we added
        const anomaly = result.severities[anomalyIdx];

        console.log("\n--- Anomaly Detection Results ---");
        console.log(`Total Points: ${result.scores.length}`);
        console.log(`Anomalies Detected: ${result.labels.filter(l => l === -1).length}`);

        console.log("\nCheck 45°C Point (Index 50):");
        console.log(`Score: ${result.scores[anomalyIdx].toFixed(4)}`);
        console.log(`Label: ${result.labels[anomalyIdx]} (-1 expected)`);
        console.log(`Severity: ${anomaly.level} (Expected: high/critical)`);

        if (anomaly.explanation) {
            console.log(`Explanation: ${JSON.stringify(anomaly.explanation)}`);
            console.log("PASS: Explanation present");
        } else {
            console.error("FAIL: Missing explanation for anomaly");
        }

    } catch (e) {
        console.error("Parse Error:", e);
        console.log("Raw Output:", stdout);
    }
});

proc.stdin.write(JSON.stringify(input));
proc.stdin.end();
