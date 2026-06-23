# DepSafe — Dependency Health Intelligence

ML-powered npm dependency health scoring with explainable predictions. Paste a package name, get a 0–100 health score backed by 20 live features, a trained Random Forest model, and SHAP-powered explanations showing exactly *why* — not just a number.

**Live:** [https://d20gt3le9mm1ru.cloudfront.net](https://d20gt3le9mm1ru.cloudfront.net)

## Features

- **Single Package Analysis** — Health score, risk verdict, SHAP waterfall chart, and full feature breakdown
- **Head-to-Head Comparison** — Side-by-side scores, SHAP charts, and per-feature "favors" analysis
- **Dependency Tree Visualization** — Interactive graph of scored dependencies with chain health and weakest-link detection
- **Transparent ML** — Every prediction shows which features pushed the score up or down via SHAP TreeExplainer

## How It Works

1. User enters an npm package name
2. Backend fetches 20 features in real time from GitHub REST API, npm registry, and npms.io
3. A trained RandomForestClassifier (200 trees, balanced class weights) predicts maintained vs. abandoned
4. SHAP TreeExplainer computes per-feature importance for that specific prediction
5. Frontend renders the score, explanation, and interactive visualizations

### The 20 Features

| Category | Features |
|----------|----------|
| Commit activity | commits_90d, commits_365d, commit_velocity_trend, days_since_last_commit |
| Contributors | contributors_total, contributors_90d, bus_factor |
| Issues | open_issues, closed_issues_90d, issue_response_time_median |
| Releases | days_since_last_release, release_frequency, release_regularity |
| Popularity | weekly_downloads, download_trend, dependent_count |
| Repo quality | has_readme, has_license, repo_stars, repo_open_prs |

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React (Vite) + Tailwind CSS |
| Visualizations | Recharts, React Flow (@xyflow/react) |
| Backend | FastAPI + Mangum (Lambda adapter) |
| ML Model | scikit-learn RandomForestClassifier |
| Explainability | SHAP TreeExplainer |
| Infrastructure | AWS Lambda (container), API Gateway, S3, CloudFront |
| IaC | Terraform |

## Project Structure

```
DepSafe/
├── model/                  # Training pipeline
│   ├── collect_packages.py # Curates npm package list from npms.io + npm registry
│   ├── collect_features.py # Fetches features for each package (GitHub + npm APIs)
│   ├── train.py            # Trains RandomForest, generates SHAP plots, saves model
│   ├── model.joblib        # Trained model artifact
│   └── model_meta.json     # Model metadata (features, metrics, training date)
├── backend/                # FastAPI API
│   ├── main.py             # Endpoints: /package, /compare, /tree, /model-info
│   ├── features.py         # Live feature fetching (GitHub + npm + npms.io)
│   ├── predictor.py        # Model loading, inference, SHAP computation
│   └── requirements.txt
├── frontend/               # React SPA
│   └── src/
│       ├── pages/          # Landing, Package, Compare, Tree, NotFound
│       └── components/     # HealthGauge, ShapWaterfall, FeatureTable, Nav
├── infra/                  # Terraform + deploy script
│   ├── main.tf             # Lambda, API Gateway, S3, CloudFront, SSM
│   └── deploy.sh           # One-command build & deploy
└── Dockerfile              # Lambda container image
```

## Local Development

### Prerequisites

- Python 3.12
- Node.js 20+
- GitHub personal access token (for API rate limits)

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

The frontend dev server proxies `/api` requests to `localhost:8000`.

### Training the model

```bash
cd model
python collect_packages.py     # Generates package_list.json
python collect_features.py     # Fetches features → dataset.csv (takes hours)
python train.py                # Trains model → model.joblib + model_meta.json
```

## Deployment

```bash
cd infra
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your GitHub token
./deploy.sh
```

This builds the Docker image, pushes to ECR, provisions all AWS resources via Terraform, builds the frontend, and uploads to S3.

## Model Performance

Trained on 500+ real npm packages labeled as maintained or abandoned based on commit recency, release activity, and archive status.

| Metric | Score |
|--------|-------|
| F1 | 0.975 |
| Accuracy | 0.981 |
| Precision | 0.951 |
| Recall | 1.000 |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/package/{name}` | Analyze a single package |
| GET | `/api/compare?a=X&b=Y` | Compare two packages |
| GET | `/api/tree/{name}?depth=2` | Dependency tree with scores |
| GET | `/api/model-info` | Model metadata |

## License

MIT
