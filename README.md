# DepSafe — Dependency Health Intelligence

ML-powered npm dependency health scoring with explainable predictions. Paste a package name, get a 0–100 health score backed by 20 live features, a trained Random Forest model, and SHAP-powered explanations showing exactly *why* — not just a number.


---

## Features

- **Single Package Analysis** — Health score, risk verdict, SHAP waterfall chart, and full feature breakdown for any npm package
- **Head-to-Head Comparison** — Side-by-side scores, SHAP charts, and per-feature "favors" analysis between two packages
- **Dependency Tree Visualization** — Interactive graph of scored dependencies with chain health and weakest-link detection
- **Transparent ML** — Every prediction shows which features pushed the score up or down via SHAP TreeExplainer

---

## How It Works

1. User enters an npm package name
2. Backend fetches **20 features** in real time from GitHub REST API, npm registry, and npms.io
3. A trained **RandomForestClassifier** (200 trees, balanced class weights) predicts maintained vs. abandoned
4. **SHAP TreeExplainer** computes per-feature importance for that specific prediction
5. Frontend renders the score, explanation, and interactive visualizations

### The 20 Features

| Category | Features |
|----------|----------|
| Commit activity | `commits_90d`, `commits_365d`, `commit_velocity_trend`, `days_since_last_commit` |
| Contributors | `contributors_total`, `contributors_90d`, `bus_factor` |
| Issues | `open_issues`, `closed_issues_90d`, `issue_response_time_median` |
| Releases | `days_since_last_release`, `release_frequency`, `release_regularity` |
| Popularity | `weekly_downloads`, `download_trend`, `dependent_count` |
| Repo quality | `has_readme`, `has_license`, `repo_stars`, `repo_open_prs` |

### Model Performance

Trained on 1,725 real npm packages labeled as maintained or abandoned based on commit recency, release activity, and archive status.

| Metric | Score |
|--------|-------|
| F1 | 0.986 |
| Accuracy | 0.991 |
| Precision | 0.973 |
| Recall | 1.000 |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19 (Vite) + Tailwind CSS v4 |
| Visualizations | Recharts (SHAP waterfall), React Flow / @xyflow/react (dependency tree) |
| Backend API | FastAPI (Python 3.12) + Mangum (AWS Lambda adapter) |
| ML Model | scikit-learn `RandomForestClassifier` (200 estimators, `class_weight='balanced'`) |
| Explainability | SHAP `TreeExplainer` |
| Containerization | Docker (AWS Lambda Python 3.12 base image) |
| Infrastructure | Terraform — AWS Lambda, API Gateway, S3, CloudFront, ECR, SSM, IAM |

---

## AWS Architecture — Detailed Breakdown

The entire application runs serverlessly on AWS. Here is every service used, what it does, and why it was chosen:

### Compute

| Service | Resource | What It Does |
|---------|----------|-------------|
| **AWS Lambda** | `depsafe` function | Runs the FastAPI backend as a container image. Each API request (package analysis, comparison, tree) invokes this function. Configured with 1024 MB memory and 120-second timeout to handle SHAP computation and multiple GitHub API calls per request. Uses Mangum to translate Lambda events into ASGI requests that FastAPI understands. |
| **Amazon ECR** | `depsafe` repository | Stores the Docker container image (~350 MB) that Lambda pulls on cold start. The image contains the FastAPI app code, the trained model artifact (`model.joblib`), scikit-learn, SHAP, and all Python dependencies. Built from `public.ecr.aws/lambda/python:3.12` base image. |

### Networking & API

| Service | Resource | What It Does |
|---------|----------|-------------|
| **API Gateway HTTP API** | `depsafe` | Provides a public HTTPS endpoint that routes all requests to the Lambda function. Uses HTTP API (v2) for lower latency and cost compared to REST API. Handles CORS automatically. The `$default` stage auto-deploys on changes. CloudFront routes `/api/*` requests here. |

### Storage & CDN

| Service | Resource | What It Does |
|---------|----------|-------------|
| **Amazon S3** | `depsafe-frontend-{account_id}` | Hosts the static frontend build (~820 KB total: HTML, CSS, JS, SVG assets). Configured with all public access blocked — only CloudFront can read objects via OAC (Origin Access Control). |
| **Amazon CloudFront** | Distribution `E2VDZ8KGQ1XY3X` | Global CDN that serves the entire application from a single domain. Routes requests based on path: `/api/*` goes to API Gateway (Lambda), everything else serves from S3 (frontend). Handles HTTPS, caching (3600s for static assets, 0s for API), and SPA fallback (404/403 → `index.html` for client-side routing). Uses OAC to securely access the S3 bucket without making it public. |

### Security & Configuration

| Service | Resource | What It Does |
|---------|----------|-------------|
| **AWS SSM Parameter Store** | `/depsafe/github-token` | Stores the GitHub Personal Access Token as a `SecureString` (encrypted at rest with AWS-managed KMS key). The Lambda function reads this at startup to authenticate GitHub API calls (5,000 req/hr vs 60/hr unauthenticated). Avoids hardcoding secrets in the container image or environment variables. |
| **AWS IAM** | `depsafe-lambda` role | Grants the Lambda function exactly two permissions: (1) write logs to CloudWatch via `AWSLambdaBasicExecutionRole`, and (2) read the specific SSM parameter via a scoped inline policy. Follows least-privilege principle. |

### Cost Analysis

All services used fall under AWS Free Tier or have negligible cost at this project's scale:

