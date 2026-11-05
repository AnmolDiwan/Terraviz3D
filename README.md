# TerraViz 3D — Geospatial Intelligence Platform

TerraViz 3D is a full-stack, cloud-native geospatial intelligence platform deployed on Amazon Web Services (AWS) and served globally through Cloudflare. The platform renders an interactive, hardware-accelerated 3D globe in the browser, visualizes real-time global seismic feeds and demographic data, and features a specialized Graph-RAG AI assistant that interprets geospatial activity and guides user exploration.

The infrastructure is fully automated using Terraform (Infrastructure as Code) following multi-tier, zero-trust cloud architecture principles.

- **Live URL:** https://terraviz.anmolcloud.in
- **Cloud Provider:** Amazon Web Services (AWS)
- **Deployment Region:** us-east-1 (High Availability across 2 Availability Zones)
- **Edge Routing & CDN:** Cloudflare

---

## Architecture Diagram

```
                                [ Internet Clients ]
                                          │
                                          ▼
                               ┌──────────────────────┐
                               │    Cloudflare Edge   │
                               │  DNS, CDN, Full TLS  │
                               └──────────┬───────────┘
                                          │
                                          ▼
                         ┌──────────────────────────────────┐
                         │      AWS WAFv2 WebACL Rules      │
                         │  Common, SQLi, BadInputs, Limits │
                         └────────────────┬─────────────────┘
                                          │
                                          ▼
                         ┌──────────────────────────────────┐
                         │   Application Load Balancer      │
                         │   Dual AZ (us-east-1a, 1b)       │
                         └────────────────┬─────────────────┘
                                          │ Target Group (Port 4000)
                   ┌──────────────────────┴──────────────────────┐
                   │                                             │
                   ▼                                             ▼
  ┌──────────────────────────────────┐          ┌──────────────────────────────────┐
  │   Private Subnet A (App Tier)    │          │   Private Subnet B (App Tier)    │
  │   ECS Fargate Task 1 (Primary)   │          │   ECS Fargate Task 2 (Spot Base) │
  └────────────────┬─────────────────┘          └────────────────┬─────────────────┘
                   │                                             │
                   └──────────────────────┬──────────────────────┘
                                          │ Chained SG (Port 5432)
                                          ▼
                         ┌──────────────────────────────────┐
                         │   Private Subnet (Data Tier)     │
                         │   Amazon RDS PostgreSQL 15       │
                         │   KMS Encrypted, Forced TLS 1.2+ │
                         └──────────────────────────────────┘
```

---

## Cloud Infrastructure Breakdown

### 1. Edge Layer: Cloudflare
- **Role:** Handles global DNS resolution, edge caching, and strict SSL/TLS encryption.
- **Implementation:** Proxies incoming requests directly to the AWS Application Load Balancer origin while hiding origin IP addresses. Enforces HTTPS, HTTP/2, and HTTP/3 transport.

![Cloudflare Configuration](docs/screenshots/cloudflare-dns-ssl.png)
*Cloudflare DNS, SSL/TLS, and edge caching configuration.*

---

### 2. Perimeter Security: AWS WAFv2
- **Role:** Protects the public Application Load Balancer from automated bot traffic, exploit payloads, and denial-of-service attempts.
- **Rule Sets Enforced:**
  - `AWSManagedRulesCommonRuleSet`: Mitigates OWASP Top 10 vulnerabilities.
  - `AWSManagedRulesKnownBadInputsRuleSet`: Blocks malicious request patterns and path traversal.
  - `AWSManagedRulesSQLiRuleSet`: Protects against SQL injection vectors across headers and query parameters.
  - Rate-based IP limiting rules for the general API and dedicated rate limits on `/api/ai` query endpoints.

![AWS WAFv2 Dashboard](docs/screenshots/aws-waf.png)
*AWS WAF WebACL rule groups and traffic inspection metrics.*

---

### 3. Traffic Distribution: AWS Application Load Balancer (ALB)
- **Role:** Distributes traffic across backend container instances across two Availability Zones (`us-east-1a` and `us-east-1b`).
- **Configuration:**
  - Standard HTTP/HTTPS listeners forwarding to backend Target Group `terraviz3d-production-tg`.
  - Configured with proactive health check polling against `/health`.
  - Zero-downtime rolling task deregistration and connection draining enabled.

![AWS Application Load Balancer](docs/screenshots/aws-alb-target-group.png)
*Application Load Balancer listeners, target groups, and healthy target states.*

---

