# 🔴 Redis Deep Dive — NexGen Benefit Illustration Suite

> **Purpose:** Understand exactly how Redis works in this project today, how it grows when we scale, and how Redis Sentinel handles failures — all with concrete real-world examples.

---

## Table of Contents

1. [What is Redis and Why We Use It](#1-what-is-redis-and-why-we-use-it)
2. [How Redis is Used in THIS Project](#2-how-redis-is-used-in-this-project)
   - [Rate Limiting — Token Bucket](#21-rate-limiting--token-bucket-algorithm)
   - [Pub/Sub — Async Batch Jobs](#22-pubsub--async-batch-job-queue)
3. [Scaling Redis — Stage by Stage](#3-scaling-redis--stage-by-stage)
4. [Redis Sentinel — Deep Dive](#4-redis-sentinel--deep-dive)
   - [What is Sentinel?](#41-what-is-sentinel)
   - [How Failover Works Step by Step](#42-how-failover-works-step-by-step)
   - [Real Failure Cases with Examples](#43-real-failure-cases-with-examples)
5. [Redis Streams — The Production Upgrade](#5-redis-streams--the-production-upgrade)
6. [Quick Reference Cheat Sheet](#6-quick-reference-cheat-sheet)

---

## 1. What is Redis and Why We Use It

Redis = **Re**mote **Di**ctionary **S**erver.

Think of it as a **super-fast in-memory key-value store** that lives between your Node.js app and PostgreSQL.

```
User Request
    ↓
Node.js API
    ↓
  Redis ← (microseconds, lives in RAM)
    ↓
PostgreSQL ← (milliseconds, lives on disk)
```

**Why not just use PostgreSQL for everything?**

| Task | PostgreSQL | Redis |
|---|---|---|
| Rate limiting (check every request) | ~5–10ms per query | ~0.1ms (in-memory) |
| Message queue for batch jobs | Polling every second wastes CPU | Instant Pub/Sub push |
| Session storage | Full disk I/O | RAM lookup |

For rate limiting, your API might get **1,000+ requests/second**. A PostgreSQL query per request = **5–10 seconds of DB load per second**. Redis does the same in **0.1ms per request** — 50–100x faster.

---

## 2. How Redis is Used in THIS Project

### 2.1 Rate Limiting — Token Bucket Algorithm

**File:** `backend/utils/redis.js` → `rateLimiterMiddleware`

#### The Concept — Token Bucket

Imagine each IP address has a **bucket of tokens**:
- Bucket capacity: **50 tokens**
- Refill rate: **5 tokens per second**
- Each request costs **1 token**

```
IP: 103.21.10.5
Bucket: [🪙🪙🪙🪙🪙🪙🪙🪙🪙🪙] ← 50 tokens full

Request 1 → takes 1 token → 49 remaining ✅
Request 2 → takes 1 token → 48 remaining ✅
...
Request 50 → takes 1 token → 0 remaining ✅
Request 51 → 0 tokens → 429 Too Many Requests ❌

[1 second passes → +5 tokens refilled]

Request 52 → 5 tokens → takes 1 → 4 remaining ✅
```

#### What the Code Does

```javascript
// In redis.js — a Lua script runs INSIDE Redis atomically
const LUA_TOKEN_BUCKET = `
  local bucket = redis.call("HMGET", key, "tokens", "last_refill")
  local tokens = tonumber(bucket[1])
  local last_refill = tonumber(bucket[2])

  -- If new IP, initialize bucket to full capacity
  if not tokens then
    tokens = capacity       -- 50 tokens
    last_refill = now
  else
    -- Refill based on how much time has elapsed
    local elapsed = now - last_refill
    tokens = math.min(capacity, tokens + (elapsed * refill_rate))
    last_refill = now
  end

  -- Deduct 1 token if available
  if tokens >= 1 then
    tokens = tokens - 1
    redis.call("HMSET", key, ...)
    return {1, tokens}  -- ALLOWED
  else
    return {0, tokens}  -- BLOCKED
  end
`
```

**Why Lua script?** Lua runs as a single atomic operation inside Redis — **no race condition**. 

Without Lua, this could happen:
```
Worker A reads tokens = 1
Worker B reads tokens = 1       ← both read at same time!
Worker A deducts → writes 0
Worker B deducts → writes 0
Result: 2 requests went through with 1 token!  ← BUG
```

With Lua: the entire read-modify-write happens in one uninterruptible step.

#### What Gets Stored in Redis

```
Key:   "ratelimit:103.21.10.5"
Value: { tokens: 47, last_refill: 1742395200 }
Type:  Hash (HMSET/HMGET)
TTL:   Auto-expires after (capacity / refill_rate) = 10 seconds of inactivity
```

---

### 2.2 Pub/Sub — Async Batch Job Queue

**Files:** `utils/redis.js` → `workers/calculationWorker.js`

#### The Problem It Solves

A user uploads a CSV with **10,000 insurance policies** to calculate. Each calculation takes ~5ms. 

```
10,000 rows × 5ms = 50 seconds
```

If we process synchronously, the user's browser **times out** waiting for a 50-second HTTP response.

#### The Solution — Pub/Sub

```
[User uploads CSV]
        ↓
API writes 10,000 rows to DB with status = 'PENDING'
        ↓
API publishes ONE message to Redis:
    PUBLISH BATCH_JOBS '{"batch_id": "018e1a2b-..."}'
        ↓
API responds to user INSTANTLY: { batch_id: "018e1a2b-..." }
        ↓
[User polls GET /api/bulk/018e1a2b.../results every 2 seconds]

                    [Meanwhile, in background...]
        ↓
Worker (subscribed to BATCH_JOBS channel) receives message
        ↓
Worker queries DB: SELECT * FROM illustration_requests WHERE batch_id = ?
        ↓
Worker runs calculateBenefits() for all 10,000 rows concurrently (Promise.allSettled)
        ↓
Worker updates status = 'COMPLETED' per row
        ↓
User's next poll sees: 10,000/10,000 completed ✅
```

#### The Three Redis Connections

```javascript
// From redis.js:
export const redisClient     = createClient(...);   // For rate limiting
export const redisPublisher  = redisClient.duplicate(); // For PUBLISH
export const redisSubscriber = redisClient.duplicate(); // For SUBSCRIBE
```

**Why 3 connections?** Redis has a strict rule:
> Once a connection enters SUBSCRIBE mode, it can ONLY receive messages. It cannot run any other Redis commands (like HMGET for rate limiting).

So we need **dedicated** connections for publisher and subscriber, separate from the general-purpose client.

```
redisClient     ──► HMGET/HMSET (rate limiting)
redisPublisher  ──► PUBLISH BATCH_JOBS {...}
redisSubscriber ──► SUBSCRIBE BATCH_JOBS (blocked, waiting)
```

#### Real Message Flow — Code Trace

```javascript
// 1. API Route (bulk upload handler)
await redisPublisher.publish('BATCH_JOBS', JSON.stringify({ batch_id }));
// This fires and the API immediately moves on

// 2. Worker (calculationWorker.js)
await redisSubscriber.subscribe('BATCH_JOBS', async (message) => {
  const { batch_id } = JSON.parse(message);
  
  // Fetch rows from PostgreSQL
  const { rows } = await db.query(`
    SELECT * FROM illustration_requests 
    WHERE batch_id = $1 AND status = 'PENDING'
  `, [batch_id]);

  // Process all rows concurrently — partial failures don't kill the batch
  const results = await Promise.allSettled(
    rows.map(async (req) => {
      const benefits = calculateBenefits(req.age, req.policy_term, ...);
      await db.query(`INSERT INTO illustration_results ...`, [...]);
      await db.query(`UPDATE illustration_requests SET status='COMPLETED' ...`);
    })
  );
});
```

---

## 3. Scaling Redis — Stage by Stage

### 📍 Stage 1: Current (Single Node)

```
┌─────────────────────────────┐
│      Redis (Single)         │
│  - Rate limit keys          │
│  - BATCH_JOBS channel       │
│  Port: 6379                 │
└─────────────────────────────┘
```

**Good for:** Up to ~50,000 requests/day, a few hundred concurrent users.  
**Risk:** Redis goes down → rate limiting disabled, batch jobs lost.

---

### 📍 Stage 2: Redis Sentinel (High Availability)

**When to upgrade:** Redis downtime is unacceptable. You have paying users.

```
┌─────────────────────────────────────────────┐
│              Redis Sentinel Setup           │
│                                             │
│   Redis Master ──────────────────────────┐  │
│        │           replicates →          │  │
│   Redis Replica 1                        │  │
│   Redis Replica 2 (hot standby)          │  │
│                                          │  │
│   Sentinel 1  ──── monitors ────────────┘  │
│   Sentinel 2  ──── votes                   │
│   Sentinel 3  ──── elects new master       │
└─────────────────────────────────────────────┘
```

We cover this in detail in [Section 4](#4-redis-sentinel--deep-dive).

---

### 📍 Stage 3: Redis Cluster (Horizontal Sharding)

**When to upgrade:** Your dataset is too large for one server's RAM, or you need extreme throughput.

```
         Hash Slots 0–16383 split across 3 shards:

Shard A: Slots 0–5460        Shard B: Slots 5461–10922     Shard C: Slots 10923–16383
┌────────────────┐           ┌────────────────┐            ┌────────────────┐
│ Master A       │           │ Master B       │            │ Master C       │
│ Replica A      │           │ Replica B      │            │ Replica C      │
└────────────────┘           └────────────────┘            └────────────────┘
```

**How a key is routed:**
```
Key: "ratelimit:103.21.10.5"
  → CRC16 hash of key = 7823
  → Slot 7823 → falls between 5461–10922 → goes to Shard B
```

**Important:** With Redis Cluster, Pub/Sub has limitations — you should **upgrade to Redis Streams** (see Section 5).

---

## 4. Redis Sentinel — Deep Dive

### 4.1 What is Sentinel?

Redis Sentinel is a **separate process** (not part of your app) that:
1. **Monitors** — constantly pings the Redis master and replicas
2. **Notifies** — alerts you if something goes wrong
3. **Elects** — runs a vote to choose a new master when the old one dies
4. **Reconfigures** — updates all clients with the new master address

You run **at least 3 Sentinels** (always odd number) to prevent "split brain" — where two halves of a network each think they should be master.

### 4.2 How Failover Works Step by Step

#### Normal State

```
App (Node.js)
    │
    ▼
Redis Master (192.168.1.10:6379)   ◄─── Sentinel 1, 2, 3 monitoring (PING every 1s)
    │
    ├──► Replica 1 (192.168.1.11:6379)  [replicating master]
    └──► Replica 2 (192.168.1.12:6379)  [replicating master]
```

#### Failure Detected

```
Time 0s:   Master stops responding to PINGs

Time 1s:   Sentinel 1 marks master as "SDOWN" (Subjectively Down)
           → "I can't reach it, but let me check with others"

Time 1s:   Sentinel 2 also can't reach master → SDOWN
Time 1s:   Sentinel 3 also can't reach master → SDOWN

Time 2s:   Sentinels exchange notes:
           "Is it down for you too?"
           Sentinel 1: YES
           Sentinel 2: YES  ← majority (2/3) agree
           → Master declared "ODOWN" (Objectively Down) ← real failure confirmed
```

> The 2-step (SDOWN → ODOWN) process protects against **network partitions** where only Sentinel 1 loses connection to master, but master is actually fine.

#### Election — Who Becomes New Master?

```
Sentinels vote among themselves for who runs the election:
  Sentinel 1 nominates itself → gets vote from Sentinel 2 → wins election

Sentinel 1 picks the best replica based on:
  1. Replica with lowest replication lag (most up-to-date data)
  2. Replica with highest priority config
  3. Replica with lowest run ID (tiebreaker)

→ Replica 1 (192.168.1.11) elected as new master
```

#### Failover Execution

```
Time 3s:  Sentinel 1 sends to Replica 1:
          REPLICAOF NO ONE  ← promoted to master!

Time 3s:  Sentinel 1 sends to Replica 2:
          REPLICAOF 192.168.1.11 6379  ← now replicating the new master

Time 4s:  Sentinel broadcasts to all clients:
          "+switch-master nexgen-redis 192.168.1.10 6379 → 192.168.1.11 6379"

Time 4s:  Node.js client (ioredis with Sentinel support) reconnects to new master
          Your app continues working — users see nothing
```

**Total time: ~4–15 seconds** (configurable via `down-after-milliseconds`).

---

### 4.3 Real Failure Cases with Examples

---

#### ⚡ Failure Case 1: Master Server Crashes (Hardware Failure)

**Scenario:** The VM running Redis master has a kernel panic and powers off completely.

```
Timeline:
00:00  Master is running normally
00:01  VM crashes — Redis master process killed
00:02  Sentinels stop getting PONG responses
00:03  All 3 Sentinels mark master SDOWN
00:04  Quorum reached → ODOWN declared
00:05  Sentinel leader elected
00:06  Replica 1 promoted to master
00:07  Replica 2 told to replicate new master
00:08  Node.js app reconnects to 192.168.1.11:6379

What happened to in-flight requests?
  - Rate limit checks during 00:01–00:08 → "Fail-open" → allowed through (our config, line 78)
  - Pub/Sub messages published during 00:01–00:08 → LOST (Pub/Sub limitation)
  - After 00:08 → everything works normally again

Data loss: lastly synced replica data (usually < 1 second of writes = < 50 rate-limit updates)
```

---

#### ⚡ Failure Case 2: Network Partition (Split Brain Scenario)

**Scenario:** A network switch fails. Sentinel 1 + Replica 1 are on one side. Sentinel 2 + Sentinel 3 + Master + Replica 2 are on the other side.

```
Side A (isolated):           Side B (majority):
  Sentinel 1                   Sentinel 2
  Replica 1                    Sentinel 3
                               Master
                               Replica 2

Side A thinks:                 Side B thinks:
  "Master is unreachable"        "Everything is fine"
  → Sentinel 1 sees SDOWN

Side A tries to declare ODOWN:
  Needs 2/3 sentinels to agree
  → Only has 1/3 (itself)
  → CANNOT declare ODOWN ← protection working!
  → No false failover ✅

Network heals at t+30s:
  → Everything reconnects normally
  → No change in master
```

**This is why you need 3 Sentinels (odd number)** — the minority can never reach quorum alone.

---

#### ⚡ Failure Case 3: Sentinel Process Crashes (not Redis)

**Scenario:** Sentinel 1's server has a disk issue. Sentinel process exits.

```
Before: 3 Sentinels monitoring
After:  2 Sentinels monitoring

Impact:
  - Monitoring continues ✅ (2 sentinels still have quorum for a 3-node setup with quorum=2)
  - If master crashes NOW: can still get 2/3 votes → failover works ✅
  - Recommended: fix/restart Sentinel 1 quickly
  - Running with 1 sentinel: has quorum issues → fix immediately
```

---

#### ⚡ Failure Case 4: Slow Replication Lag (Data Inconsistency Risk)

**Scenario:** Network between master and Replica 2 is slow. Replica 2 is 10 seconds behind master.

```
Master has: { batch_id: "abc", tokens: 45 }
Replica 2 has: { batch_id: "abc", tokens: 50 }   ← 10 seconds stale

IF master fails NOW and Replica 2 is elected:
  - All in-flight rate limit changes in last 10s are LOST
  - Tokens reset to stale values → some IPs get extra tokens briefly
  - No batch job data lost (batch rows are in PostgreSQL, not Redis)
```

**Protection:** Configure `min-replicas-to-write 1` and `min-replicas-max-lag 10` on master:
```bash
# Master refuses WRITE commands if no replica is within 10 seconds of lag
# Forces at least 1 replica to be healthy before accepting writes
min-replicas-to-write 1
min-replicas-max-lag 10
```

---

#### ⚡ Failure Case 5: Worker Down During Pub/Sub (Message Loss)

**Scenario:** Your calculation worker crashes. A CSV upload happens while it's down.

```
t=0:  User uploads 10,000 row CSV
t=0:  API writes rows to DB (status=PENDING) ✅
t=0:  API publishes to BATCH_JOBS channel

t=0:  Redis sends message to channel... but NO subscriber is listening!
      Message is DROPPED FOREVER ← Pub/Sub limitation

t=5:  Worker restarts, subscribes to BATCH_JOBS
      But the message from t=0 is gone...

Result: 10,000 rows stuck in PENDING forever ❌
```

**Fix: Recovery Query** — on worker startup, check for orphaned jobs:
```javascript
// Add this to startWorker() — already partially in the code
const orphanedBatches = await db.query(`
  SELECT DISTINCT batch_id FROM illustration_requests 
  WHERE status = 'PENDING' 
  AND created_at < NOW() - INTERVAL '2 minutes'
`);

// Process any orphaned batches manually
for (const { batch_id } of orphanedBatches.rows) {
  await processaBatch(batch_id);
}
```

**Better Fix (production):** Upgrade to **Redis Streams** (see Section 5) — messages are persisted.

---

## 5. Redis Streams — The Production Upgrade

Redis Streams are like Pub/Sub but with **message persistence and delivery guarantees**.

```
                            Redis Stream: "BATCH_JOBS_STREAM"
                            ┌──────────────────────────────────┐
API  ──XADD──►             │ 1742395200-0: { batch_id: "aaa" }│
                            │ 1742395210-0: { batch_id: "bbb" }│
                            │ 1742395220-0: { batch_id: "ccc" }│
                            └──────────────────────────────────┘
                                          │
                            Worker Group: "calculators"
                                   │
                          XREADGROUP (blocks until new message)
                                   │
                          Worker reads "bbb" → processes
                          XACK → marks "bbb" as done ✅

If worker crashes during "bbb":
  Message stays in "pending" list
  New worker instance auto-picks up pending messages ← crash recovery!
```

### Code Change to Use Streams (Future Upgrade)

```javascript
// PRODUCER (API route) — instead of PUBLISH:
await redisPublisher.xAdd('BATCH_JOBS_STREAM', '*', { batch_id });

// CONSUMER (worker) — instead of SUBSCRIBE:
// 1. Create consumer group once:
await redisSubscriber.xGroupCreate('BATCH_JOBS_STREAM', 'calculators', '0', { MKSTREAM: true });

// 2. Read messages (blocks waiting):
const messages = await redisSubscriber.xReadGroup(
  'calculators', 'worker-1',
  [{ key: 'BATCH_JOBS_STREAM', id: '>' }],  // '>' = only new messages
  { COUNT: 1, BLOCK: 5000 }
);

// 3. Process and acknowledge:
const [{ id, message }] = messages[0].messages;
await processaBatch(message.batch_id);
await redisSubscriber.xAck('BATCH_JOBS_STREAM', 'calculators', id);  // ← now safe to remove
```

---

## 6. Quick Reference Cheat Sheet

### Redis Usage in This Project

| Feature | Redis Key/Channel | Type | TTL |
|---|---|---|---|
| Rate limiting per IP | `ratelimit:103.21.10.5` | Hash | ~10s (auto) |
| Batch job queue | `BATCH_JOBS` | Pub/Sub channel | None (volatile) |

### Redis Sentinel Config (Example `sentinel.conf`)

```bash
# Monitor a master called "nexgen-redis"
sentinel monitor nexgen-redis 192.168.1.10 6379 2   # quorum = 2

# Declare SDOWN after 5 seconds of no response
sentinel down-after-milliseconds nexgen-redis 5000

# New master can have 1 replica syncing at a time (parallel resync)
sentinel parallel-syncs nexgen-redis 1

# Failover must complete within 3 minutes
sentinel failover-timeout nexgen-redis 180000
```

### Node.js Connection with Sentinel

```javascript
import { createClient } from 'redis';

const client = createClient({
  sentinels: [
    { host: '192.168.1.20', port: 26379 },  // Sentinel 1
    { host: '192.168.1.21', port: 26379 },  // Sentinel 2
    { host: '192.168.1.22', port: 26379 },  // Sentinel 3
  ],
  name: 'nexgen-redis',   // master name from sentinel.conf
  password: process.env.REDIS_PASSWORD,
});
// Client auto-discovers master, auto-reconnects on failover
```

### When to Use What

| Situation | Solution |
|---|---|
| Single server, < 100k req/day | Single Redis node (current) |
| High availability needed | Redis Sentinel (3 nodes) |
| Need horizontal scale / huge data | Redis Cluster (6+ nodes) |
| Pub/Sub + crash recovery needed | Redis Streams |
| Rate limiting in cluster | Redis Cluster (hash slots work fine) |

---

*© 2026 NexGen Financial Technologies — Internal Learning Document*
