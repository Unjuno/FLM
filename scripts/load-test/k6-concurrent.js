// Concurrent Connections Test Script for FLM Proxy
// Tests: 10, 50, 100 concurrent connections

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const requestDuration = new Trend('request_duration');

export const options = {
    stages: [
        { duration: '1m', target: 10 },     // Ramp up to 10 concurrent connections
        { duration: '5m', target: 10 },     // Sustained: 10 concurrent
        { duration: '1m', target: 50 },     // Ramp up to 50 concurrent
        { duration: '5m', target: 50 },     // Sustained: 50 concurrent
        { duration: '1m', target: 100 },   // Ramp up to 100 concurrent
        { duration: '5m', target: 100 },   // Sustained: 100 concurrent
        { duration: '1m', target: 0 },     // Ramp down
    ],
    thresholds: {
        'http_req_duration': ['p(50)<1000', 'p(95)<3000', 'p(99)<5000'],
        'errors': ['rate<0.01'],  // Error rate < 1% (relaxed for high concurrency)
        'request_duration': ['p(95)<3000'],
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
        'health response time acceptable': (r) => r.timings.duration < 2000,
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
            'models response time acceptable': (r) => r.timings.duration < 3000,
        });
        
        if (!modelsCheck) {
            errorRate.add(1);
        }
        requestDuration.add(modelsDuration);
    }

    // Each virtual user makes 1 request every 2 seconds
    // This allows for sustained concurrent connections
    sleep(2);
}

