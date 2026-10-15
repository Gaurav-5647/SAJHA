/**
 * SCALE LOAD TESTING - PROMPT #03
 * 
 * Load test using k6: https://k6.io/
 * 
 * Usage:
 *   npm install -g k6
 *   k6 run tests/load-test.js
 * 
 * This test simulates realistic user behavior:
 * - Browse services (GET)
 * - Search workers (GET)
 * - Create booking (POST)
 * - View booking status (GET)
 * 
 * Success criteria:
 * - p95 latency < 500ms
 * - Failed requests < 1%
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const CUSTOMER_TOKEN = __ENV.CUSTOMER_TOKEN || 'test-token';
const WORKER_TOKEN = __ENV.WORKER_TOKEN || 'test-token';

// Custom metrics
const failureRate = new Rate('request_failures');
const duration = new Trend('request_duration');
const bookingSuccess = new Counter('bookings_created');

export const options = {
  stages: [
    { duration: '1m', target: 10 },    // Ramp to 10 users
    { duration: '3m', target: 50 },    // Ramp to 50 users
    { duration: '5m', target: 100 },   // Hold at 100 users
    { duration: '2m', target: 50 },    // Ramp down to 50
    { duration: '1m', target: 0 },     // Ramp down to 0
  ],
  thresholds: {
    'http_req_duration': ['p(95)<500'], // 95% of requests must complete < 500ms
    'http_req_failed': ['rate<0.01'],    // Error rate must be < 1%
  },
};

export default function () {
  // Simulate customer browsing
  browseServices();
  
  sleep(2);
  
  // Search for workers
  searchWorkers();
  
  sleep(1);
  
  // Create a booking
  createBooking();
  
  sleep(3);
  
  // Check booking status
  checkBookingStatus();
  
  sleep(2);
}

function browseServices() {
  const res = http.get(`${BASE_URL}/api/services`, {
    headers: {
      'Authorization': `Bearer ${CUSTOMER_TOKEN}`,
    },
  });
  
  check(res, {
    'services loaded': (r) => r.status === 200,
    'has services': (r) => r.json().length > 0,
  });
  
  failureRate.add(!res.ok);
  duration.add(res.timings.duration);
}

function searchWorkers() {
  const res = http.get(
    `${BASE_URL}/api/workers?district=Patna&skill=Plumbing`,
    {
      headers: {
        'Authorization': `Bearer ${CUSTOMER_TOKEN}`,
      },
    }
  );
  
  check(res, {
    'workers searched': (r) => r.status === 200,
    'has results': (r) => r.json().length > 0,
  });
  
  failureRate.add(!res.ok);
  duration.add(res.timings.duration);
}

function createBooking() {
  const payload = JSON.stringify({
    workerId: '507f1f77bcf86cd799439011', // Mock ID
    serviceId: '507f1f77bcf86cd799439012',
    addressId: '507f1f77bcf86cd799439013',
    date: new Date().toISOString().split('T')[0],
    time: '10:00',
    notes: 'Load test booking',
  });
  
  const res = http.post(`${BASE_URL}/api/bookings`, payload, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CUSTOMER_TOKEN}`,
    },
  });
  
  check(res, {
    'booking created': (r) => r.status === 201,
    'has booking id': (r) => r.json()._id,
  });
  
  if (res.ok) {
    bookingSuccess.add(1);
  }
  
  failureRate.add(!res.ok);
  duration.add(res.timings.duration);
}

function checkBookingStatus() {
  const res = http.get(
    `${BASE_URL}/api/bookings/507f1f77bcf86cd799439014`,
    {
      headers: {
        'Authorization': `Bearer ${CUSTOMER_TOKEN}`,
      },
    }
  );
  
  check(res, {
    'booking fetched': (r) => [200, 404].includes(r.status),
  });
  
  failureRate.add(res.status >= 400);
  duration.add(res.timings.duration);
}

/**
 * EXPECTED RESULTS:
 * 
 * Before optimization:
 *   - p95: ~1200ms
 *   - fail rate: ~5%
 *   - breaking point: ~40 users
 * 
 * After indexes + caching:
 *   - p95: ~300ms (4x faster)
 *   - fail rate: < 0.5%
 *   - breaking point: ~200 users
 * 
 * Run the test before and after applying indexes to measure improvement.
 */