### 4. Compute Tier: AWS Elastic Container Service (ECS) Fargate
- **Role:** Runs the containerized Node.js backend and Single-Page Application (SPA) in a serverless, managed container environment.
- **Configuration:**
  - Cluster: `terraviz3d-cluster-production`
  - Service: `terraviz3d-backend-svc`
  - Capacity Providers: Multi-tier deployment combining On-Demand base tasks for baseline availability with Fargate Spot instances for compute cost reduction.
  - Resilience: Automatic rolling updates with `minimumHealthyPercent = 100` and `maximumPercent = 200`, ensuring updated containers pass health checks before older tasks retire.
  - Auto-scaling: Target Tracking policies scaling container counts based on 70% average CPU utilization.

![AWS ECS Fargate](docs/screenshots/aws-ecs-fargate.png)
*ECS cluster, active service status, task definitions, and running Fargate tasks.*

---

### 5. Container Registry: Amazon Elastic Container Registry (ECR)
- **Role:** Secure, private Docker image repository for container versions.
- **Configuration:**
  - Repository: `terraviz-backend`
  - Security: KMS encryption at rest using AWS managed keys; scan-on-push automated vulnerability assessment.
  - Lifecycle Policies: Retains the latest 5 image revisions, automatically pruning orphaned layers to control storage costs.

![Amazon ECR](docs/screenshots/aws-ecr-repository.png)
*Amazon ECR repository with tagged image revisions and vulnerability scanning results.*

---

### 6. Data Tier: Amazon Relational Database Service (RDS)
- **Role:** Managed relational database storing user accounts, authentication sessions, audit logs, vector chunks, and knowledge graph edges.
- **Configuration:**
  - Engine: PostgreSQL 15 on `db.t4g.micro` instance class.
  - High Availability: DB Subnet Group spanning across multiple private subnets.
  - Security: Deletion protection enabled, automated daily snapshots, storage encrypted using KMS Customer Managed Key (`alias/terraviz3d-data`).
  - Network Isolation: Chained security groups allowing incoming port 5432 connections strictly from the ECS application security group.
  - Encryption in Transit: Database parameter group enforces `rds.force_ssl = 1` for TLS 1.2+ mandatory transport.

![Amazon RDS PostgreSQL](docs/screenshots/aws-rds-postgres.png)
*RDS PostgreSQL configuration, connectivity security groups, and storage encryption.*

---

### 7. In-Memory Caching: Amazon ElastiCache
- **Role:** Redis caching cluster for session storage and temporary caching of third-party geospatial API responses.
- **Configuration:**
  - Multi-AZ subnet placement within isolated private data subnets.
  - Security group boundaries restricted to the backend application layer.

![Amazon ElastiCache](docs/screenshots/aws-elasticache.png)
*Amazon ElastiCache cluster configuration and node metrics.*

---

### 8. Key Management & Secrets
- **AWS Secrets Manager:** Centralized store for sensitive database credentials, JWT secrets, and external AI provider keys (`/app/backend/app_secrets`).
- **AWS KMS (Key Management Service):** Dedicated Customer Managed Keys (CMKs) used for envelope encryption of databases, ECR repositories, and CloudWatch log groups.

![AWS Secrets Manager and KMS](docs/screenshots/aws-secrets-kms.png)
*AWS Secrets Manager secrets and KMS encryption keys.*

---

### 9. Observability & Monitoring: AWS CloudWatch
- **Role:** Centralized logging, metric alarms, and real-time operations dashboard.
- **Components:**
  - Centralized log streaming from Fargate containers to `/ecs/terraviz3d-backend` with 30-day retention.
  - Operational dashboard tracking ALB request counts, HTTP 5xx rates, target response latencies, ECS CPU/Memory utilization, and active RDS database connections.
  - Automated CloudWatch metric alarms for high CPU and anomalous error thresholds.

![AWS CloudWatch Dashboard](docs/screenshots/aws-cloudwatch-dashboard.png)
*CloudWatch operational dashboard showing live system metrics and log streams.*

---

### 10. Automated Infrastructure: Terraform
- **Role:** Complete Infrastructure as Code (IaC) modularization.
- **Modules:**
  - `network`: Custom VPC, multi-AZ public and private subnets, NAT Gateway, route tables, S3 Gateway endpoint.
  - `security`: KMS Customer Managed Keys, Secrets Manager, AWS WAFv2 WebACL.
  - `compute`: Application Load Balancer, Target Groups, ECS Cluster, Task Definitions, Fargate Services, ECR repository.
  - `data`: RDS PostgreSQL multi-AZ subnet groups, security groups, parameter groups, ElastiCache Redis.
  - `monitoring`: CloudWatch log groups, metric alarms, centralized operations dashboard.
  - `iam`: Role definitions, MFA boundary requirements, permission boundaries.

![Terraform Deployment](docs/screenshots/terraform-deployment.png)
*Terraform state validation and module execution output.*

---

## Application Architecture

