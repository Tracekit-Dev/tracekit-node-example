# Node.js Test App for TraceKit APM

Test application for the TraceKit Node.js APM package with code monitoring support.

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment variables**:
   ```bash
   cp env.example .env
   # Edit .env and add your TraceKit API key
   # TRACEKIT_API_KEY=your-api-key-here
   ```

   Get your API key from: https://app.tracekit.dev

3. **Build the node-apm package** (if not already built):
   ```bash
   cd ../node-apm
   npm run build
   cd ../node-test
   ```

4. **Start the test app**:
   ```bash
   npm start
   ```

   The app will start on port 8084 by default.

## Features

This test app demonstrates:

- ✅ **Basic Tracing** - All HTTP requests are automatically traced
- ✅ **Code Monitoring** - Breakpoints and snapshot capture
- ✅ **Manual Polling** - Simulates background breakpoint polling
- ✅ **Exception Handling** - Automatic exception capture with stack traces
- ✅ **Variable Capture** - Captures local variables at snapshot points
- ✅ **Request Context** - Includes HTTP request details in traces

## Endpoints

### GET /
Home page with endpoint list

### GET /health
Health check endpoint

### GET /test
Basic test route with snapshot capture

**Example**:
```bash
curl http://localhost:8084/test
```

### GET /users
Get users list with optional limit

**Example**:
```bash
curl http://localhost:8084/users?limit=2
```

### POST /checkout
Checkout flow with payment processing

**Request Body**:
```json
{
  "userId": 1,
  "amount": 50,
  "userType": "premium"
}
```

**Example**:
```bash
curl -X POST http://localhost:8084/checkout \
  -H "Content-Type: application/json" \
  -d '{"userId":1,"amount":50,"userType":"premium"}'
```

**Snapshot Labels**:
- `checkout-start` - At the beginning of checkout
- `discount-calculated` - After calculating discount
- `payment-success` - After successful payment
- `checkout-error` - On payment error

### GET /error-test
Test handled error with snapshot capture

**Example**:
```bash
curl http://localhost:8084/error-test
```

**Snapshot Labels**:
- `before-error` - Before throwing error
- `error-caught` - In catch block

### GET /exception-test
Test unhandled exception (code discovery)

**Example**:
```bash
curl http://localhost:8084/exception-test
```

This endpoint throws an unhandled exception that will be:
- Captured by the error handler middleware
- Recorded as an exception event
- Sent with full stack trace for code discovery

## Testing Code Monitoring

1. **Start the TraceKit backend** (if not already running):
   ```bash
   # From the main project directory
   make run
   ```

2. **Start the test app**:
   ```bash
   npm start
   ```

3. **Trigger some requests** to create breakpoints:
   ```bash
   curl http://localhost:8084/test
   curl http://localhost:8084/checkout -X POST -H "Content-Type: application/json" -d '{"userId":1,"amount":50}'
   ```

4. **Check TraceKit dashboard** for:
   - Active breakpoints (auto-created)
   - Captured snapshots with variables
   - Request traces
   - Exception events

5. **Enable breakpoints in the dashboard** and trigger more requests to capture snapshots

## Testing Exception Code Discovery

1. **Trigger an exception**:
   ```bash
   curl http://localhost:8084/exception-test
   ```

2. **Check the TraceKit dashboard** under "Code Discovery":
   - Should see discovered code locations from the exception stack trace
   - Locations should show file paths and line numbers
   - Should include function names from the call stack

## Configuration

### Environment Variables

- `TRACEKIT_API_KEY` - Your TraceKit API key (default: `test-api-key`)
- `TRACEKIT_ENDPOINT` - TraceKit endpoint URL (default: `https://api.tracekit.dev/v1/traces`)
- `TRACEKIT_SERVICE_NAME` - Service name for traces (default: `node-test-app`)
- `TRACEKIT_CODE_MONITORING_ENABLED` - Enable code monitoring (default: `true`)
- `PORT` - Server port (default: `8084`)

### Code Monitoring Options

Code monitoring is enabled by default. To disable:

```bash
TRACEKIT_CODE_MONITORING_ENABLED=false npm start
```

## User Data

The app includes 3 test users:

```javascript
[
  { id: 1, name: 'John Doe', credits: 100 },
  { id: 2, name: 'Jane Smith', credits: 250 },
  { id: 3, name: 'Bob Wilson', credits: 50 },
]
```

## Development

### Watch Mode

For development with auto-reload, you can use nodemon:

```bash
npm install -g nodemon
nodemon app.js
```

### Debug Logging

The app logs all requests and errors to the console. Check the output for:
- Snapshot captures
- Breakpoint polling
- Exception traces
- Request handling

## Troubleshooting

### Code monitoring not working

1. Check that the backend is running
2. Verify `TRACEKIT_CODE_MONITORING_ENABLED=true`
3. Check console output for "Code Monitoring: ✅ ENABLED"
4. Ensure breakpoints are enabled in the TraceKit dashboard

### Snapshots not captured

1. Trigger a request to auto-create the breakpoint
2. Enable the breakpoint in the dashboard
3. Wait for polling cycle (~30s) or trigger manual poll
4. Make another request to capture the snapshot

### Dependencies not found

Make sure to build the node-apm package first:

```bash
cd ../node-apm
npm run build
cd ../node-test
npm install
```

