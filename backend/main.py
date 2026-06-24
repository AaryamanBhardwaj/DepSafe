"""
FastAPI backend for DepSafe.
Endpoints:
  GET  /api/health           — API health check
  GET  /api/package/{name}   — Single package prediction
  GET  /api/compare          — Compare two packages
  GET  /api/tree/{name}      — Dependency tree with health scores
  GET  /api/model-info       — Model metadata and training stats
"""

import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

import features as feat
import predictor


@asynccontextmanager
async def lifespan(app: FastAPI):
    predictor.load_model()
    if os.getenv("GITHUB_TOKEN"):
        feat.GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
        feat.reinit_sessions()
    yield


app = FastAPI(
    title="DepSafe API",
    description="Dependency health intelligence powered by ML",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {"status": "ok", "model_loaded": predictor._model is not None}


@app.get("/api/model-info")
def model_info():
    meta = predictor.get_model_meta()
    return {
        "model_type": meta.get("model_type", "RandomForestClassifier"),
        "features": meta.get("features", predictor.FEATURE_NAMES),
        "n_estimators": meta.get("n_estimators", 200),
        "dataset_size": meta.get("dataset_size", 0),
        "f1_score": meta.get("f1_score", 0),
        "training_date": meta.get("training_date", "unknown"),
    }


@app.get("/api/package/{name:path}")
def analyze_package(name: str):
    try:
        result = feat.fetch_features(name)
    except feat.PackageNotFoundError:
        raise HTTPException(status_code=404, detail=f"Package '{name}' not found on npm")
    except feat.GitHubRepoNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except feat.RateLimitError:
        raise HTTPException(
            status_code=429,
            detail="GitHub API rate limit reached. Try again in a few minutes."
        )

    prediction = predictor.predict(result["features"])

    return {
        "package": name,
        **result["metadata"],
        **prediction,
    }


@app.get("/api/compare")
def compare_packages(
    a: str = Query(..., description="First package name"),
    b: str = Query(..., description="Second package name"),
):
    results = {}
    for pkg_name in [a, b]:
        try:
            result = feat.fetch_features(pkg_name)
            prediction = predictor.predict(result["features"])
            results[pkg_name] = {
                "package": pkg_name,
                **result["metadata"],
                **prediction,
            }
        except feat.PackageNotFoundError:
            raise HTTPException(status_code=404, detail=f"Package '{pkg_name}' not found on npm")
        except feat.GitHubRepoNotFoundError as e:
            raise HTTPException(status_code=404, detail=str(e))
        except feat.RateLimitError:
            raise HTTPException(
                status_code=429,
                detail="GitHub API rate limit reached. Try again in a few minutes."
            )

    score_a = results[a]["health_score"]
    score_b = results[b]["health_score"]

    if abs(score_a - score_b) < 5:
        recommendation = f"Both {a} and {b} show similar maintenance health signals."
    elif score_a > score_b:
        recommendation = f"Based on maintenance health signals, {a} shows stronger indicators than {b}."
    else:
        recommendation = f"Based on maintenance health signals, {b} shows stronger indicators than {a}."

    feature_diffs = []
    for feat_name in predictor.FEATURE_NAMES:
        val_a = results[a]["features"][feat_name]
        val_b = results[b]["features"][feat_name]
        shap_a = next(
            (f["shap_value"] for f in results[a]["shap"]["feature_impacts"] if f["feature"] == feat_name), 0
        )
        shap_b = next(
            (f["shap_value"] for f in results[b]["shap"]["feature_impacts"] if f["feature"] == feat_name), 0
        )
        feature_diffs.append({
            "feature": feat_name,
            "value_a": val_a,
            "value_b": val_b,
            "shap_a": shap_a,
            "shap_b": shap_b,
            "favors": a if shap_a > shap_b else b if shap_b > shap_a else "tie",
        })

    return {
        "packages": results,
        "recommendation": recommendation,
        "feature_comparison": feature_diffs,
    }


@app.get("/api/tree/{name:path}")
def dependency_tree(name: str, depth: int = Query(default=2, ge=1, le=3)):
    """Resolve dependency tree and score each node."""
    from concurrent.futures import ThreadPoolExecutor, as_completed
    import threading

    cache = {}
    cache_lock = threading.Lock()

    def score_package(pkg_name: str) -> dict:
        node = {
            "name": pkg_name,
            "health_score": None,
            "risk_level": None,
            "verdict": None,
            "error": None,
        }
        try:
            result = feat.fetch_features(pkg_name)
            prediction = predictor.predict(result["features"])
            node["health_score"] = prediction["health_score"]
            node["risk_level"] = prediction["risk_level"]
            node["verdict"] = prediction["verdict"]
            node["github_url"] = result["metadata"]["github_url"]
        except (feat.PackageNotFoundError, feat.GitHubRepoNotFoundError):
            node["error"] = "no_github"
        except feat.RateLimitError:
            node["error"] = "rate_limit"
        except Exception:
            node["error"] = "fetch_failed"
        return node

    def resolve_deps(pkg_name: str, current_depth: int) -> dict:
        with cache_lock:
            if pkg_name in cache:
                return cache[pkg_name]
            node = {"name": pkg_name, "dependencies": []}
            cache[pkg_name] = node

        scored = score_package(pkg_name)
        node.update(scored)

        if current_depth < depth:
            try:
                npm_data = feat._npm_get(f"https://registry.npmjs.org/{pkg_name}/latest")
                if npm_data:
                    dep_names = list(npm_data.get("dependencies", {}).keys())[:15]
                    with ThreadPoolExecutor(max_workers=8) as pool:
                        futures = {}
                        for dep_name in dep_names:
                            with cache_lock:
                                if dep_name in cache:
                                    node["dependencies"].append(cache[dep_name])
                                    continue
                            futures[pool.submit(resolve_deps, dep_name, current_depth + 1)] = dep_name
                        for future in as_completed(futures):
                            try:
                                child = future.result(timeout=25)
                                node["dependencies"].append(child)
                            except Exception:
                                node["dependencies"].append({
                                    "name": futures[future],
                                    "health_score": None, "risk_level": None,
                                    "verdict": None, "error": "timeout", "dependencies": [],
                                })
            except Exception:
                pass

        return node

    try:
        tree = resolve_deps(name, 0)
    except feat.RateLimitError:
        raise HTTPException(status_code=429, detail="GitHub API rate limit reached.")

    scored_nodes = [n for n in cache.values() if n["health_score"] is not None]
    weakest = min(scored_nodes, key=lambda n: n["health_score"]) if scored_nodes else None

    all_scores = [n["health_score"] for n in scored_nodes]
    chain_health = round(sum(all_scores) / len(all_scores), 1) if all_scores else None

    root_score = tree["health_score"]

    summary = None
    if weakest and root_score is not None and chain_health is not None:
        if weakest["name"] != name and weakest["health_score"] < root_score:
            summary = (
                f"Your package health is {root_score}, but your dependency chain "
                f"health is {chain_health} due to {weakest['name']} "
                f"(score: {weakest['health_score']})"
            )
        else:
            summary = f"Dependency chain health: {chain_health}"

    return {
        "tree": tree,
        "total_dependencies": len(cache) - 1,
        "scored_count": len(scored_nodes),
        "chain_health": chain_health,
        "weakest_link": {
            "name": weakest["name"],
            "health_score": weakest["health_score"],
            "verdict": weakest["verdict"],
        } if weakest else None,
        "summary": summary,
    }


# Mangum handler for AWS Lambda
try:
    from mangum import Mangum
    handler = Mangum(app)
except ImportError:
    pass
