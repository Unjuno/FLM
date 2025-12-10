// Basic Load Test Script for FLM Proxy
// Tests: 100 req/min sustained load, latency measurements

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const requestDuration = new Trend('request_duration');

export const options = {
    stages: [
        { duration: '1m', target: 2 },      // Ramp up to 2 req/sec (120 req/min)
        { duration: '10m', target: 2 },     // Sustained load: 120 req/min
        { duration: '1m', target: 0 },      // Ramp down
    ],
    thresholds: {
        'http_req_duration': ['p(50)<500', 'p(95)<2000', 'p(99)<5000'],  // P50 < 500ms, P95 < 2s, P99 < 5s
        'errors': ['rate<0.005'],  // Error rate < 0.5%
        'request_duration': ['p(50)<500', 'p(95)<2000'],
    },
};

const PROXY_URL = __ENV.PROXY_URL || 'http://localhost:9000';
const API_KEY = __ENV.API_KEY || '';

export default function () {
    // Test 1: Health endpoint (no auth required)
    const healthStart = Date.now();
    let healthRes = http.get(`${PROXY_URL}/health`);
    const healthDuration = Date.now() - healthStart;
    
    const healthCheck = check(healthRes, {
        'health status is 200': (r) => r.status === 200,
        'health response time < 1s': (r) => r.timings.duration < 1000,
    });
    
    if (!healthCheck) {
        errorRate.add(1);
    }
    requestDuration.add(healthDuration);

    // Test 2: /v1/models endpoint (requires auth)
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
            'models response has data': (r) => {
                try {
                    const body = JSON.parse(r.body);
                    return body.object === 'list' && Array.isArray(body.data);
                } catch {
                    return false;
                }
            },
            'models response time < 2s': (r) => r.timings.duration < 2000,
        });
        
        if (!modelsCheck) {
            errorRate.add(1);
        }
        requestDuration.add(modelsDuration);
    }

    // Rate limiting: 1 request per second = 60 req/min per virtual user
    // With 2 virtual users, we get ~120 req/min
    sleep(1);
}

