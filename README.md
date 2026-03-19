# Benefit Illustration Module

This project contains a highly scalable, secure Node.js backend and a React frontend for the Benefit Illustration calculation module. It is designed to evaluate policy logic, handle bulk illustration generation, and ensure data sensitivity protocols are followed.

## Prerequisites
- **Node.js**: v18 or later
- **Database**: PostgreSQL (or YugabyteDB)
- **Message Broker & Cache**: Redis
- **Docker**: For production deployment, Prometheus, and Grafana.

## Project Setup

1. **Install Dependencies**
   Navigate to the `backend` and `frontend` directories and install dependencies:
   ```bash
   cd backend
   npm install

   cd ../frontend
   npm install
   ```

2. **Environment Variables**
   In the `backend` directory, there is an `.env.example` file. Copy it to `.env` and fill in your sensitive credentials like DB passwords, Redis connection string, and JWT Secret:
   ```bash
   # From the backend directory
   cp .env.example .env
   ```

## Running the Application Locally (Development Environment)

For local development, we use `nodemon` to automatically restart the server when file changes are detected.

1. **Start the Backend server with Nodemon**
   Open a terminal in the `backend` directory and run:
   ```bash
   npm run dev
   ```
   *Note: Ensure your PostgreSQL and Redis instances are running locally or via Docker before starting the server.*

2. **Start the Frontend Development Server**
   Open a terminal in the `frontend` directory and run:
   ```bash
   npm run dev
   ```

## Running for Production

For a production environment, you should avoid using `nodemon`. The project uses a multi-container Docker compose setup to run the Database, Redis, the Node.js API, Background Workers, Prometheus, and Grafana.

### Using Lightweight Multi-Stage Docker Build (Recommended)

To compile the proprietary codebase into an obfuscated artifact and spin up the Alpine multi-stage stack, run the powerful build script provided:

```bash
# Set execution permissions if you haven't natively
chmod +x mkdocker.sh

# Run the full build with optional custom tags (api-tag, ui-tag)
./mkdocker.sh benefit-api:v2 benefit-ui:v2
```

You can then run the built images using standard Docker run commands, or use the provided `docker-compose.yml` to automatically orchestrate the PostgeSQL, PgBouncer, Redis, Graphing, API, and UI containers:
```bash
cd backend
docker-compose up -d
```

### Running Node.js directly in Production

If you are not using Docker for the Node process (e.g., using PM2 or deploying to a PaaS):
```bash
# Set NODE_ENV to production
export NODE_ENV=production

# Start the application using regular node
npm start
```
*If deploying the React frontend, run `npm run build` in the `frontend` directory and serve the `dist` folder.*

## Documentation
Please check the `documents/` folder for Architecture, Schema, OpenAPI specs, Grafana dashboard configuration, and Security best practices.
