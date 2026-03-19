CREATE TABLE users (
    id UUID PRIMARY KEY, -- Application generated UUIDv7
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

CREATE TABLE products (
    id UUID PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE illustration_requests (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    product_id UUID REFERENCES products(id),
    batch_id UUID, -- Crucial for bulk upload tracking
    age INTEGER,
    policy_term INTEGER,
    premium_payment_term INTEGER,
    premium_amount NUMERIC(15, 2),
    status VARCHAR(50) DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- High-performance batch indexing
CREATE INDEX idx_requests_status ON illustration_requests(status);
CREATE INDEX idx_requests_batch ON illustration_requests(batch_id);
CREATE INDEX idx_requests_user ON illustration_requests(user_id);

CREATE TABLE illustration_results (
    id UUID PRIMARY KEY,
    request_id UUID UNIQUE REFERENCES illustration_requests(id) ON DELETE CASCADE,
    projected_benefits JSONB NOT NULL,
    errors JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed initial valid product to ensure calculations operate seamlessly
INSERT INTO products (id, code, name, is_active) 
VALUES ('00000000-0000-0000-0000-000000000000', 'TL_DEFAULT', 'Standard Term Life', TRUE);

-- Additional products for multi-product support
INSERT INTO products (id, code, name, is_active)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'EP_CLASSIC',  'Endowment Plan Classic',   TRUE),
  ('22222222-2222-2222-2222-222222222222', 'MB_20',        'Money Back Plan (20yr)',    TRUE),
  ('33333333-3333-3333-3333-333333333333', 'ULIP_GROWTH',  'ULIP Growth Fund',         TRUE);
