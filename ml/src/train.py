"""
AI-Based Hiring Prediction System - ML Training Pipeline
========================================================
Trains multiple models, evaluates them, and exports artifacts as JSON
so the Next.js backend (TypeScript) can run inference without Python.

Outputs (in ml/model/):
  - model.json           : Production model (Random Forest trees) + preprocessor
  - metrics.json         : All model metrics, confusion matrix, ROC curve
  - feature_importance.json : Permutation importance for the production model
  - feature_engineering.json : Encoding maps, scaler params, feature list
  - eda.json             : Exploratory data analysis summaries
  - metadata.json        : Model metadata (version, training date, etc.)
"""
import json
import os
import math
import numpy as np
import pandas as pd
from datetime import datetime, timezone
from sklearn.model_selection import train_test_split, GridSearchCV, StratifiedKFold
from sklearn.preprocessing import StandardScaler
from sklearn.dummy import DummyClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.neighbors import KNeighborsClassifier
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score, roc_auc_score,
    confusion_matrix, roc_curve
)
import joblib


def _sanitize(obj):
    """Recursively replace Infinity/NaN with None so JSON is valid."""
    if isinstance(obj, dict):
        return {k: _sanitize(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_sanitize(v) for v in obj]
    if isinstance(obj, float):
        if math.isinf(obj) or math.isnan(obj):
            return None
        return obj
    if isinstance(obj, (np.floating, np.integer)):
        v = obj.item()
        if isinstance(v, float) and (math.isinf(v) or math.isnan(v)):
            return None
        return v
    return obj


def save_json(path, data):
    """Save JSON with Infinity/NaN sanitized to null."""
    with open(path, "w") as f:
        json.dump(_sanitize(data), f, indent=2)

# ----------------------------------------------------------------------
# Configuration
# ----------------------------------------------------------------------
DATASET_PATH = os.path.join(os.path.dirname(__file__), "..", "dataset", "hiring_dataset.csv")
MODEL_DIR = os.path.join(os.path.dirname(__file__), "..", "model")
RANDOM_STATE = 42
TEST_SIZE = 0.2

os.makedirs(MODEL_DIR, exist_ok=True)

# ----------------------------------------------------------------------
# 1. Load & clean data
# ----------------------------------------------------------------------
df = pd.read_csv(DATASET_PATH)
print(f"Loaded dataset: {df.shape}")

# Clean: fill missing certifications with "None"
df["Certifications"] = df["Certifications"].fillna("None").astype(str)
df["Skills"] = df["Skills"].fillna("").astype(str)

# Target mapping: Hire -> 1, Reject -> 0
df["target"] = (df["Recruiter Decision"].str.strip().str.lower() == "hire").astype(int)

# ----------------------------------------------------------------------
# 2. Feature engineering
# ----------------------------------------------------------------------
# Skill count (number of comma-separated skills)
df["Skill_Count"] = df["Skills"].apply(lambda s: max(0, len([x for x in str(s).split(",") if x.strip()])))

# Certification count (0 if "None", 1 otherwise - dataset has single cert per row)
df["Certification_Count"] = df["Certifications"].apply(lambda c: 0 if str(c).strip().lower() == "none" else 1)
df["Has_Certification"] = df["Certification_Count"]

# Education one-hot
education_categories = sorted(df["Education"].unique().tolist())
print(f"Education categories: {education_categories}")

# Job Role one-hot
job_role_categories = sorted(df["Job Role"].unique().tolist())
print(f"Job Role categories: {job_role_categories}")

# Certifications one-hot
cert_categories = sorted(df["Certifications"].unique().tolist())
print(f"Certification categories: {cert_categories}")

# Build feature matrix
def build_features(df: pd.DataFrame) -> pd.DataFrame:
    """Build feature matrix. NOTE: AI Score (0-100) is EXCLUDED because it is a
    pre-computed score that perfectly proxies the target (data leakage)."""
    feats = pd.DataFrame(index=df.index)
    feats["Experience"] = df["Experience (Years)"].astype(float)
    feats["Salary"] = df["Salary Expectation ($)"].astype(float)
    feats["Projects"] = df["Projects Count"].astype(float)
    # AI_Score intentionally excluded to avoid data leakage
    feats["Skill_Count"] = df["Skill_Count"].astype(float)
    feats["Certification_Count"] = df["Certification_Count"].astype(float)
    feats["Has_Certification"] = df["Has_Certification"].astype(float)

    # One-hot encode Education
    for cat in education_categories:
        feats[f"Education_{cat}"] = (df["Education"] == cat).astype(float)
    # One-hot encode Job Role
    for cat in job_role_categories:
        feats[f"Role_{cat}"] = (df["Job Role"] == cat).astype(float)
    # One-hot encode Certifications
    for cat in cert_categories:
        feats[f"Cert_{cat}"] = (df["Certifications"] == cat).astype(float)
    return feats

X_df = build_features(df)
y = df["target"].values
feature_names = X_df.columns.tolist()
print(f"Feature matrix: {X_df.shape}, features: {feature_names}")

# Train/test split (stratified)
X_train, X_test, y_train, y_test = train_test_split(
    X_df.values, y, test_size=TEST_SIZE, random_state=RANDOM_STATE, stratify=y
)
print(f"Train: {X_train.shape}, Test: {X_test.shape}")

# ----------------------------------------------------------------------
# 3. Preprocessing: scale numeric features (first 6 are numeric)
# ----------------------------------------------------------------------
numeric_indices = list(range(6))  # Experience, Salary, Projects, Skill_Count, Cert_Count, Has_Cert
scaler = StandardScaler()
X_train_scaled = X_train.copy()
X_test_scaled = X_test.copy()
X_train_scaled[:, numeric_indices] = scaler.fit_transform(X_train[:, numeric_indices])
X_test_scaled[:, numeric_indices] = scaler.transform(X_test[:, numeric_indices])

scaler_params = {
    "mean": scaler.mean_.tolist(),
    "scale": scaler.scale_.tolist(),
    "numeric_indices": numeric_indices,
    "numeric_names": [feature_names[i] for i in numeric_indices],
}

# ----------------------------------------------------------------------
# 4. Train multiple models
# ----------------------------------------------------------------------
models = {
    "Dummy (Most Frequent)": DummyClassifier(strategy="most_frequent", random_state=RANDOM_STATE),
    "Logistic Regression": LogisticRegression(max_iter=1000, random_state=RANDOM_STATE),
    "Decision Tree": DecisionTreeClassifier(random_state=RANDOM_STATE),
    "Random Forest": RandomForestClassifier(n_estimators=100, random_state=RANDOM_STATE),
    "Gradient Boosting": GradientBoostingClassifier(random_state=RANDOM_STATE),
    "KNN": KNeighborsClassifier(n_neighbors=5),
}

# For LR and tree-based models we use scaled features; KNN also uses scaled.
# Tree models don't strictly need scaling, but using scaled is fine for consistency.
results = {}
trained_models = {}

for name, model in models.items():
    model.fit(X_train_scaled, y_train)
    y_pred = model.predict(X_test_scaled)
    # Probability for class 1 (Hire)
    if hasattr(model, "predict_proba"):
        y_proba = model.predict_proba(X_test_scaled)[:, 1]
    elif hasattr(model, "decision_function"):
        y_proba = model.decision_function(X_test_scaled)
    else:
        y_proba = y_pred.astype(float)

    accuracy = float(accuracy_score(y_test, y_pred))
    precision = float(precision_score(y_test, y_pred, zero_division=0))
    recall = float(recall_score(y_test, y_pred, zero_division=0))
    f1 = float(f1_score(y_test, y_pred, zero_division=0))
    try:
        roc_auc = float(roc_auc_score(y_test, y_proba))
    except Exception:
        roc_auc = 0.0

    results[name] = {
        "accuracy": accuracy,
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "roc_auc": roc_auc,
    }
    trained_models[name] = model
    print(f"{name}: acc={accuracy:.4f} prec={precision:.4f} rec={recall:.4f} f1={f1:.4f} auc={roc_auc:.4f}")

# ----------------------------------------------------------------------
# 5. Hyperparameter tuning for Random Forest (the strongest candidate)
# ----------------------------------------------------------------------
print("\n--- Hyperparameter tuning for Random Forest ---")
param_grid = {
    "n_estimators": [100, 200],
    "max_depth": [None, 10, 20],
    "min_samples_split": [2, 5],
    "min_samples_leaf": [1, 2],
}
cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=RANDOM_STATE)
rf_grid = GridSearchCV(
    RandomForestClassifier(random_state=RANDOM_STATE),
    param_grid, cv=cv, scoring="roc_auc", n_jobs=-1,
)
rf_grid.fit(X_train_scaled, y_train)
print(f"Best RF params: {rf_grid.best_params_}")
print(f"Best RF CV ROC-AUC: {rf_grid.best_score_:.4f}")

