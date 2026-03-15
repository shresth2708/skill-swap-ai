# Load Test Plan — Chat WebSocket (1000 Concurrent Connections)

## Overview

This document describes the strategy for load-testing the SkillSwap real-time chat system
under 1000 concurrent WebSocket connections, as required by Phase 4C.

---

## Tool: Artillery.io (with Socket.io Engine)

Artillery is the recommended load testing tool for Socket.io. It supports
the `socketio` engine natively and produces latency percentile metrics.

### Installation

```bash
npm install -g artillery@latest
npm install -g artillery-engine-socketio-v3
```

---

## Test Scenario: `artillery-chat-load.yml`

```yaml
config:
  target: "ws://localhost:5001"
  phases:
    - duration: 30       # Ramp-up
      arrivalRate: 10    # 10 new connections per second
    - duration: 120      # Sustained load
      arrivalRate: 0     # No new arrivals, hold existing
      maxVusers: 1000
  engines:
    socketio-v3:
      transports: ["websocket"]
      auth:
        token: "{{jwt}}"  # Provided via CSV or env

scenarios:
  - name: "Chat message exchange"
    engine: socketio-v3
    flow:
      # Join a swap room
      - emit:
          channel: "chat:join"
          data:
            swapId: "{{swapId}}"
      - think: 2

      # Send 10 messages over 60 seconds
      - loop:
        - emit:
            channel: "chat:message"
            data:
              swapId: "{{swapId}}"
              content: "Load test message {{$loopCount}}"
              msgType: "TEXT"
        - think: 6
        count: 10

      # Simulate read receipt
      - emit:
          channel: "chat:read"
          data:
            swapId: "{{swapId}}"

      # Leave
      - emit:
          channel: "chat:leave"
          data:
            swapId: "{{swapId}}"
```

### Running

```bash
artillery run artillery-chat-load.yml --output report.json
artillery report report.json
```

---

## Key Metrics to Measure

| Metric                | Target         | Description                                         |
|-----------------------|----------------|-----------------------------------------------------|
| **Latency p50**       | < 50ms         | Median round-trip for a chat:message emit → receive  |
| **Latency p95**       | < 200ms        | 95th percentile latency                             |
| **Latency p99**       | < 500ms        | 99th percentile, catches outliers                   |
| **Message Loss Rate** | 0%             | Every sent message must be received by room members  |
| **Connection Rate**   | 1000 sustained | All connections maintained without drops             |
| **Error Rate**        | < 0.1%         | Server-side errors (chat:error emissions)            |
| **CPU Usage**         | < 80%          | Node.js process CPU under load                      |
| **Memory (RSS)**      | < 512MB        | Resident set size for the Node process              |

---

## Infrastructure Requirements

- **Horizontal Scaling**: Redis adapter is required. Run at minimum 2 Node.js
  processes behind a load balancer with sticky sessions (or use the Redis adapter
  which eliminates the need for sticky sessions).

- **Redis**: A dedicated Redis instance for the pub/sub adapter and presence keys.
  Recommended: Redis 7+ with `maxmemory-policy allkeys-lru`.

- **Load Balancer**: Nginx with `proxy_set_header Upgrade $http_upgrade` and
  `proxy_set_header Connection "upgrade"` for WebSocket passthrough.

---

## Monitoring During Test

```bash
# Node.js process stats
node --inspect server.js  # Connect Chrome DevTools

# Redis pub/sub channel activity
redis-cli monitor | grep "skillswap"

# System resources
htop  # or: docker stats
```

---

## Expected Bottlenecks

1. **Database writes**: Each `chat:message` triggers a Prisma `message.create`.
   At 1000 users × 10 msgs/min = ~166 writes/sec.
   **Mitigation**: Connection pooling (`connection_limit` in DATABASE_URL),
   write batching for read receipts.

2. **Redis pub/sub fan-out**: With the Redis adapter, every message is
   published to Redis and consumed by all Node processes.
   **Mitigation**: Keep message payloads small (serialized, no Prisma objects).

3. **Memory from typing timeouts**: The in-memory `typingMap` grows with
   active typers. At 1000 concurrent, worst case = 1000 active timeout handles.
   **Mitigation**: Already bounded by 5s auto-clear.

---

## Pass/Fail Criteria

- ✅ **PASS**: p95 < 200ms, 0% message loss, 0 dropped connections over 2 min sustained
- ❌ **FAIL**: p95 > 500ms OR message loss > 0.5% OR > 5 dropped connections