### 1. Interactive 3D WebGL Globe
The client-side visualization is built with Three.js and custom GLSL shaders:
- **Atmosphere Shaders:** Multi-layer Rayleigh and Mie atmospheric scattering effect.
- **Textures:** Bump-mapped terrain topography, dynamic cloud rotation layers, and high-resolution Earth day/night maps.
- **Hardware Acceleration:** Frame-rate locked rendering loop optimized for standard and high-DPI displays.
- **Interactive Raycasting:** Real-time pointer and touch raycasting for direct selection of geographic 3D markers.

![3D Globe Dashboard](docs/screenshots/app-dashboard.png)
*TerraViz 3D interface rendering active earthquake markers and metadata inspector.*

---

### 2. Real-Time Geospatial Pipelines
- **Earthquake Feed:** USGS Real-time GeoJSON API (M4.5+ events globally over 30 days). Events are normalized into spherical coordinates and rendered as magnitude-scaled glowing cylinders.
- **Population Distribution:** Demographic data for 195+ countries rendered as logarithmic pillar extrusions positioned at national capital coordinates.
- **Proxy Caching Layer:** Backend proxy caching engine with in-memory TTL caching prevents external API rate-limiting and reduces client-side payload sizes.

---

### 3. Hybrid Graph-RAG AI Pipeline
The platform includes an AI assistant that interprets real-time seismic events rather than outputting raw database records:

1. **Preprocessing & Embedding:**
   - Raw GeoJSON events are preprocessed into standardized descriptive text including magnitude, place, depth, timestamp, and tsunami risk indicators.
   - Vector embeddings are generated via the HuggingFace `@xenova/transformers` model (`all-MiniLM-L6-v2`, 384 dimensions).
   - Knowledge graph edges (`rag_edges`) are calculated across three relationships:
     - `same_region`: Shared geographic tectonic sectors.
     - `temporal_cluster`: Events occurring within a 7-day sliding window.
     - `magnitude_similar`: Events within 0.5 magnitude variance.
2. **Hybrid 3-Stage Retrieval:**
   - Stage 1: Vector cosine similarity search across primary text chunks.
   - Stage 2: Full-text keyword matching using PostgreSQL `pg_trgm` and `tsvector` indexes.
   - Stage 3: Knowledge graph edge expansion traversing related nodes.
   - Fusion: Reciprocal Rank Fusion (RRF) scores and ranks combined candidates.
3. **Domain-Specific Generation:**
   - Context is passed to Groq (`openai/gpt-oss-20b`) via a system prompt enforcing:
     - Answer-first conclusions in sentence one.
     - Physical real-world translation of numbers (e.g. M5.0 shaking vs. M7.0 destructive potential).
     - Connected analytical prose with register matching.
     - Active globe coordinate guidance directing the user where to inspect on the 3D map.

![AI Assistant Panel](docs/screenshots/ai-chat-interface.png)
*AI assistant delivering interpreted seismic intelligence with automated globe marker highlights.*

---

### 4. Authentication & Security
- **Authentication:** Stateless JSON Web Tokens (JWT) signed with HMAC-SHA256.
- **Transport Security:** Tokens transmitted in secure `HttpOnly`, `SameSite=Lax` cookies, paired with Bearer token authentication headers.
- **Password Security:** Password hashing using `bcryptjs` with salt rounds.
- **Brute Force Protection:** Account lockout mechanism (5 consecutive failed attempts trigger an automatic 15-minute lock).
- **Session & Audit Logging:** Active sessions tracked in PostgreSQL; authentication events recorded in an append-only `audit_logs` table.

---

### 5. Mobile Responsive Design
- **Touch Gesture Engine:** Custom 1-finger rotate, 2-finger pinch-to-zoom (clamped between 1.2x and 4.0x radius), and touch tap selection.
- **Touch Action Isolation:** Canvas-level touch handling avoids pull-to-refresh or page scroll conflicts.
- **Ergonomic Controls:** Slide-out drawer navigation, bottom quick actions dock, and sliding bottom sheets for the AI Chat Panel and Earthquake Info Inspector adhering to device safe-area insets (`env(safe-area-inset-bottom)`).

![Mobile Interface](docs/screenshots/mobile-view.png)
*Mobile view showing touch-optimized globe navigation, quick dock, and bottom sheet panels.*

---

## Technology Stack

### Frontend
- **Framework:** React 19, Vite 8
- **3D Graphics:** Three.js (WebGL), Custom GLSL Shaders
- **Typography & Styling:** Orbitron, Inter, JetBrains Mono, Custom CSS Modules
- **State Management:** Custom React Hooks (`useAuth`, `useIsMobile`)

### Backend
- **Runtime:** Node.js 22 LTS, Express 4.18
- **Database:** PostgreSQL 15 (`pg`), pg_trgm
- **ML & Embeddings:** `@xenova/transformers` (`all-MiniLM-L6-v2`)
- **LLM Inference:** Groq SDK (`openai/gpt-oss-20b`)
- **Security:** Helmet, CORS, bcryptjs, jsonwebtoken, cookie-parser, express-rate-limit