best_rf = rf_grid.best_estimator_
y_pred_rf = best_rf.predict(X_test_scaled)
y_proba_rf = best_rf.predict_proba(X_test_scaled)[:, 1]
rf_metrics = {
    "accuracy": float(accuracy_score(y_test, y_pred_rf)),
    "precision": float(precision_score(y_test, y_pred_rf, zero_division=0)),
    "recall": float(recall_score(y_test, y_pred_rf, zero_division=0)),
    "f1": float(f1_score(y_test, y_pred_rf, zero_division=0)),
    "roc_auc": float(roc_auc_score(y_test, y_proba_rf)),
}
print(f"Tuned RF: acc={rf_metrics['accuracy']:.4f} prec={rf_metrics['precision']:.4f} "
      f"rec={rf_metrics['recall']:.4f} f1={rf_metrics['f1']:.4f} auc={rf_metrics['roc_auc']:.4f}")

# Update results with tuned RF
results["Random Forest (Tuned)"] = rf_metrics
trained_models["Random Forest (Tuned)"] = best_rf

# ----------------------------------------------------------------------
# 6. Select production model (best ROC-AUC, prefer tree-based for explainability)
# ----------------------------------------------------------------------
# Use tuned Random Forest as production model
production_model_name = "Random Forest (Tuned)"
production_model = best_rf

