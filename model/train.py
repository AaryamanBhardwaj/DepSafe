"""
Step 3: Train a RandomForestClassifier on the collected dataset.
Evaluate with accuracy, precision, recall, F1, confusion matrix.
Generate SHAP plots. Serialize model with joblib.
"""

import json
from pathlib import Path

import joblib
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import shap
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)
from sklearn.model_selection import train_test_split

BASE = Path(__file__).parent
DATASET = BASE / "dataset.csv"
MODEL_OUT = BASE / "model.joblib"
REPORT_OUT = BASE / "evaluation_report.json"
PLOTS_DIR = BASE / "plots"
PLOTS_DIR.mkdir(exist_ok=True)

FEATURE_COLS = [
    "commits_90d", "commits_365d", "commit_velocity_trend",
    "contributors_total", "contributors_90d", "bus_factor",
    "open_issues", "closed_issues_90d", "issue_response_time_median",
    "days_since_last_release", "release_frequency", "release_regularity",
    "weekly_downloads", "download_trend", "dependent_count",
    "has_readme", "has_license", "repo_stars", "repo_open_prs",
    "days_since_last_commit",
]


def clean_data(df: pd.DataFrame) -> pd.DataFrame:
    """Handle missing values and cap outliers."""
    df = df.copy()
    for col in FEATURE_COLS:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    # Cap sentinel values
    df["days_since_last_release"] = df["days_since_last_release"].clip(upper=3650)
    df["release_frequency"] = df["release_frequency"].clip(upper=3650)
    df["release_regularity"] = df["release_regularity"].clip(upper=3650)
    df["days_since_last_commit"] = df["days_since_last_commit"].clip(upper=3650)
    df["issue_response_time_median"] = df["issue_response_time_median"].clip(upper=8760)

    df[FEATURE_COLS] = df[FEATURE_COLS].fillna(0)
    return df


def main():
    print("Loading dataset...")
    df = pd.read_csv(DATASET)
    print(f"Total samples: {len(df)}")
    print(f"Label distribution:\n{df['label'].value_counts()}")

    df = clean_data(df)

    X = df[FEATURE_COLS]
    y = df["label"]

    print(f"\nClass balance: {y.value_counts().to_dict()}")
    print(f"Maintained: {(y == 1).sum()} ({(y == 1).mean():.1%})")
    print(f"Abandoned:  {(y == 0).sum()} ({(y == 0).mean():.1%})")

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    print(f"\nTrain: {len(X_train)}, Test: {len(X_test)}")

    print("\nTraining RandomForestClassifier...")
    model = RandomForestClassifier(
        n_estimators=200,
        class_weight="balanced",
        max_depth=15,
        min_samples_split=5,
        min_samples_leaf=2,
        random_state=42,
        n_jobs=-1,
    )
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    y_proba = model.predict_proba(X_test)[:, 1]

    accuracy = accuracy_score(y_test, y_pred)
    precision = precision_score(y_test, y_pred)
    recall = recall_score(y_test, y_pred)
    f1 = f1_score(y_test, y_pred)
    cm = confusion_matrix(y_test, y_pred)

    print(f"\n{'='*50}")
    print(f"EVALUATION RESULTS")
    print(f"{'='*50}")
    print(f"Accuracy:  {accuracy:.4f}")
    print(f"Precision: {precision:.4f}")
    print(f"Recall:    {recall:.4f}")
    print(f"F1 Score:  {f1:.4f}")
    print(f"\nConfusion Matrix:")
    print(f"  TN={cm[0][0]}  FP={cm[0][1]}")
    print(f"  FN={cm[1][0]}  TP={cm[1][1]}")
    print(f"\n{classification_report(y_test, y_pred, target_names=['abandoned', 'maintained'])}")

    report = {
        "dataset_size": len(df),
        "class_balance": {"maintained": int((y == 1).sum()), "abandoned": int((y == 0).sum())},
        "train_size": len(X_train),
        "test_size": len(X_test),
        "accuracy": round(accuracy, 4),
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1_score": round(f1, 4),
        "confusion_matrix": {"TN": int(cm[0][0]), "FP": int(cm[0][1]), "FN": int(cm[1][0]), "TP": int(cm[1][1])},
        "feature_importance": dict(zip(FEATURE_COLS, [round(x, 4) for x in model.feature_importances_])),
        "features": FEATURE_COLS,
    }

    REPORT_OUT.write_text(json.dumps(report, indent=2))
    print(f"\nReport saved to {REPORT_OUT}")

    # Feature importance plot
    importances = model.feature_importances_
    indices = np.argsort(importances)[::-1]
    fig, ax = plt.subplots(figsize=(10, 8))
    ax.barh(
        range(len(FEATURE_COLS)),
        importances[indices[::-1]],
        align="center",
    )
    ax.set_yticks(range(len(FEATURE_COLS)))
    ax.set_yticklabels([FEATURE_COLS[i] for i in indices[::-1]])
    ax.set_xlabel("Importance")
    ax.set_title("Random Forest Feature Importance")
    plt.tight_layout()
    fig.savefig(PLOTS_DIR / "feature_importance.png", dpi=150)
    plt.close(fig)
    print(f"Feature importance plot saved")

    # SHAP analysis
    print("\nComputing SHAP values (this may take a minute)...")
    explainer = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(X_test)

    # For binary classification, shap_values is [class_0, class_1]
    if isinstance(shap_values, list):
        shap_vals = shap_values[1]  # class 1 = maintained
    else:
        shap_vals = shap_values

    # SHAP summary plot
    fig, ax = plt.subplots(figsize=(10, 8))
    shap.summary_plot(shap_vals, X_test, feature_names=FEATURE_COLS, show=False)
    plt.tight_layout()
    plt.savefig(PLOTS_DIR / "shap_summary.png", dpi=150, bbox_inches="tight")
    plt.close("all")
    print("SHAP summary plot saved")

    # SHAP bar plot
    fig, ax = plt.subplots(figsize=(10, 8))
    shap.summary_plot(shap_vals, X_test, feature_names=FEATURE_COLS, plot_type="bar", show=False)
    plt.tight_layout()
    plt.savefig(PLOTS_DIR / "shap_bar.png", dpi=150, bbox_inches="tight")
    plt.close("all")
    print("SHAP bar plot saved")

    # Save model
    joblib.dump(model, MODEL_OUT)
    print(f"\nModel saved to {MODEL_OUT}")

    # Save feature list for serving
    meta = {
        "features": FEATURE_COLS,
        "model_type": "RandomForestClassifier",
        "n_estimators": 200,
        "training_date": pd.Timestamp.now().isoformat(),
        "dataset_size": len(df),
        "f1_score": round(f1, 4),
    }
    (BASE / "model_meta.json").write_text(json.dumps(meta, indent=2))
    print("Model metadata saved")

    print(f"\n{'='*50}")
    print("Phase 1 complete!")
    print(f"{'='*50}")
    print(f"Dataset: {len(df)} packages")
    print(f"Model F1: {f1:.4f}")
    print(f"Top 5 features:")
    for i in range(5):
        idx = indices[i]
        print(f"  {FEATURE_COLS[idx]}: {importances[idx]:.4f}")


if __name__ == "__main__":
    main()
