# SQL Reference Guide — NexGen Benefit Illustration Engine

This document explains every SQL query and table used in the application, **why** each design decision was made, and the performance implications.

---

## 📐 Schema Overview

```
users  ──────────┐
                 │ FK: user_id
products ────────┤
                 ▼
        illustration_requests  ──── FK: batch_id (self-grouping)
                 │ FK: request_id
                 ▼
        illustration_results   (stores JSONB projection matrix)
```

---

## 📋 Tables

### 1. `users`

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    dob VARCHAR(255),
    mobile_number VARCHAR(255),
    role VARCHAR(50) DEFAULT 'CUSTOMER',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_users_email ON users(email);
```

**Why `UUID PRIMARY KEY`?**
UUIDv7 is used (via `uuidv7` npm package) instead of `SERIAL INTEGER`. This enables:
- Globally unique IDs that can be generated in the application layer without a DB round-trip
- Chronologically sortable (UUIDv7 embeds timestamp in the first 48 bits)
- Safe for distributed/sharded databases (YugabyteDB)

**Why `VARCHAR(255)` for PII fields instead of exact types?**
`dob`, `first_name`, `last_name`, and `mobile_number` are stored as VARCHAR because they are **masked at write time** using `utils/encryption.js`. The actual values are obfuscated (e.g., `J***` for names, `****7890` for phone), so fixed-type constraints like `DATE` would break after masking.

**Why `CREATE INDEX idx_users_email`?**
Login queries filter `WHERE email = $1`. Without an index, this would be a full table scan — O(n). With a B-tree index, login lookup is O(log n), critical for high-traffic authentication.

---

### 2. `products`

```sql
CREATE TABLE products (
    id UUID PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE
);

