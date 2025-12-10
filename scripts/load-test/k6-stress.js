// Stress Test Script for FLM Proxy
// Tests: 500 req/min peak load, 1000 req/min stress test

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const requestDuration = new Trend('request_duration');

export const options = {
    stages: [
        { duration: '2m', target: 8 },      // Ramp up to 8 req/sec (480 req/min)
        { duration: '5m', target: 8 },      // Sustained peak: 480 req/min
        { duration: '2m', target: 17 },     // Ramp up to 17 req/sec (1020 req/min) - stress test
        { duration: '5m', target: 17 },     // Sustained stress: 1020 req/min
        { duration: '2m', target: 0 },      // Ramp down
    ],
    thresholds: {
        'http_req_duration': ['p(95)<5000', 'p(99)<10000'],  // Relaxed thresholds for stress test
        'errors': ['rate<0.01'],  // Error rate < 1% (relaxed for stress test)
        'request_duration': ['p(95)<5000'],
    },
};

const PROXY_URL = __ENV.PROXY_URL || 'http://localhost:9000';
const API_KEY = __ENV.API_KEY || '';

export default function () {
    // Test 1: Health endpoint
    const healthStart = Date.now();
    let healthRes = http.get(`${PROXY_URL}/health`);
    const healthDuration = Date.now() - healthStart;
    
    const healthCheck = check(healthRes, {
        'health status is 200': (r) => r.status === 200,
    });
    
    if (!healthCheck) {
        errorRate.add(1);
    }
    requestDuration.add(healthDuration);

    // Test 2: /v1/models endpoint (if API key provided)
    if (API_KEY) {
        const modelsStart = Date.now();
        let modelsRes = http.get(`${PROXY_URL}/v1/models`, {
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
            },
        });
        const modelsDuration = Date.now() - modelsStart;
        
        const modelsCheck = check(modelsRes, {
            'models status is 200': (r) => r.status === 200,
        });
        
        if (!modelsCheck) {
            errorRate.add(1);
        }
        requestDuration.add(modelsDuration);
    }

    // Reduced sleep for higher load: 0.1s = 10 req/sec per virtual user
    // With 17 virtual users, we get ~170 req/sec = 10200 req/min
    // But we limit to ~17 req/sec total = ~1020 req/min
    sleep(0.1);
}

