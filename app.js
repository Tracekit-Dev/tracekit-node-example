const express = require('express');
const http = require('http');
const { init, middleware, getClient } = require('@tracekit/node-apm');
require('dotenv').config(); // Load environment variables from .env file

const app = express();
app.use(express.json());

// Service URLs for cross-service communication
const GO_SERVICE_URL = 'http://localhost:8082';
const PYTHON_SERVICE_URL = 'http://localhost:5001';
const LARAVEL_SERVICE_URL = 'http://localhost:8083';
const PHP_SERVICE_URL = 'http://localhost:8086';

// Validate required environment variables
if (!process.env.TRACEKIT_API_KEY) {
  console.error('❌ ERROR: TRACEKIT_API_KEY environment variable is required.');
  console.error('   Please copy env.example to .env and add your API key.');
  console.error('   Get your API key from: https://app.tracekit.dev');
  process.exit(1);
}

// Initialize TraceKit with configuration from environment variables
const client = init({
  apiKey: process.env.TRACEKIT_API_KEY,
  endpoint: process.env.TRACEKIT_ENDPOINT || 'http://localhost:8081/v1/traces',
  serviceName: process.env.SERVICE_NAME || 'node-test-app',
  enableCodeMonitoring: process.env.TRACEKIT_CODE_MONITORING === 'true',
  autoInstrumentHttpClient: true, // This enables CLIENT spans for outgoing HTTP calls
  // Map localhost URLs to actual service names for service graph
  // This helps TraceKit understand cross-service dependencies
  serviceNameMappings: {
    'localhost:8082': 'go-test-app',
    'localhost:5001': 'python-test-app',
    'localhost:8083': 'laravel-test-app',
    'localhost:8086': 'php-test-app',
  },
});

// Use the middleware (includes request context extraction)
app.use(middleware());

// Initialize metrics
const requestCounter = client.counter('http.requests.total', { service: 'node-test-app' });
const activeRequestsGauge = client.gauge('http.requests.active', { service: 'node-test-app' });
const requestDurationHistogram = client.histogram('http.request.duration', { unit: 'ms' });
const errorCounter = client.counter('http.errors.total', { service: 'node-test-app' });

// Metrics middleware to track all requests
app.use((req, res, next) => {
  const startTime = Date.now();

  // Track active requests
  activeRequestsGauge.inc();

  // Track request completion
  res.on('finish', () => {
    activeRequestsGauge.dec();

    // Track request count
    requestCounter.inc();

    // Track request duration
    const duration = Date.now() - startTime;
    requestDurationHistogram.record(duration);

    // Track errors
    if (res.statusCode >= 400) {
      errorCounter.inc();
    }
  });

  next();
});

// Helper function to make HTTP calls (auto-instrumented)
function makeHttpRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || 80,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {},
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }

    req.end();
  });
}

// Simulate database and helper functions
const users = [
  { id: 1, name: 'John Doe', email: 'john@example.com', credits: 100 },
  { id: 2, name: 'Jane Smith', email: 'jane@example.com', credits: 250 },
  { id: 3, name: 'Bob Wilson', email: 'bob@example.com', credits: 50 },
];

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'node-test-app',
    codeMonitoringEnabled: client.getSnapshotClient() !== null,
    timestamp: new Date().toISOString(),
  });
});

// Home page
app.get('/', (req, res) => {
  res.json({
    message: 'TraceKit Node.js Test App',
    endpoints: [
      'GET  /health',
      'GET  /',
      'GET  /api/data           - Data endpoint (called by other services)',
      'GET  /api/call-go        - Call Go service',
      'GET  /api/call-python    - Call Python service',
      'GET  /api/call-laravel   - Call Laravel service',
      'GET  /api/call-php       - Call PHP service',
      'GET  /api/call-all       - Call all services',
      'GET  /api/chain-test     - Chain test: Node -> Go -> Response',
      'GET  /users',
      'POST /checkout',
      'GET  /security-test      - Test security scanning for sensitive data',
    ],
    codeMonitoring: client.getSnapshotClient() !== null,
    metrics: {
      enabled: true,
      tracked: [
        'http.requests.total - Total HTTP requests',
        'http.requests.active - Active HTTP requests',
        'http.request.duration - Request duration in ms',
        'http.errors.total - Total HTTP errors',
      ],
    },
  });
});

// Data endpoint - called by Go service
app.get('/api/data', async (req, res) => {
  // Capture snapshot
  await client.captureSnapshot('data-endpoint', {
    caller: req.headers['user-agent'] || 'unknown',
    traceparent: req.headers['traceparent'] || 'none',
  });

  // Simulate some processing
  await new Promise(resolve => setTimeout(resolve, 50));

  res.json({
    message: 'Data from Node.js service',
    service: 'node-test-app',
    items: [
      { id: 1, name: 'Item 1', price: 10.99 },
      { id: 2, name: 'Item 2', price: 24.99 },
      { id: 3, name: 'Item 3', price: 5.99 },
    ],
    timestamp: new Date().toISOString(),
  });
});

