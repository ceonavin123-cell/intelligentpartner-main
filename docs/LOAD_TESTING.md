# Load Testing Guide

## Tools
- **k6** (recommended): `brew install k6`
- **Artillery**: `npm install -g artillery`

## Test 1: Chat Endpoint (50 concurrent users)

```bash
k6 run --vus 50 --duration 60s -e BASE_URL=http://localhost:5173 << 'EOF'
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  thresholds: {
    http_req_duration: [{ threshold: 'p(95)<30000', abortOnFail: false }],
    http_req_failed: [{ threshold: 'rate<0.1', abortOnFail: false }],
  },
};

export default function () {
  const res = http.post(`${__ENV.BASE_URL}/_server/src/lib/chat.functions.ts/sendChatMessage`, JSON.stringify({
    data: { threadId: '22222222-2222-2222-2222-222222222222', message: 'What is our revenue?' }
  }), { headers: { 'Content-Type': 'application/json' } });
  
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 30s': (r) => r.timings.duration < 30000,
  });
}
EOF
```

## Test 2: Auth Endpoint (100 concurrent attempts)

```bash
k6 run --vus 100 --duration 30s << 'EOF'
import http from 'k6/http';

export default function () {
  http.post('https://gyidknazegcuicmoldjh.supabase.co/auth/v1/token?grant_type=password', JSON.stringify({
    email: 'test@example.com',
    password: 'testpassword',
  }), { headers: { 'Content-Type': 'application/json', apikey: 'your-anon-key' } });
}
EOF
```

## Test 3: Document Upload (20 concurrent uploads)

```bash
k6 run --vus 20 --duration 30s << 'EOF'
import http from 'k6/http';

export default function () {
  const body = JSON.stringify({
    data: { companyId: '11111111-1111-1111-1111-111111111111', name: 'test.txt', mime: 'text/plain', text: 'Test content' }
  });
  http.post(`${__ENV.BASE_URL}/_server/src/lib/documents.functions.ts/uploadCompanyDocument`, body, {
    headers: { 'Content-Type': 'application/json' },
  });
}
EOF
```

## Expected Results

| Metric | Target |
|--------|--------|
| Chat p95 latency | < 30s |
| Auth p95 latency | < 2s |
| Upload p95 latency | < 5s |
| Error rate | < 1% |
| Rate limit triggers | Expected at 50+ concurrent users |