# ----------------------------------------------------------------------
# 7. Confusion matrix & ROC curve for production model
# ----------------------------------------------------------------------
cm = confusion_matrix(y_test, y_pred_rf)
# cm = [[TN, FP], [FN, TP]] for binary with labels [0, 1]
tn, fp, fn, tp = cm.ravel()
confusion = {
    "tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp),
    "labels": ["Reject", "Hire"],
    "matrix": [[int(tn), int(fp)], [int(fn), int(tp)]],
}

fpr, tpr, thresholds = roc_curve(y_test, y_proba_rf)
roc_curve_data = {
    "fpr": fpr.tolist(),
    "tpr": tpr.tolist(),
    "thresholds": thresholds.tolist(),
    "auc": rf_metrics["roc_auc"],
}

# ----------------------------------------------------------------------
# 8. Feature importance (permutation importance on test set)
# ----------------------------------------------------------------------
from sklearn.inspection import permutation_importance
perm = permutation_importance(
    production_model, X_test_scaled, y_test,
    n_repeats=10, random_state=RANDOM_STATE, scoring="roc_auc"
)

feature_importance = []
for i, fname in enumerate(feature_names):
    feature_importance.append({
        "feature": fname,
        "importance_mean": float(perm.importances_mean[i]),
        "importance_std": float(perm.importances_std[i]),
    })
feature_importance.sort(key=lambda x: x["importance_mean"], reverse=True)

# Also get RF built-in feature importance (Gini)
gini_importance = []
for i, fname in enumerate(feature_names):
    gini_importance.append({
        "feature": fname,
        "importance": float(production_model.feature_importances_[i]),
    })
gini_importance.sort(key=lambda x: x["importance"], reverse=True)

# ----------------------------------------------------------------------
# 9. Export production model (Random Forest) as JSON
# ----------------------------------------------------------------------
def tree_to_dict(tree) -> dict:
    """Convert sklearn DecisionTree to JSON-serializable dict."""
    t = tree.tree_
    children_left = t.children_left
    children_right = t.children_right
    feature = t.feature
    threshold = t.threshold
    value = t.value

    def build_node(node_id: int) -> dict:
        if children_left[node_id] == children_right[node_id]:  # leaf
            # value shape: (1, n_classes)
            v = value[node_id][0]
            total = float(sum(v))
            if total > 0:
                probs = [float(x) / total for x in v]
            else:
                probs = [0.5, 0.5]
            return {"leaf": True, "value": probs, "count": int(total)}
        return {
            "leaf": False,
            "feature": int(feature[node_id]),
            "threshold": float(threshold[node_id]),
            "left": build_node(int(children_left[node_id])),
            "right": build_node(int(children_right[node_id])),
        }

    return build_node(0)

trees_json = [tree_to_dict(est) for est in production_model.estimators_]
classes = [int(c) for c in production_model.classes_.tolist()]

model_artifact = {
    "model_type": "RandomForest",
    "n_estimators": int(production_model.n_estimators),
    "classes": classes,
    "class_labels": ["Reject", "Hire"],
    "trees": trees_json,
    "feature_names": feature_names,
    "scaler": scaler_params,
    "categorical_encodings": {
        "Education": education_categories,
        "Job Role": job_role_categories,
        "Certifications": cert_categories,
    },
    "feature_engineering": {
        "Skill_Count": "Count of comma-separated skills",
        "Certification_Count": "0 if Certifications == 'None' else 1",
        "Has_Certification": "Same as Certification_Count",
    },
}

