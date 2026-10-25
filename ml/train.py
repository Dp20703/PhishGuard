import re
import sys
from pathlib import Path

import joblib
import pandas as pd

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    classification_report,
    confusion_matrix,
    precision_score,
    recall_score,
    f1_score,
)

# ==========================================
# Paths (work from any directory)
# ==========================================

ROOT = Path(__file__).resolve().parent.parent
BACKEND_DIR = ROOT / "backend"
DATA_PATH = ROOT / "ml" / "data" / "urlset.csv"
MODEL_PATH = BACKEND_DIR / "model" / "phishing_model.joblib"

# Same import style as backend/main.py
sys.path.insert(0, str(BACKEND_DIR))
from features import extract_features  # noqa: E402


# ==========================================
# 1. Load dataset
# ==========================================

df = pd.read_csv(DATA_PATH, on_bad_lines="skip", dtype="str")
print("Original shape:", df.shape)


# ==========================================
# 2. Clean dataset
# ==========================================

df = df.dropna(subset=["domain", "label"])
df = df.drop_duplicates(subset=["domain"])
df["label"] = df["label"].astype(float).astype(int)

print("After cleaning:", df.shape)
print("\nLabel distribution:")
print(df["label"].value_counts())


# ==========================================
# 3. Split first, then build features
# ==========================================

df = df.reset_index(drop=True)

train_df, test_df = train_test_split(
    df, test_size=0.20, random_state=42, stratify=df["label"]
)

print("\nTraining samples:", len(train_df))
print("Testing samples:", len(test_df))


# ==========================================
# 4. Remove dataset shortcuts
# ==========================================
# The dataset has two accidental shortcuts that make real sites look bad:
#   - bare homepages ("example.com/") are ~0.3% of legitimate URLs but
#     ~8.6% of phishing URLs  -> model learns "no path = phishing"
#   - legitimate URLs almost always start with "www."
#     -> model learns "no www = phishing"
# To remove them, every training URL also gets variants with the path
# removed and/or "www." added/removed, all with the SAME label. Now these
# traits say nothing about the class, and the model has to judge the
# actual structure of the host and URL.

def strip_scheme(url: str) -> str:
    return re.sub(r"^[a-zA-Z][a-zA-Z0-9+.\-]*://", "", url.strip())


def homepage_variant(url: str) -> str:
    url = strip_scheme(url)
    host = re.split(r"[/?#]", url, maxsplit=1)[0]
    return host + "/"


def toggle_www(url: str) -> str:
    url = strip_scheme(url)
    return url[4:] if url.lower().startswith("www.") else "www." + url


def build_features(frame: pd.DataFrame) -> pd.DataFrame:
    return pd.DataFrame(
        frame["domain"].astype(str).apply(extract_features).tolist()
    )


def with_variants(frame: pd.DataFrame) -> pd.DataFrame:
    """Original rows + homepage, www-toggled and homepage+www-toggled copies."""
    parts = [frame]
    for fn in (
        homepage_variant,
        toggle_www,
        lambda u: toggle_www(homepage_variant(u)),
    ):
        v = frame.copy()
        v["domain"] = v["domain"].astype(str).map(fn)
        parts.append(v)
    out = pd.concat(parts, ignore_index=True)
    return out.drop_duplicates(subset=["domain", "label"])


print("\nExtracting URL features...")

aug_train = with_variants(train_df)

X_train = build_features(aug_train)
y_train = aug_train["label"].reset_index(drop=True)

# Test sets: original URLs, and their homepage-only versions
X_test = build_features(test_df)
y_test = test_df["label"].reset_index(drop=True)

home_test = test_df.copy()
home_test["domain"] = home_test["domain"].astype(str).map(homepage_variant)
X_test_home = build_features(home_test)

# Drop features that never vary (e.g. is_https: dataset has no scheme)
constant_cols = [c for c in X_train.columns if X_train[c].nunique() <= 1]
if constant_cols:
    print("Dropping constant features:", constant_cols)
    X_train = X_train.drop(columns=constant_cols)
    X_test = X_test.drop(columns=constant_cols)
    X_test_home = X_test_home.drop(columns=constant_cols)

X = X_train  # used below for feature names
print("Features:", X.columns.tolist())
print("Training rows (with homepage variants):", len(X_train))


# ==========================================
# 5. Logistic Regression
# ==========================================

logistic_model = Pipeline([
    ("scaler", StandardScaler()),
    ("model", LogisticRegression(max_iter=1000, random_state=42)),
])
logistic_model.fit(X_train, y_train)
logistic_pred = logistic_model.predict(X_test)


# ==========================================
# 6. Random Forest (size-limited)
# ==========================================

random_forest = RandomForestClassifier(
    n_estimators=100,
    max_depth=20,
    min_samples_leaf=2,
    random_state=42,
    n_jobs=-1,
)
random_forest.fit(X_train, y_train)
rf_pred = random_forest.predict(X_test)


# ==========================================
# 7. Evaluation
# ==========================================

def evaluate_model(name, y_true, y_pred):
    precision = precision_score(y_true, y_pred)
    recall = recall_score(y_true, y_pred)
    f1 = f1_score(y_true, y_pred)

    print("\n" + "=" * 50)
    print(name)
    print("=" * 50)
    print(f"Precision: {precision:.4f}")
    print(f"Recall:    {recall:.4f}")
    print(f"F1 Score:  {f1:.4f}")

    print("\nClassification Report:")
    print(classification_report(
        y_true, y_pred, target_names=["Legitimate", "Phishing"]
    ))

    print("Confusion Matrix:")
    print(confusion_matrix(y_true, y_pred))

    return {"precision": precision, "recall": recall, "f1": f1}


logistic_results = evaluate_model("Logistic Regression", y_test, logistic_pred)
rf_results = evaluate_model("Random Forest", y_test, rf_pred)


# ==========================================
# 8. Compare and select best model
# ==========================================

print("\n" + "=" * 50)
print("MODEL COMPARISON")
print("=" * 50)
print(f"Logistic Regression F1: {logistic_results['f1']:.4f}")
print(f"Random Forest F1:       {rf_results['f1']:.4f}")

if rf_results["f1"] > logistic_results["f1"]:
    best_model, best_model_name = random_forest, "Random Forest"
else:
    best_model, best_model_name = logistic_model, "Logistic Regression"

print(f"\nBest model: {best_model_name}")

print("\nHomepage-only test (host + '/'):")
for name, m in [("Logistic Regression", logistic_model), ("Random Forest", random_forest)]:
    print(f"  {name} F1: {f1_score(y_test, m.predict(X_test_home)):.4f}")


# ==========================================
# 9. Random Forest feature importance
# ==========================================

print("\n" + "=" * 50)
print("RANDOM FOREST FEATURE IMPORTANCE")
print("=" * 50)

importance = pd.DataFrame({
    "feature": X.columns,
    "importance": random_forest.feature_importances_,
}).sort_values("importance", ascending=False)

print(importance.to_string(index=False))


# ==========================================
# 10. Save best model (compressed)
# ==========================================

MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)

joblib.dump(
    {"model": best_model, "features": list(X.columns)},
    MODEL_PATH,
    compress=3,
)

size_mb = MODEL_PATH.stat().st_size / (1024 * 1024)
print(f"\nModel saved to: {MODEL_PATH} ({size_mb:.1f} MB)")