INSERT INTO products (id, code, name, is_active)
VALUES ('00000000-0000-0000-0000-000000000000', 'TL_DEFAULT', 'Standard Term Life', TRUE);
```

**Why a `products` table?**
Rather than hardcoding product logic in every API call, the `products` table provides a single source of truth for what insurance products are valid and active. The calculation endpoint validates `product_id` against this table before running any math:

```sql
SELECT id FROM products WHERE id = $1 AND is_active = TRUE
```

**Why a seeded row with `00000000-0000-0000-0000-000000000000`?**
This zero-UUID is the demo product used in all test requests and the frontend form. It avoids the need to generate a real UUID for the demo environment while keeping the referential integrity constraint intact.

**Why `is_active BOOLEAN`?**
Products can be retired without deleting them. Historical calculation requests that referenced an old product still have valid foreign keys. The `is_active` flag allows soft-deactivating products in the future.

---

### 3. `illustration_requests`

```sql
CREATE TABLE illustration_requests (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    product_id UUID REFERENCES products(id),
    batch_id UUID,
    age INTEGER,
    policy_term INTEGER,
    premium_payment_term INTEGER,
    premium_amount NUMERIC(15, 2),
    status VARCHAR(50) DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_requests_status ON illustration_requests(status);
CREATE INDEX idx_requests_batch  ON illustration_requests(batch_id);
CREATE INDEX idx_requests_user   ON illustration_requests(user_id);
```

**Why `NUMERIC(15, 2)` for `premium_amount`?**
`NUMERIC` / `DECIMAL` stores exact decimal values with no floating-point rounding errors. For financial amounts like ₹50,000.00 this is mandatory. `FLOAT` would introduce tiny rounding errors that compound over 30-year projection calculations.

**Why `batch_id UUID` (nullable)?**
A single `batch_id` groups all rows belonging to one bulk upload. For individual calculations this column is `NULL`. This design avoids a separate `batches` table while still allowing:
- `WHERE batch_id = $1` to fetch all requests in a batch
- Workers to claim and process an entire batch with one query

**Why three indexes?**

| Index | Query Pattern | Benefit |
|---|---|---|
| `idx_requests_status` | Worker: `WHERE status = 'PENDING'` | Fast O(log n) scan for pending work |
| `idx_requests_batch` | API: `WHERE batch_id = $1` | Instant batch result retrieval |
| `idx_requests_user` | API: `WHERE user_id = $2` | Multi-tenant data isolation |

**Why `status DEFAULT 'PENDING'`?**
All requests start as `PENDING`. The background Redis worker sets them to `COMPLETED` after persisting results. This is the backbone of the async processing pipeline — the UI polls for completion using this field.

---

### 4. `illustration_results`

```sql
CREATE TABLE illustration_results (
    id UUID PRIMARY KEY,
    request_id UUID UNIQUE REFERENCES illustration_requests(id) ON DELETE CASCADE,
    projected_benefits JSONB NOT NULL,
    errors JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Why `JSONB` instead of a normalized projection table?**
The year-by-year projection has a variable number of rows (policy_term years). A normalized approach would require a 3rd-level table (`projection_rows`) with potentially millions of rows for bulk uploads. JSONB keeps the entire projection structure in one row per request, enabling:
- Single query to retrieve any policy's full projection
- No JOIN required between projection rows
- Efficient partial reads using PostgreSQL JSONB operators (`->`, `->>`, `@>`)

**Why `ON DELETE CASCADE`?**
If an `illustration_request` is deleted, its `illustration_result` is automatically purged. This prevents orphaned result rows and maintains referential integrity without requiring application-level cleanup code.

**Why `UNIQUE` on `request_id`?**
Each request produces exactly one result. `UNIQUE` enforces this at the database level, preventing duplicate result rows if a worker processes the same job twice (idempotency guarantee).

---

## 🔍 Key Application Queries

### Authentication — Login

```sql
SELECT id, email, password_hash, role
FROM users
WHERE email = $1;
```

**Why:** Fetches credentials for bcrypt comparison. Only selecting necessary columns — never `SELECT *` to avoid exposing all PII fields.

---

### Calculate — Single Policy (Individual Mode)

```sql
-- 1. Validate product
SELECT id FROM products WHERE id = $1 AND is_active = TRUE;

-- 2. Persist request for audit
INSERT INTO illustration_requests (id, user_id, product_id, age, policy_term, premium_payment_term, premium_amount, status)
VALUES ($1, $2, $3, $4, $5, $6, $7, 'COMPLETED');

-- 3. Persist result as JSONB
INSERT INTO illustration_results (id, request_id, projected_benefits)
VALUES ($1, $2, $3);
```

**Why the 2-step INSERT (request → result)?**  
It creates a complete audit trail. Every projection is traceable back to who requested it (`user_id`), when, and with what parameters — critical for compliance in the insurance domain.

---

### Bulk Upload — Batch Ingestion

```sql
-- Repeated N times concurrently via Promise.allSettled
INSERT INTO illustration_requests (id, user_id, product_id, batch_id, age, policy_term, premium_payment_term, premium_amount, status)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PENDING');
```

**Why `Promise.allSettled` and not a single multi-row INSERT?**  
Each row is a separate Promise so individual row failures don't block other rows. `allSettled` waits for all, counts failures, and logs them — enabling partial success for large batches. A multi-row INSERT would fail the entire batch if even one row is invalid.

---

### Bulk Worker — Fetch Pending Tasks

```sql
SELECT * FROM illustration_requests
WHERE batch_id = $1 AND status = 'PENDING';
```

**Why:** The worker fetches only PENDING rows for this batch, performs math calculations, then writes results. The `idx_requests_batch` index makes this instant even for 10,000-row batches.

---

### Bulk Worker — Mark Complete

```sql
UPDATE illustration_requests SET status = 'COMPLETED' WHERE id = $1;
```

**Why individual UPDATE vs batch UPDATE?**  
Each row is updated independently inside `Promise.allSettled`. If one calculation fails, other rows are not rolled back — partial completion is valid. The UI shows each row's status individually.

---

### Bulk Results Retrieval (LEFT JOIN)

```sql
SELECT
  r.id as request_id,
  r.product_id,
  r.age,
  r.policy_term,
  r.premium_amount,
  r.status,
  res.projected_benefits
FROM illustration_requests r
LEFT JOIN illustration_results res ON r.id = res.request_id
WHERE r.batch_id = $1 AND r.user_id = $2;
```

**Why `LEFT JOIN` instead of `INNER JOIN`?**  
`LEFT JOIN` returns all requests even if their result is not yet ready (still `PENDING`). This lets the UI show partially-processed batches with `null` projected_benefits for pending rows. `INNER JOIN` would hide pending rows entirely.

**Why `r.user_id = $2` security filter?**  
Multi-tenant isolation. Users can only fetch results for their own batches. Without this filter, any authenticated user could read another user's financial projections.

---

### User Profile — Authenticated GET /me

```sql
SELECT id, email, role, first_name, last_name, dob, mobile_number
FROM users
WHERE id = $1;
```

**Why not `SELECT *`?**  
`password_hash` is excluded. `SELECT *` would expose the bcrypt hash over the API response, creating a security vulnerability even though it's hashed.

---

## ⚡ Performance Summary

| Concern | Approach |
|---|---|
| Financial precision | `NUMERIC(15,2)` — no float rounding |
| Fast login | `idx_users_email` B-tree index |
| Fast batch queries | `idx_requests_batch` index |
| Fast worker polling | `idx_requests_status` index |
| Audit trail | Every request persisted with user_id + timestamp |
| Concurrent inserts | `Promise.allSettled` — parallel, non-blocking |
| Variable-length results | `JSONB` projected_benefits — no schema lock-in |
| Multi-tenant security | Always filter `WHERE user_id = $N` |
| Cascade cleanup | `ON DELETE CASCADE` on illustration_results |