save_json(os.path.join(MODEL_DIR, "model.json"), model_artifact)
print(f"\nSaved model.json ({len(trees_json)} trees)")

# Save joblib versions too (for reference)
joblib.dump(production_model, os.path.join(MODEL_DIR, "hiring_model.pkl"))
joblib.dump(scaler, os.path.join(MODEL_DIR, "preprocessor.pkl"))

# ----------------------------------------------------------------------
# 10. Export metrics, confusion, ROC, feature importance
# ----------------------------------------------------------------------
metrics_artifact = {
    "production_model": production_model_name,
    "all_models": results,
    "confusion_matrix": confusion,
    "roc_curve": roc_curve_data,
    "best_params": rf_grid.best_params_,
    "cv_best_score": float(rf_grid.best_score_),
    "test_size": int(X_test.shape[0]),
    "train_size": int(X_train.shape[0]),
}
save_json(os.path.join(MODEL_DIR, "metrics.json"), metrics_artifact)
print("Saved metrics.json")

feature_importance_artifact = {
    "permutation_importance": feature_importance,
    "gini_importance": gini_importance,
    "feature_names": feature_names,
}
save_json(os.path.join(MODEL_DIR, "feature_importance.json"), feature_importance_artifact)
print("Saved feature_importance.json")

# Feature engineering artifact (used by TS prediction engine)
fe_artifact = {
    "feature_names": feature_names,
    "numeric_indices": numeric_indices,
    "numeric_names": [feature_names[i] for i in numeric_indices],
    "scaler": scaler_params,
    "categorical_encodings": {
        "Education": education_categories,
        "Job Role": job_role_categories,
        "Certifications": cert_categories,
    },
    "feature_engineering": model_artifact["feature_engineering"],
}
save_json(os.path.join(MODEL_DIR, "feature_engineering.json"), fe_artifact)
print("Saved feature_engineering.json")

# ----------------------------------------------------------------------
# 11. EDA summaries
# ----------------------------------------------------------------------
# Aggregate skills frequency
all_skills = []
for s in df["Skills"]:
    all_skills.extend([x.strip() for x in str(s).split(",") if x.strip()])
skill_counts = pd.Series(all_skills).value_counts().to_dict()

# Hiring by role
hiring_by_role = df.groupby("Job Role")["target"].agg(["count", "sum", "mean"]).reset_index()
hiring_by_role_dict = [
    {"role": r["Job Role"], "total": int(r["count"]), "hired": int(r["sum"]), "hire_rate": float(r["mean"])}
    for _, r in hiring_by_role.iterrows()
]

# Hiring by education
hiring_by_edu = df.groupby("Education")["target"].agg(["count", "sum", "mean"]).reset_index()
hiring_by_edu_dict = [
    {"education": r["Education"], "total": int(r["count"]), "hired": int(r["sum"]), "hire_rate": float(r["mean"])}
    for _, r in hiring_by_edu.iterrows()
]

# Hiring by certification
hiring_by_cert = df.groupby("Certifications")["target"].agg(["count", "sum", "mean"]).reset_index()
hiring_by_cert_dict = [
    {"certification": r["Certifications"], "total": int(r["count"]), "hired": int(r["sum"]), "hire_rate": float(r["mean"])}
    for _, r in hiring_by_cert.iterrows()
]

# Experience distribution
exp_bins = [0, 2, 5, 8, 11]
exp_labels = ["0-2", "3-5", "6-8", "9-10"]
df["ExpRange"] = pd.cut(df["Experience (Years)"], bins=exp_bins, labels=exp_labels, right=False, include_lowest=True)
exp_dist = df.groupby("ExpRange", observed=False)["target"].agg(["count", "sum", "mean"]).reset_index()
exp_dist_dict = [
    {"range": str(r["ExpRange"]), "total": int(r["count"]), "hired": int(r["sum"]), "hire_rate": float(r["mean"])}
    for _, r in exp_dist.iterrows()
]

# Salary distribution by hire/reject
salary_stats = {
    "overall": {"mean": float(df["Salary Expectation ($)"].mean()), "median": float(df["Salary Expectation ($)"].median()), "std": float(df["Salary Expectation ($)"].std())},
    "hired": {"mean": float(df[df["target"] == 1]["Salary Expectation ($)"].mean()), "median": float(df[df["target"] == 1]["Salary Expectation ($)"].median()), "std": float(df[df["target"] == 1]["Salary Expectation ($)"].std())},
    "rejected": {"mean": float(df[df["target"] == 0]["Salary Expectation ($)"].mean()), "median": float(df[df["target"] == 0]["Salary Expectation ($)"].median()), "std": float(df[df["target"] == 0]["Salary Expectation ($)"].std())},
}