// Endpoint that calls Go service - tests CLIENT spans from Node
app.get('/api/call-go', async (req, res) => {
  try {
    await client.captureSnapshot('call-go-start', {
      target: 'go-test-app',
    });

    // Make HTTP call to Go service (auto-instrumented, creates CLIENT span)
    const response = await makeHttpRequest(`${GO_SERVICE_URL}/api/data`);

    await client.captureSnapshot('call-go-success', {
      goResponse: response.data,
      status: response.status,
    });

    res.json({
      service: 'node-test-app',
      called: 'go-test-app',
      response: response.data,
      status: response.status,
    });
  } catch (error) {
    await client.captureSnapshot('call-go-error', {
      error: error.message,
    });

    res.status(500).json({
      service: 'node-test-app',
      called: 'go-test-app',
      error: error.message,
    });
  }
});

// Call Python service
app.get('/api/call-python', async (req, res) => {
  try {
    const response = await makeHttpRequest(`${PYTHON_SERVICE_URL}/api/data`);
    res.json({
      service: 'node-test-app',
      called: 'python-test-app',
      response: response.data,
      status: response.status,
    });
  } catch (error) {
    res.status(500).json({
      service: 'node-test-app',
      called: 'python-test-app',
      error: error.message,
    });
  }
});

// Call Laravel service
app.get('/api/call-laravel', async (req, res) => {
  try {
    const response = await makeHttpRequest(`${LARAVEL_SERVICE_URL}/api/data`);
    res.json({
      service: 'node-test-app',
      called: 'laravel-test-app',
      response: response.data,
      status: response.status,
    });
  } catch (error) {
    res.status(500).json({
      service: 'node-test-app',
      called: 'laravel-test-app',
      error: error.message,
    });
  }
});

// Call PHP service
app.get('/api/call-php', async (req, res) => {
  try {
    const response = await makeHttpRequest(`${PHP_SERVICE_URL}/api/data`);
    res.json({
      service: 'node-test-app',
      called: 'php-test-app',
      response: response.data,
      status: response.status,
    });
  } catch (error) {
    res.status(500).json({
      service: 'node-test-app',
      called: 'php-test-app',
      error: error.message,
    });
  }
});

// Call all services
app.get('/api/call-all', async (req, res) => {
  const services = [
    { name: 'go-test-app', url: GO_SERVICE_URL },
    { name: 'python-test-app', url: PYTHON_SERVICE_URL },
    { name: 'laravel-test-app', url: LARAVEL_SERVICE_URL },
    { name: 'php-test-app', url: PHP_SERVICE_URL },
  ];

  const results = {
    service: 'node-test-app',
    chain: [],
  };

  for (const svc of services) {
    try {
      const response = await makeHttpRequest(`${svc.url}/api/data`);
      results.chain.push({
        service: svc.name,
        status: response.status,
        response: response.data,
      });
    } catch (error) {
      results.chain.push({
        service: svc.name,
        error: error.message,
      });
    }
  }

  res.json(results);
});

// Chain test - Node calls Go, demonstrates distributed tracing
app.get('/api/chain-test', async (req, res) => {
  try {
    await client.captureSnapshot('chain-test-start', {
      initiator: 'node-test-app',
    });

    // First call to Go
    const usersResponse = await makeHttpRequest(`${GO_SERVICE_URL}/api/users`);

    await client.captureSnapshot('chain-test-users-fetched', {
      userCount: usersResponse.data?.users?.length || 0,
    });

    // Second call to Go
    const healthResponse = await makeHttpRequest(`${GO_SERVICE_URL}/health`);

    await client.captureSnapshot('chain-test-complete', {
      usersStatus: usersResponse.status,
      healthStatus: healthResponse.status,
    });

    res.json({
      message: 'Chain test completed',
      users: usersResponse.data,
      health: healthResponse.data,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Chain test failed',
      message: error.message,
    });
  }
});

// Get all users
app.get('/users', async (req, res) => {
  const limit = parseInt(req.query.limit) || users.length;

  await client.captureSnapshot('fetch-users', {
    requestedLimit: limit,
    totalUsers: users.length,
  });

  const result = users.slice(0, limit);

  res.json({
    users: result,
    count: result.length,
  });
});

