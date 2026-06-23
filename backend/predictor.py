"""
Model loading, inference, and SHAP explanation computation.
"""

import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import shap

import os
_lambda_root = os.environ.get("LAMBDA_TASK_ROOT", "")
if _lambda_root:
    MODEL_DIR = Path(_lambda_root) / "model"
else:
    MODEL_DIR = Path(__file__).parent.parent / "model"

FEATURE_NAMES = [
    "commits_90d", "commits_365d", "commit_velocity_trend",
    "contributors_total", "contributors_90d", "bus_factor",
    "open_issues", "closed_issues_90d", "issue_response_time_median",
    "days_since_last_release", "release_frequency", "release_regularity",
    "weekly_downloads", "download_trend", "dependent_count",
    "has_readme", "has_license", "repo_stars", "repo_open_prs",
    "days_since_last_commit",
]

_model = None
_explainer = None
_model_meta = None


def load_model(model_path: str = None):
    global _model, _explainer, _model_meta
    path = Path(model_path) if model_path else MODEL_DIR / "model.joblib"
    _model = joblib.load(path)
    _explainer = shap.TreeExplainer(_model)
    meta_path = MODEL_DIR / "model_meta.json"
    if meta_path.exists():
        _model_meta = json.loads(meta_path.read_text())


def get_model():
    if _model is None:
        load_model()
    return _model


def get_explainer():
    if _explainer is None:
        load_model()
    return _explainer


def get_model_meta() -> dict:
    if _model_meta is None:
        load_model()
    return _model_meta or {}


def predict(features: dict) -> dict:
    """
    Run model inference + SHAP on a feature dict.
    Returns health score, verdict, SHAP values, and feature breakdown.
    """
    model = get_model()
    explainer = get_explainer()

    feature_array = pd.DataFrame([[features[f] for f in FEATURE_NAMES]], columns=FEATURE_NAMES)

    proba = model.predict_proba(feature_array)[0]
    maintained_prob = float(proba[1])
    health_score = round(maintained_prob * 100, 1)

    shap_values = explainer.shap_values(feature_array)
    if isinstance(shap_values, list):
        shap_vals = np.array(shap_values[1]).flatten()
    else:
        shap_vals = np.array(shap_values).flatten()

    base_value = explainer.expected_value
    if isinstance(base_value, (list, np.ndarray)):
        base_value = float(base_value[1])
    else:
        base_value = float(base_value)

    if health_score >= 70:
        verdict = "Actively maintained — low risk"
        risk_level = "low"
    elif health_score >= 40:
        verdict = "Showing signs of decline — monitor closely"
        risk_level = "medium"
    else:
        verdict = "Likely abandoned — consider alternatives"
        risk_level = "high"

    feature_impacts = []
    for i, name in enumerate(FEATURE_NAMES):
        feature_impacts.append({
            "feature": name,
            "value": features[name],
            "shap_value": round(float(shap_vals[i]), 4),
            "impact": "positive" if float(shap_vals[i]) > 0 else "negative",
        })

    feature_impacts.sort(key=lambda x: abs(x["shap_value"]), reverse=True)

    top_positive = [f for f in feature_impacts if f["shap_value"] > 0.01][:3]
    top_negative = [f for f in feature_impacts if f["shap_value"] < -0.01][:3]

    explanation_parts = []
    if top_positive:
        strengths = ", ".join(
            f"{f['feature'].replace('_', ' ')} ({f['value']})"
            for f in top_positive
        )
        explanation_parts.append(f"Strengths: {strengths}")
    if top_negative:
        concerns = ", ".join(
            f"{f['feature'].replace('_', ' ')} ({f['value']})"
            for f in top_negative
        )
        explanation_parts.append(f"Concerns: {concerns}")

    return {
        "health_score": health_score,
        "maintained_probability": round(maintained_prob, 4),
        "verdict": verdict,
        "risk_level": risk_level,
        "explanation": ". ".join(explanation_parts) if explanation_parts else "Insufficient signal for detailed explanation.",
        "shap": {
            "base_value": round(base_value, 4),
            "feature_impacts": feature_impacts,
        },
        "features": {name: features[name] for name in FEATURE_NAMES},
    }