### Cloud & DevOps
- **Cloud Provider:** Amazon Web Services (AWS)
- **Edge / CDN:** Cloudflare (DNS, SSL/TLS Termination, Caching)
- **Infrastructure as Code:** Terraform
- **Containerization:** Docker (Multi-stage Debian minimal builds)
- **Container Registry:** Amazon ECR
- **Container Orchestration:** AWS ECS Fargate
- **Load Balancing:** AWS Application Load Balancer
- **Database Service:** Amazon RDS PostgreSQL
- **Security:** AWS WAFv2, AWS Secrets Manager, AWS KMS
- **Observability:** AWS CloudWatch Logs, Metrics, Alarms, Dashboards

---

## Repository Structure

```text
Terraviz3D/
├── backend/
│   ├── public/              # Production static assets served by backend
│   ├── src/
│   │   ├── config/          # Database pool and environment configuration
│   │   ├── controllers/     # AI, Auth, and Geo controllers
│   │   ├── middleware/      # Auth, rate limiting, and error handling
│   │   ├── routes/          # API route definitions
│   │   ├── services/        # RAG, graph, embedding, and geo services
│   │   ├── tests/           # Automated prompt benchmarks and test suites
│   │   └── server.js        # Express application entrypoint
│   ├── Dockerfile           # Multi-stage production container build
│   └── package.json
│
├── frontend/
│   ├── public/              # Globe textures and icons
│   ├── src/
│   │   ├── components/      # GlobeEngine.js, AIChatpanel.jsx, AuthModal.jsx
│   │   ├── hooks/           # useAuth.js, useIsMobile.js
│   │   ├── services/        # Client API interfaces
│   │   ├── App.jsx          # Main application orchestrator
│   │   └── main.jsx         # React entrypoint
│   ├── index.html           # Viewport configuration and web app manifests
│   └── vite.config.js       # Build and development proxy configuration
│
├── terraform/
│   ├── bootstrap/           # Remote state S3 bucket and DynamoDB lock table
│   ├── environments/prod/   # Production root configuration and backend state
│   ├── modules/
│   │   ├── compute/         # ALB, ECS Fargate, ECR definitions
│   │   ├── data/            # RDS PostgreSQL and ElastiCache definitions
│   │   ├── iam/             # Roles, boundaries, and policies
│   │   ├── monitoring/      # CloudWatch log groups, alarms, and dashboards
│   │   ├── network/         # VPC, subnets, NAT Gateway, route tables
│   │   └── security/        # WAFv2, KMS keys, Secrets Manager
│   ├── builder-user-data.sh # Self-terminating EC2 container builder script
│   └── pack.py              # Deployment bundling utility
│
├── docs/
│   └── screenshots/         # Architecture and application screenshots
│
└── README.md
```

---

## Local Development Setup

### Prerequisites
- Node.js >= 20.x
- PostgreSQL >= 14.x
- Groq API Key

### 1. Database Configuration
Create a local PostgreSQL database named `terraviz`:
```sql
CREATE DATABASE terraviz;
```

### 2. Backend Setup
Create `backend/.env`:
```env
PORT=4000
NODE_ENV=development
DB_HOST=localhost
DB_PORT=5432
DB_NAME=terraviz
DB_USER=postgres
DB_PASSWORD=your_local_password
JWT_SECRET=your_development_secret_key_minimum_32_characters
JWT_EXPIRES=2h
FRONTEND_URL=http://localhost:5173
GROQ_API_KEY=your_groq_api_key
```

Install dependencies and start the backend service:
```bash
cd backend
npm install
npm run dev
```
*(The database schema and initial earthquake data sync run automatically on startup).*

### 3. Frontend Setup
In a new terminal window:
```bash
cd frontend
npm install
npm run dev
```
Access the application at `http://localhost:5173`.

---

## Production Deployment Workflow

### 1. Frontend Build
Compile the client assets and copy them into the backend container serving directory:
```bash
cd frontend
npm run build
cp -r dist/* ../backend/public/
```

### 2. Container Build & Push (Amazon ECR)
Authenticate Docker with your AWS account and build the container:
```bash
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 530540751051.dkr.ecr.us-east-1.amazonaws.com

docker build -t 530540751051.dkr.ecr.us-east-1.amazonaws.com/terraviz-backend:latest -f backend/Dockerfile backend

docker push 530540751051.dkr.ecr.us-east-1.amazonaws.com/terraviz-backend:latest
```

### 3. Rolling Service Update (AWS ECS)
Trigger zero-downtime container replacement on the ECS cluster:
```bash
aws ecs update-service \
  --cluster terraviz3d-cluster-production \
  --service terraviz3d-backend-svc \
  --force-new-deployment \
  --region us-east-1
```