// Checkout endpoint with complex logic
app.post('/checkout', async (req, res) => {
  const { userId, amount, userType } = req.body;

  if (!userId || !amount) {
    return res.status(400).json({
      error: 'Missing required fields: userId and amount',
    });
  }

  await client.captureSnapshot('checkout-start', {
    userId,
    amount,
    userType,
  });

  try {
    const user = users.find(u => u.id === userId);
    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    let discount = 0;
    if (userType === 'premium') {
      discount = amount * 0.2;
    } else if (userType === 'regular') {
      discount = amount * 0.1;
    }

    const finalAmount = amount - discount;

    if (user.credits < finalAmount) {
      throw new Error(`Insufficient credits. User has ${user.credits}, needs ${finalAmount}`);
    }

    user.credits -= finalAmount;
    const paymentId = `pay_${Date.now()}`;

    await client.captureSnapshot('checkout-success', {
      userId,
      paymentId,
      finalAmount,
      remainingCredits: user.credits,
    });

    res.json({
      success: true,
      payment: {
        paymentId,
        amount: finalAmount,
        remainingCredits: user.credits,
      },
      discount,
    });
  } catch (error) {
    await client.captureSnapshot('checkout-error', {
      userId,
      error: error.message,
    });

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Security test route
app.get('/security-test', async (req, res) => {
  // Test sensitive data detection in snapshots
  await client.captureSnapshot('security-test-with-sensitive-data', {
    password: 'super_secret_password_123',
    api_key: 'test_key_AbCdEfGhIjKlMnOpQrStUvWxYz1234567890',
    user_token: 'test_access_token',
    credit_card: '4532015112830366',
    normal_var: 'This is just normal data',
  });

  res.json({
    message: 'Security test completed - check for security events',
    note: 'Sensitive data should be redacted in the snapshot',
  });
});

// Error test route
app.get('/error-test', async (req, res) => {
  try {
    await client.captureSnapshot('before-error', {
      step: 'about to throw error',
    });

    throw new Error('Intentional test error for code monitoring');
  } catch (error) {
    await client.captureSnapshot('error-caught', {
      error: error.message,
      errorType: error.constructor.name,
    });

    res.status(500).json({
      error: error.message,
      captured: true,
    });
  }
});

// Error handler middleware
app.use((err, req, res, next) => {
  console.error('Error caught by error handler:', err);

  const span = req.__tracekitSpan || client.startSpan('error-handler', null, {
    'error.type': err.constructor.name,
    'error.message': err.message,
  });

  client.recordException(span, err);

  if (!req.__tracekitSpan) {
    client.endSpan(span, {}, 'ERROR');
  }

  res.status(500).json({
    error: err.message,
    type: 'unhandled-exception',
    traced: true,
  });
});

const port = 8084;

app.listen(port, '0.0.0.0', () => {
  console.log('');
  console.log('🚀 Node.js Test App Started');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📍 Server:              http://localhost:${port}`);
  console.log(`🔧 Service Name:        node-test-app`);
  console.log(`📊 TraceKit Endpoint:   http://localhost:8081/v1/traces`);
  console.log(`📸 Code Monitoring:     ${client.getSnapshotClient() ? '✅ ENABLED' : '❌ DISABLED'}`);
  console.log(`🔗 HTTP Client Instr:   ✅ ENABLED (auto CLIENT spans)`);
  console.log(`📈 Metrics:             ✅ ENABLED (Counter, Gauge, Histogram)`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('📈 Metrics Tracked:');
  console.log('  • http.requests.total - Total HTTP requests');
  console.log('  • http.requests.active - Active HTTP requests');
  console.log('  • http.request.duration - Request duration (ms)');
  console.log('  • http.errors.total - Total HTTP errors');
  console.log('');
  console.log('📋 Available Endpoints:');
  console.log(`  GET  http://localhost:${port}/              - Home`);
  console.log(`  GET  http://localhost:${port}/health        - Health check`);
  console.log(`  GET  http://localhost:${port}/api/data      - Data endpoint (called by Go)`);
  console.log(`  GET  http://localhost:${port}/api/call-go   - Call Go service (CLIENT span)`);
  console.log(`  GET  http://localhost:${port}/api/chain-test - Chain: Node -> Go multiple calls`);
  console.log(`  GET  http://localhost:${port}/users         - Get users list`);
  console.log(`  POST http://localhost:${port}/checkout      - Checkout flow`);
  console.log(`  GET  http://localhost:${port}/error-test    - Error test`);
  console.log('');
  console.log('💡 Test Commands:');
  console.log(`  curl http://localhost:${port}/api/data`);
  console.log(`  curl http://localhost:${port}/api/call-go`);
  console.log(`  curl http://localhost:${port}/api/chain-test`);
  console.log('');
  console.log('🔗 Cross-Service Test (run Go app on :8082 first):');
  console.log(`  curl http://localhost:8082/api/call-node  # Go calls Node`);
  console.log(`  curl http://localhost:${port}/api/call-go   # Node calls Go`);
  console.log(`  curl http://localhost:8082/api/chain       # Go -> Node -> Go`);
  console.log('');
});
