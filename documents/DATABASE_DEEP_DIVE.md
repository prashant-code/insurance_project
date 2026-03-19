# Database Deep-Dive: Optimization & Integrity

NexGen's data layer is optimized for high-density writes and ultra-fast retrieval of policy projections.

## 1. Schema Strategy

### Key Tables
- **`users`**: Secure storage of masked identity.
- **`illustration_requests`**: Tracks every request with a high-performance **UUIDv7**.
- **`illustration_results`**: Stores actual projection arrays using **JSONB**.

## 2. Why UUIDv7?
In a system handling millions of rows, traditional `Serial (1, 2, 3...)` IDs fail.
- **Scale**: Prevents primary key collisions across distributed nodes.
- **Performance**: UUIDv7 is **time-sortable**. Unlike UUIDv4 (random), UUIDv7 maintains index proximity, drastically improving `INSERT` performance on large tables.
- **Security**: Prevents "ID Enumeration" attacks (an attacker cannot guess valid IDs by adding +1).

## 3. JSONB vs Relational Normalization
We store the projection array as a `JSONB` column rather than splitting years into separate rows.
- **Speed**: A single `SELECT` retrieves the entire 50-year projection in one read.
- **Efficiency**: Reduces "Join" overhead and index size significantly when dealing with millions of records.
- **Flexibility**: Different products (Term, Life, Health) can store varying projection structures without schema migrations.

## 4. Query Optimization
1. **Partial Indexing**: We index `email` and `tracking_id` for instant lookups.
2. **Batch Inserts**: When processing bulk millions, the system groups writes into a single transaction to reduce Disk I/O.
3. **Optimized Aggregates**: Using PostgreSQL's robust window functions for statistics.

## 5. Interview Talking Points:
- **"Why not normalize projection years into rows?"**: Performance. At 50 years per policy, 1 million policies = 50 million rows. JSONB keeps the row count at 1 million, making indexing 50x more efficient.
- **"How do you ensure data integrity?"**: Strict foreign key constraints and standard JSON schema validation before DB insertion.
- **"How does UUIDv7 help with B-Tree indices?"**: Since they are sequential in time, new records are added to the end of the B-Tree, avoiding expensive "Page Splits" and fragmentation.
