import os
from pathlib import Path
from contextlib import asynccontextmanager

import joblib
import tldextract

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, field_validator

from features import extract_features


# ==========================================
# Paths
# ==========================================

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "model" / "phishing_model.joblib"


# ==========================================
# Global model
# ==========================================

model = None
feature_names = None


# ==========================================
# Load model once at startup
# ==========================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    global model, feature_names

    if not MODEL_PATH.exists():
        raise RuntimeError(
            f"Model not found at: {MODEL_PATH}"
        )

    saved = joblib.load(MODEL_PATH)

    model = saved["model"]
    feature_names = saved["features"]

    print("Phishing model loaded successfully.")

    yield

    print("API shutting down.")


# ==========================================
# FastAPI app
# ==========================================

app = FastAPI(
    title="Phishing URL Detector API",
    description="Detect whether a URL is likely phishing or legitimate.",
    version="1.0.0",
    lifespan=lifespan,
)


# ==========================================
# CORS
# ==========================================

# Local dev origins are always allowed. In production, set the
# ALLOWED_ORIGINS environment variable to your deployed frontend URL(s),
# comma-separated, e.g. "https://phishguard.vercel.app"
DEFAULT_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

EXTRA_ORIGINS = [
    origin.strip().rstrip("/")
    for origin in os.getenv("ALLOWED_ORIGINS", "").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=DEFAULT_ORIGINS + EXTRA_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==========================================
# Request model
# ==========================================

class URLRequest(BaseModel):
    url: str

    @field_validator("url")
    @classmethod
    def validate_url(cls, value: str):

        value = value.strip()

        if not value:
            raise ValueError("URL cannot be empty.")

        if len(value) > 2048:
            raise ValueError(
                "URL is too long. Maximum length is 2048 characters."
            )

        return value


# ==========================================
# Helper: generate reasons
# ==========================================

def get_reasons(url: str, features: dict) -> list[str]:
    reasons = []

    url_lower = url.lower()

    # IP address
    if features["has_ip"]:
        reasons.append("Uses an IP address instead of a normal domain")

    # Suspicious words
    suspicious_words = [
        "login",
        "verify",
        "secure",
        "account",
        "update",
        "bank",
        "confirm",
    ]

    for word in suspicious_words:
        if word in url_lower:
            reasons.append(f"Contains suspicious word '{word}'")

    # URL structure
    if features["num_subdomains"] >= 2:
        reasons.append("Contains multiple subdomains")

    if features["num_hyphens"] >= 2:
        reasons.append("Contains multiple hyphens")

    if features["num_digits"] >= 5:
        reasons.append("Contains many digits")

    if features["num_dots"] >= 4:
        reasons.append("Contains many dots")

    if features["num_params"] >= 3:
        reasons.append("Contains many URL parameters")

    if features["url_length"] >= 100:
        reasons.append("URL is unusually long")

    if features["path_length"] >= 60:
        reasons.append("URL path is unusually long")

    if not features["is_https"]:
        reasons.append("Does not use HTTPS")

    # If no obvious signals were found
    if not reasons:
        reasons.append("No obvious suspicious URL signals detected")

    return reasons[:5]


# ==========================================
# Health check
# ==========================================

@app.get("/")
def root():
    return {
        "message": "Phishing URL Detector API",
        "status": "running",
    }


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "model_loaded": model is not None,
    }


# ==========================================
# Prediction endpoint
# ==========================================

@app.post("/predict")
def predict(request: URLRequest):

    if model is None:
        raise HTTPException(
            status_code=503,
            detail="Model is not loaded."
        )

    url = request.url

    try:
        # Extract features
        features = extract_features(url)

        # Make sure feature order matches training
        feature_values = [
            features[name]
            for name in feature_names
        ]

        # Prediction
        prediction = model.predict(
            [feature_values]
        )[0]

        # Probability
        probabilities = model.predict_proba(
            [feature_values]
        )[0]

        phishing_probability = float(
            probabilities[1]
        )

        label = (
            "phishing"
            if prediction == 1
            else "legitimate"
        )

        # Reasons
        reasons = get_reasons(
            url,
            features
        )

        return {
            "url": url,
            "label": label,
            "probability": round(
                phishing_probability,
                4
            ),
            "reasons": reasons,
        }

    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Could not analyze URL: {str(e)}"
        )