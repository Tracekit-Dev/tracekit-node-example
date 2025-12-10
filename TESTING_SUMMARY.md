# Node.js Test App - Testing Summary

## Overview

The Node.js test app (`node-test`) has been successfully created and tested with the `@tracekit/node-apm` package (v1.1.0).

## Setup Details

- **Package**: `@tracekit/node-apm` (referenced locally from `../node-apm`)
- **Framework**: Express.js
- **Port**: 8084
- **Service Name**: `node-test-app`
- **API Key**: Configured
- **Code Monitoring**: ✅ ENABLED

## Features Tested

### ✅ 1. Basic Tracing
- **Status**: Working
- **Test**: `GET /test`
- **Result**: HTTP requests are automatically traced with OpenTelemetry
- **Attributes Captured**:
  - HTTP method, URL, route
  - User agent, client IP
  - Status code, duration

### ✅ 2. Code Monitoring (Snapshots)
- **Status**: Working
- **Test**: `GET /test`, `POST /checkout`
- **Result**: Snapshots are successfully captured with `client.captureSnapshot()`
- **Features**:
  - Auto-registration of breakpoints on first call
  - Background polling (every 30 seconds)
  - Breakpoints enabled/disabled from dashboard
  - Variable capture at snapshot points
  - Request context included in snapshots

### ✅ 3. Multiple Snapshot Points
- **Status**: Working
- **Test**: `POST /checkout`
- **Result**: Multiple snapshots captured in single request flow
- **Snapshot Labels**:
  - `checkout-start` - Beginning of checkout
  - `discount-calculated` - After discount calculation
  - `payment-success` - After successful payment
  - `checkout-error` - On payment failure

### ✅ 4. Error Handling with Snapshots
- **Status**: Working
- **Test**: `GET /error-test`
- **Result**: Errors caught and snapshots captured
- **Snapshot Labels**:
  - `before-error` - Before throwing error
  - `error-caught` - In catch block

### ✅ 5. Exception Tracing
- **Status**: Working
- **Test**: `GET /exception-test`
- **Result**: Unhandled exceptions are caught by error handler middleware
- **Features**:
  - Exception recorded with `client.recordException()`
  - Stack trace captured
  - Span marked as ERROR
  - App continues running (no crash)

### ✅ 6. Variable Capture
- **Status**: Working
- **Result**: Local variables successfully captured in snapshots
- **Examples**:
  - User IDs, amounts, timestamps
  - Calculation results (discounts, final amounts)
  - Error messages and types
  - Payment results

### ✅ 7. Request Context
- **Status**: Working
- **Result**: Request context automatically included in all snapshots
- **Context Includes**:
  - HTTP method and path
  - Query parameters
  - Client IP and user agent
  - Filtered headers

## Test Results Summary

| Endpoint | Purpose | Status | Snapshots | Traces |
|----------|---------|--------|-----------|--------|
| GET `/test` | Basic snapshot test | ✅ | 1 | ✅ |
| GET `/users` | User list with variables | ✅ | 1 | ✅ |
| POST `/checkout` | Multi-step flow | ✅ | 3+ | ✅ |
| GET `/error-test` | Error handling | ✅ | 2 | ✅ |
| GET `/exception-test` | Exception tracing | ✅ | 1 | ✅ |

## Code Monitoring Features Verified

### ✅ Auto-Registration
- First call to `captureSnapshot()` automatically creates breakpoint
- Breakpoint registered with function name + label
- No manual breakpoint creation needed

### ✅ Background Polling
- SDK polls for active breakpoints every 30 seconds
- Automatic - no manual `pollBreakpoints()` calls needed
- Breakpoint cache updated in background
- Log message: `📸 Updated breakpoint cache: X active breakpoints`

### ✅ Smart Matching
- Breakpoints matched by `function_name:label`
- Stable across code changes
- Cache invalidation on poll

### ✅ Production Safety
- No performance impact when breakpoints inactive
- Only captures when breakpoint is enabled
- Respects max captures limit
- Respects expiration time

## Differences from PHP/Laravel Implementation