# Projects vs hiring
proj_by_hire = df.groupby("target")["Projects Count"].agg(["mean", "median", "std"]).to_dict()

# Certifications vs hiring (count of certs)
cert_by_hire = df.groupby("target")["Certification_Count"].agg(["mean", "median"]).to_dict()

eda_artifact = {
    "total_records": int(len(df)),
    "target_distribution": {
        "Hire": int((df["target"] == 1).sum()),
        "Reject": int((df["target"] == 0).sum()),
    },
    "education_counts": df["Education"].value_counts().to_dict(),
    "job_role_counts": df["Job Role"].value_counts().to_dict(),
    "certification_counts": df["Certifications"].value_counts().to_dict(),
    "skill_counts": skill_counts,
    "hiring_by_role": hiring_by_role_dict,
    "hiring_by_education": hiring_by_edu_dict,
    "hiring_by_certification": hiring_by_cert_dict,
    "experience_distribution": exp_dist_dict,
    "salary_stats": salary_stats,
    "projects_by_hire": {k: {kk: float(vv) for kk, vv in v.items()} for k, v in proj_by_hire.items()},
    "certification_count_by_hire": {k: {kk: float(vv) for kk, vv in v.items()} for k, v in cert_by_hire.items()},
    "experience_stats": {
        "mean": float(df["Experience (Years)"].mean()),
        "median": float(df["Experience (Years)"].median()),
        "std": float(df["Experience (Years)"].std()),
        "min": int(df["Experience (Years)"].min()),
        "max": int(df["Experience (Years)"].max()),
    },
    "projects_stats": {
        "mean": float(df["Projects Count"].mean()),
        "median": float(df["Projects Count"].median()),
        "std": float(df["Projects Count"].std()),
    },
    "ai_score_stats": {
        "mean": float(df["AI Score (0-100)"].mean()),
        "median": float(df["AI Score (0-100)"].median()),
        "std": float(df["AI Score (0-100)"].std()),
    },
}
save_json(os.path.join(MODEL_DIR, "eda.json"), eda_artifact)
print("Saved eda.json")

# ----------------------------------------------------------------------
# 12. Metadata
# ----------------------------------------------------------------------
metadata = {
    "model_name": "Random Forest",
    "model_version": "1.0.0",
    "production_model": production_model_name,
    "training_date": datetime.now(timezone.utc).isoformat(),
    "dataset_size": int(len(df)),
    "training_samples": int(X_train.shape[0]),
    "test_samples": int(X_test.shape[0]),
    "features_count": int(len(feature_names)),
    "features": feature_names,
    "target": "Recruiter Decision (Hire=1, Reject=0)",
    "training_methodology": "Stratified 80/20 split + 5-fold StratifiedKFold cross-validation for hyperparameter tuning (GridSearchCV over n_estimators, max_depth, min_samples_split, min_samples_leaf).",
    "cross_validation": "5-fold StratifiedKFold, scoring=roc_auc",
    "best_params": rf_grid.best_params_,
    "scaler": "StandardScaler applied to numeric features (Experience, Salary, Projects, Skill_Count, Certification_Count, Has_Certification)",
    "categorical_encoding": "One-hot encoding for Education, Job Role, Certifications",
    "performance": rf_metrics,
    "responsible_ai_warning": "This prediction is an AI-generated statistical estimate and should not be used as the sole basis for an employment decision.",
    "excluded_features": ["Name", "Resume_ID", "AI Score (0-100)"],
    "exclusion_reasons": {
        "Name": "Personally identifiable, not predictive",
        "Resume_ID": "Identifier only, not predictive",
        "AI Score (0-100)": "Pre-computed score that perfectly proxies the target (data leakage)",
    },
    "ethical_notes": [
        "No protected attributes (gender, race, age, etc.) are used as predictive variables.",
        "Name and Resume_ID are explicitly excluded from model features.",
        "Predictions are decision-support only; human oversight is required.",
    ],
}
save_json(os.path.join(MODEL_DIR, "metadata.json"), metadata)
print("Saved metadata.json")

print("\n=== ML Pipeline Complete ===")
print(f"All artifacts saved to: {MODEL_DIR}")
print(f"Production model: {production_model_name}")
print(f"Production ROC-AUC: {rf_metrics['roc_auc']:.4f}")
