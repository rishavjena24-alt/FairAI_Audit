import io
import json
import warnings
import pandas as pd
import numpy as np
import os

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from sklearn.model_selection import train_test_split, StratifiedKFold, cross_val_score
from sklearn.preprocessing import LabelEncoder
from sklearn.impute import SimpleImputer
from sklearn.metrics import accuracy_score, roc_auc_score
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.tree import DecisionTreeClassifier

from fairlearn.metrics import demographic_parity_difference, equalized_odds_difference
from fairlearn.reductions import DemographicParity, EqualizedOdds, ExponentiatedGradient
from fairlearn.postprocessing import ThresholdOptimizer

warnings.filterwarnings("ignore")

app = FastAPI(title="Unbiased AI Decision API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def encode_data(df, fit_encoders=None):
    encoders = fit_encoders or {}
    df_enc = df.copy()
    for col in df_enc.columns:
        if df_enc[col].dtype == "object":
            if col not in encoders:
                le = LabelEncoder()
                df_enc[col] = le.fit_transform(df_enc[col].astype(str))
                encoders[col] = le
            else:
                le = encoders[col]
                known = set(le.classes_)
                df_enc[col] = df_enc[col].astype(str).apply(
                    lambda x: x if x in known else le.classes_[0]
                )
                df_enc[col] = le.transform(df_enc[col])
    return df_enc, encoders


def get_model(name):
    if name == "Logistic Regression":
        return LogisticRegression(max_iter=1000, random_state=42)
    if name == "Random Forest":
        return RandomForestClassifier(n_estimators=100, random_state=42, n_jobs=-1)
    return DecisionTreeClassifier(max_depth=6, random_state=42)


def clean_df(df):
    df_c = df.copy()
    for col in df_c.columns:
        if df_c[col].dtype != "object":
            df_c[col] = pd.to_numeric(df_c[col], errors="coerce")
    num_cols = df_c.select_dtypes(include=np.number).columns
    if len(num_cols):
        df_c[num_cols] = SimpleImputer(strategy="median").fit_transform(df_c[num_cols])
    cat_cols = df_c.select_dtypes(include="object").columns
    if len(cat_cols):
        df_c[cat_cols] = SimpleImputer(strategy="most_frequent").fit_transform(df_c[cat_cols])
    return df_c


@app.post("/api/audit")
async def run_fairness_audit(
    file: UploadFile = File(...),
    target_col: str = Form(...),
    sensitive_col: str = Form(...),
    model_name: str = Form("Logistic Regression"),
    mitigation: str = Form("ExponentiatedGradient (DemographicParity)"),
    test_size_pct: int = Form(20)
):
    try:
        content = await file.read()
        df = pd.read_csv(io.BytesIO(content))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error reading CSV: {str(e)}")

    if df.empty:
        raise HTTPException(status_code=400, detail="Dataset is empty.")
        
    target_col = target_col.strip()
    sensitive_col = sensitive_col.strip()

    if target_col not in df.columns:
        raise HTTPException(status_code=400, detail=f"Target column '{target_col}' not found. Available: {list(df.columns)}")
    if sensitive_col not in df.columns:
        raise HTTPException(status_code=400, detail=f"Sensitive column '{sensitive_col}' not found. Available: {list(df.columns)}")

    feature_cols = [c for c in df.columns if c != target_col]
    df_clean = clean_df(df)

    X_raw = df_clean[feature_cols]
    y_raw = df_clean[target_col]
    test_sz = test_size_pct / 100

    try:
        X_tr_raw, X_te_raw, y_tr, y_te = train_test_split(
            X_raw, y_raw, test_size=test_sz, random_state=42, stratify=y_raw
        )
    except Exception:
        X_tr_raw, X_te_raw, y_tr, y_te = train_test_split(
            X_raw, y_raw, test_size=test_sz, random_state=42
        )

    X_tr, encoders = encode_data(X_tr_raw)
    X_te, _ = encode_data(X_te_raw, fit_encoders=encoders)

    if y_tr.dtype == "object":
        le_y = LabelEncoder()
        y_tr = le_y.fit_transform(y_tr.astype(str))
        y_te = le_y.transform(
            y_te.astype(str).apply(
                lambda x: x if x in set(le_y.classes_) else le_y.classes_[0]
            )
        )
    else:
        y_tr = y_tr.values
        y_te = y_te.values

    sens_tr = X_tr[sensitive_col].values
    sens_te = X_te[sensitive_col].values

    model = get_model(model_name)
    model.fit(X_tr, y_tr)
    y_pred = model.predict(X_te)

    acc = accuracy_score(y_te, y_pred)
    try:
        roc = roc_auc_score(y_te, model.predict_proba(X_te)[:, 1])
    except Exception:
        roc = None

    cv_scores = cross_val_score(
        get_model(model_name), X_tr, y_tr,
        cv=StratifiedKFold(5, shuffle=True, random_state=42),
        scoring="accuracy"
    )

    dpd_before = abs(float(demographic_parity_difference(y_true=y_te, y_pred=y_pred, sensitive_features=sens_te)))
    eod_before = abs(float(equalized_odds_difference(y_true=y_te, y_pred=y_pred, sensitive_features=sens_te)))

    base_est = LogisticRegression(max_iter=1000, random_state=42)
    if mitigation == "ThresholdOptimizer":
        mit = ThresholdOptimizer(estimator=base_est, constraints="demographic_parity",
                                 objective="accuracy_score", predict_method="auto")
        mit.fit(X_tr, y_tr, sensitive_features=sens_tr)
        y_mit = mit.predict(X_te, sensitive_features=sens_te)
    else:
        constraints = EqualizedOdds() if "EqualizedOdds" in mitigation else DemographicParity()
        mit = ExponentiatedGradient(estimator=base_est, constraints=constraints, max_iter=50)
        mit.fit(X_tr, y_tr, sensitive_features=sens_tr)
        y_mit = mit.predict(X_te)

    dpd_after = abs(float(demographic_parity_difference(y_true=y_te, y_pred=y_mit, sensitive_features=sens_te)))
    eod_after = abs(float(equalized_odds_difference(y_true=y_te, y_pred=y_mit, sensitive_features=sens_te)))
    acc_mit = accuracy_score(y_te, y_mit)
    fairness_score = max(0.0, 1.0 - dpd_after)

    # Calculate group rates
    groups = np.unique(sens_te)
    rates_before = [{"group": str(g), "rate": float(y_pred[sens_te == g].mean())} for g in groups]
    rates_after = [{"group": str(g), "rate": float(y_mit[sens_te == g].mean())} for g in groups]

    # Calculate feature importances
    feature_importances = []
    if hasattr(model, "feature_importances_"):
        fi = pd.Series(model.feature_importances_, index=X_tr.columns).sort_values().tail(12)
        feature_importances = [{"feature": k, "value": float(v), "is_sensitive": k == sensitive_col} for k, v in fi.items()]
    elif hasattr(model, "coef_"):
        coefs = pd.Series(model.coef_[0], index=X_tr.columns).sort_values().tail(12)
        feature_importances = [{"feature": k, "value": float(v), "is_sensitive": k == sensitive_col} for k, v in coefs.items()]

    # Group table data
    group_table = []
    overall_rate = y_pred.mean()
    for g in groups:
        mask = (sens_te == g)
        gt, gp, gm = y_te[mask], y_pred[mask], y_mit[mask]
        n = int(mask.sum())
        tpr = float((gp[gt == 1] == 1).mean()) if (gt == 1).sum() > 0 else 0.0
        fpr = float((gp[gt == 0] == 1).mean()) if (gt == 0).sum() > 0 else 0.0
        diff = abs(gp.mean() - overall_rate)
        flag = "High bias" if diff > 0.15 else ("Moderate" if diff > 0.07 else "Fair")
        group_table.append({
            "group": str(g),
            "n_test": n,
            "tpr": round(tpr, 3),
            "fpr": round(fpr, 3),
            "rate_before": round(float(gp.mean()), 3),
            "rate_after": round(float(gm.mean()), 3),
            "bias_flag": flag
        })

    return {
        "metrics": {
            "accuracy_base": float(acc),
            "accuracy_mitigated": float(acc_mit),
            "roc_auc": float(roc) if roc is not None else None,
            "cv_mean": float(cv_scores.mean()),
            "cv_std": float(cv_scores.std()),
            "dpd_before": float(dpd_before),
            "dpd_after": float(dpd_after),
            "eod_before": float(eod_before),
            "eod_after": float(eod_after),
            "fairness_score": float(fairness_score)
        },
        "charts": {
            "rates_before": rates_before,
            "rates_after": rates_after,
            "feature_importances": feature_importances,
            "cv_scores": [{"fold": f"Fold {i+1}", "score": float(s)} for i, s in enumerate(cv_scores)]
        },
        "group_table": group_table
    }

# Serve static Next.js frontend
frontend_dist = os.path.join(os.path.dirname(__file__), "..", "frontend", "out")
if os.path.exists(frontend_dist):
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    # Hugging Face Spaces defaults to 7860
    uvicorn.run(app, host="0.0.0.0", port=7860)