| Service | Free Tier | This Project's Usage | Monthly Cost |
|---------|-----------|---------------------|-------------|
| **Lambda** | 1M requests + 400,000 GB-seconds/month | ~100-500 requests/month (portfolio demo) | **$0.00** |
| **API Gateway** | 1M HTTP API calls/month for 12 months | ~100-500 calls/month | **$0.00** |
| **S3** | 5 GB storage + 20,000 GET requests/month | 820 KB stored, <1,000 GETs/month | **$0.00** |
| **CloudFront** | 1 TB transfer + 10M requests/month | <1 GB transfer/month | **$0.00** |
| **ECR** | 500 MB storage/month | ~350 MB (1 image) | **$0.00** |
| **SSM Parameter Store** | 10,000 standard parameters | 1 parameter | **$0.00** |
| **CloudWatch Logs** | 5 GB ingestion + 5 GB storage/month | <100 MB/month | **$0.00** |

**Total estimated cost: $0.00/month** for portfolio-level traffic (<1,000 requests/month).

> **Note:** The Lambda free tier (1M requests + 400,000 GB-seconds) resets monthly and is permanent (not just 12 months). API Gateway HTTP API free tier is 1M calls/month for 12 months, after which it costs $1.00/million requests — still effectively free for portfolio traffic. The only service with a 12-month free tier limit is API Gateway; after that, at portfolio-level traffic, expect <$0.01/month.

---

## Project Structure

```
DepSafe/
├── model/                      # ML training pipeline
│   ├── collect_packages.py     # Curates ~4,429 npm packages from npms.io + npm registry
│   ├── collect_features.py     # Fetches 20 features per package (GitHub + npm APIs)
│   ├── train.py                # Trains RandomForest, generates SHAP plots, saves artifacts
│   ├── dataset.csv             # Training dataset (1,725 labeled packages)
│   ├── model.joblib            # Trained model artifact (not committed, generated by train.py)
│   ├── model_meta.json         # Model metadata (features, metrics, training date)
│   ├── evaluation_report.json  # Precision, recall, F1, confusion matrix
│   └── plots/                  # Feature importance & SHAP summary plots
│       ├── feature_importance.png
│       ├── shap_summary.png
│       └── shap_bar.png
├── backend/                    # FastAPI application
│   ├── main.py                 # 5 API endpoints + Mangum Lambda handler
│   ├── features.py             # Live feature fetching from GitHub + npm + npms.io
│   ├── predictor.py            # Model loading, inference, SHAP computation
│   └── requirements.txt        # Python dependencies
├── frontend/                   # React SPA
│   ├── index.html              # Entry HTML with meta tags
│   ├── vite.config.js          # Vite + React + Tailwind, API proxy for local dev
│   └── src/
│       ├── App.jsx             # Router: /, /package/:name, /compare, /tree/:name
│       ├── index.css           # Global styles, CSS variables, glow effects
│       ├── pages/
│       │   ├── Landing.jsx     # Hero, search, examples, "How it works"
│       │   ├── Package.jsx     # Health gauge, verdict, SHAP chart, feature table
│       │   ├── Compare.jsx     # Side-by-side analysis with recommendation
│       │   ├── Tree.jsx        # React Flow dependency graph with scoring
│       │   └── NotFound.jsx    # 404 page
│       └── components/
│           ├── Nav.jsx         # Sticky navigation with active state
│           ├── HealthGauge.jsx # SVG semicircle gauge with neon glow
│           ├── ShapWaterfall.jsx # Recharts horizontal bar chart
│           ├── FeatureTable.jsx  # 20 features with color-coded bars
│           └── LoadingSkeleton.jsx # Animated placeholder
├── infra/                      # Infrastructure as Code
│   ├── main.tf                 # Terraform: Lambda, API Gateway, S3, CloudFront, SSM, IAM
│   ├── deploy.sh               # One-command build & deploy script
│   └── terraform.tfvars.example # Template for secrets
├── Dockerfile                  # Lambda container: Python 3.12 + app + model
└── README.md
```

---

## API Endpoints

| Method | Path | Description | Example |
|--------|------|-------------|---------|
| GET | `/api/health` | Health check, confirms model is loaded | `{"status":"ok","model_loaded":true}` |
| GET | `/api/package/{name}` | Full analysis: score, verdict, SHAP, features | `/api/package/express` |
| GET | `/api/compare?a=X&b=Y` | Compare two packages with recommendation | `/api/compare?a=express&b=fastify` |
| GET | `/api/tree/{name}?depth=2` | Dependency tree with per-node health scores | `/api/tree/express?depth=2` |
| GET | `/api/model-info` | Model metadata and training stats | Returns model type, F1, dataset size |

---

## Local Development

### Prerequisites

- Python 3.12 (3.14 not supported — numba/shap dependency)
- Node.js 20+
- GitHub Personal Access Token (for API rate limits: 5,000 req/hr vs 60/hr without)

### Setup

```bash
# Backend
cd backend
python3.12 -m venv ../venv
source ../venv/bin/activate
pip install -r requirements.txt
echo "GITHUB_TOKEN=ghp_your_token" > .env
uvicorn main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

The Vite dev server proxies `/api` requests to `localhost:8000` automatically.

### Retraining the Model

```bash
cd model
python collect_packages.py     # Generates package_list.json (~4,429 packages)
python collect_features.py     # Fetches features → dataset.csv (takes ~6-8 hours)
python train.py                # Trains model → model.joblib + model_meta.json + plots/
```

---

## Deployment

### Prerequisites

- AWS CLI configured (`aws configure`)
- Terraform >= 1.0
- Docker

### Deploy

```bash
cd infra
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your GitHub token

./deploy.sh
```

This script:
1. Runs `terraform apply` to provision all AWS resources
2. Builds the Docker image (`--platform linux/amd64`)
3. Pushes to ECR
4. Updates the Lambda function
5. Builds the frontend with Vite
6. Uploads static assets to S3
7. Invalidates the CloudFront cache

---

## License

MIT