### 1. **Automatic Polling**
- **Node.js**: Background polling happens automatically via `setInterval()`
- **PHP/Laravel**: Manual polling required (`$client->pollBreakpoints()`)
- **Reason**: Node.js is event-driven, can run background tasks

### 2. **Stack Trace Format**
- **Node.js**: Uses OpenTelemetry's `span.recordException()` directly
- **PHP/Laravel**: Formats stack trace as `function at file:line` string
- **Status**: Node.js may need stack trace formatting for code discovery

### 3. **Error Handling**
- **Node.js**: Express error middleware with 4 parameters
- **Laravel**: Automatic via exception reporter
- **Result**: Both work, different approaches

### 4. **Variable Capture**
- **Node.js**: Uses JavaScript Error stack trace parsing
- **PHP**: Uses `debug_backtrace()`
- **Result**: Both extract file, line, function name

## Known Limitations

### 1. Code Discovery for Exceptions
- **Status**: ⚠️ Needs Verification
- **Issue**: OpenTelemetry's `recordException()` may not format stack traces in the format expected by code discovery
- **Solution**: May need to add `formatStackTrace()` and `exception.stacktrace` attribute like PHP/Laravel
- **Impact**: Exception stack traces might not be indexed for code discovery

### 2. Async Stack Traces
- **Status**: ⚠️ Minor Issue
- **Issue**: Async function stack traces may be truncated
- **Impact**: May not capture full call chain for deeply async code
- **Workaround**: Use labeled snapshots at key points

## Recommendations

### For Production Use

1. **Enable Code Monitoring Selectively**
   ```javascript
   enableCodeMonitoring: process.env.NODE_ENV === 'production'
   ```

2. **Use Meaningful Labels**
   ```javascript
   await client.captureSnapshot('payment-processing', { orderId, amount });
   ```

3. **Capture Key Variables**
   ```javascript
   await client.captureSnapshot('user-lookup', {
     userId,
     found: !!user,
     cacheHit: fromCache,
   });
   ```

4. **Test Breakpoints in Staging**
   - Create breakpoints in dashboard
   - Verify snapshot capture
   - Check variable contents
   - Disable before deploying to production

### For Code Discovery

1. **Add Stack Trace Formatting**
   - Implement `formatStackTrace()` in TracekitClient
   - Add `exception.stacktrace` attribute to exception events
   - Follow PHP/Laravel pattern

2. **Test Exception Discovery**
   - Trigger exceptions in test app
   - Verify code locations appear in dashboard
   - Check that file paths and line numbers are correct

## Next Steps

1. ✅ Create node-test app
2. ✅ Test basic tracing
3. ✅ Test code monitoring (snapshots)
4. ✅ Test exception handling
5. ⚠️ Add stack trace formatting for code discovery (if needed)
6. ⚠️ Verify code discovery in dashboard
7. ⚠️ Update Node.js APM documentation
8. ⚠️ Tag and release node-apm package (if changes needed)

## Conclusion

The Node.js test app successfully demonstrates all core features of the TraceKit Node.js APM:

- ✅ Automatic request tracing
- ✅ Code monitoring with snapshots
- ✅ Auto-registration of breakpoints
- ✅ Background polling
- ✅ Variable and context capture
- ✅ Exception handling

The only potential enhancement needed is stack trace formatting for code discovery, which should be verified by checking if exception stack traces appear in the TraceKit dashboard's Code Discovery section.

## Test Commands Reference

```bash
# Health check
curl http://localhost:8084/health

# Basic test
curl http://localhost:8084/test

# Users list
curl 'http://localhost:8084/users?limit=2'

# Checkout flow
curl -X POST http://localhost:8084/checkout \
  -H "Content-Type: application/json" \
  -d '{"userId":1,"amount":50,"userType":"premium"}'

# Error test
curl http://localhost:8084/error-test

# Exception test
curl http://localhost:8084/exception-test
```

## Log Output Sample

```
📸 TraceKit Snapshot Client started for service: node-test-app

🚀 Node.js Test App Started
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 Server:              http://localhost:8084
🔧 Service Name:        node-test-app
📊 TraceKit Endpoint:   https://api.tracekit.dev/v1/traces
📸 Code Monitoring:     ✅ ENABLED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📸 Updated breakpoint cache: 1 active breakpoints
```

