"""
NS-Acad ML Service — Real Python ML Models
==========================================
Flask API serving trained scikit-learn & XGBoost models for:
  1. Student Performance Prediction (Random Forest + XGBoost ensemble)
  2. At-Risk Student Detection (classification)
  3. NIRF-Style Department Scoring
  4. Feature Importance / Explainability

Run: python app.py
API: http://localhost:5001
"""

import os
import json
import numpy as np
import pandas as pd
from flask import Flask, request, jsonify
from flask_cors import CORS

# ── ML imports ────────────────────────────────────────────────────────────────
from sklearn.ensemble import RandomForestRegressor, RandomForestClassifier, GradientBoostingRegressor
from sklearn.linear_model import LinearRegression
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.metrics import (
    mean_squared_error, r2_score, mean_absolute_error,
    accuracy_score, classification_report, confusion_matrix
)
from xgboost import XGBRegressor, XGBClassifier
import lightgbm as lgb
import joblib
import warnings
warnings.filterwarnings('ignore')

app = Flask(__name__)
CORS(app)

def to_native(obj):
    """Recursively convert numpy types to native Python for JSON serialization."""
    if isinstance(obj, dict):
        return {k: to_native(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [to_native(v) for v in obj]
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating,)):
        return float(obj)
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    if isinstance(obj, np.bool_):
        return bool(obj)
    return obj

MODEL_DIR = os.path.join(os.path.dirname(__file__), 'trained_models')
os.makedirs(MODEL_DIR, exist_ok=True)


# ══════════════════════════════════════════════════════════════════════════════
# HELPER: Generate synthetic training data (simulating historical records)
# In production, this would come from the MongoDB database
# ══════════════════════════════════════════════════════════════════════════════
def generate_training_data(n_students=500):
    """Generate realistic synthetic student performance data for training."""
    np.random.seed(42)

    # Simulate different student ability levels
    ability = np.random.beta(5, 3, n_students)  # Skewed toward higher ability

    # Assessment scores influenced by ability + noise
    tms_marks = np.clip(ability * 50 + np.random.normal(0, 8, n_students), 0, 50)
    tca_marks = np.clip(ability * 40 + np.random.normal(0, 6, n_students), 0, 40)
    attendance = np.clip(ability * 30 + np.random.normal(65, 12, n_students), 0, 100)
    assignments = np.clip(ability * 25 + np.random.normal(0, 5, n_students), 0, 25)
    lab_marks = np.clip(ability * 30 + np.random.normal(0, 5, n_students), 0, 30)

    # End-sem is a combination of ability + mid-sem correlation + noise
    tes_marks = np.clip(
        0.3 * tms_marks + 0.2 * tca_marks + 0.1 * attendance +
        0.15 * assignments + 0.1 * lab_marks +
        ability * 20 + np.random.normal(0, 5, n_students),
        0, 100
    )

    # Performance category
    total_pct = (tms_marks / 50 + tca_marks / 40 + tes_marks / 100) / 3 * 100
    categories = pd.cut(total_pct, bins=[0, 40, 60, 75, 100],
                        labels=['At-Risk', 'Average', 'Good', 'Excellent'])

    df = pd.DataFrame({
        'tms_marks': tms_marks,
        'tca_marks': tca_marks,
        'attendance': attendance,
        'assignments': assignments,
        'lab_marks': lab_marks,
        'tes_marks': tes_marks,
        'total_percentage': total_pct,
        'category': categories,
    })
    return df


# ══════════════════════════════════════════════════════════════════════════════
# MODEL TRAINING
# ══════════════════════════════════════════════════════════════════════════════
class PerformancePredictor:
    """Ensemble model for student performance prediction."""

    def __init__(self):
        self.rf_model = RandomForestRegressor(n_estimators=100, max_depth=10, random_state=42)
        self.xgb_model = XGBRegressor(n_estimators=100, max_depth=6, learning_rate=0.1, random_state=42)
        self.gb_model = GradientBoostingRegressor(n_estimators=100, max_depth=5, random_state=42)
        self.lr_model = LinearRegression()
        self.scaler = StandardScaler()
        self.classifier = RandomForestClassifier(n_estimators=100, max_depth=8, random_state=42)
        self.xgb_classifier = XGBClassifier(n_estimators=100, max_depth=6, random_state=42, use_label_encoder=False, eval_metric='mlogloss')
        self.label_encoder = LabelEncoder()
        self.is_trained = False
        self.metrics = {}

    def train(self, df):
        """Train all models on the dataset."""
        features = ['tms_marks', 'tca_marks', 'attendance', 'assignments', 'lab_marks']
        X = df[features].values
        y_reg = df['tes_marks'].values
        y_cat = self.label_encoder.fit_transform(df['category'].values)

        # Scale features
        X_scaled = self.scaler.fit_transform(X)

        # Split data
        X_train, X_test, y_train, y_test = train_test_split(X_scaled, y_reg, test_size=0.2, random_state=42)
        _, _, y_cat_train, y_cat_test = train_test_split(X_scaled, y_cat, test_size=0.2, random_state=42)

        # ── Train regression models ──
        self.rf_model.fit(X_train, y_train)
        self.xgb_model.fit(X_train, y_train)
        self.gb_model.fit(X_train, y_train)
        self.lr_model.fit(X_train, y_train)

        # ── Train classification models ──
        self.classifier.fit(X_train, y_cat_train)
        self.xgb_classifier.fit(X_train, y_cat_train)

        # ── Evaluate ──
        models = {
            'Random Forest': self.rf_model,
            'XGBoost': self.xgb_model,
            'Gradient Boosting': self.gb_model,
            'Linear Regression': self.lr_model,
        }

        self.metrics = {}
        for name, model in models.items():
            preds = model.predict(X_test)
            cv_scores = cross_val_score(model, X_scaled, y_reg, cv=5, scoring='r2')
            self.metrics[name] = {
                'r2': float(round(r2_score(y_test, preds), 4)),
                'rmse': float(round(np.sqrt(mean_squared_error(y_test, preds)), 4)),
                'mae': float(round(mean_absolute_error(y_test, preds), 4)),
                'cv_r2_mean': float(round(cv_scores.mean(), 4)),
                'cv_r2_std': float(round(cv_scores.std(), 4)),
            }

        # Classification metrics
        cat_preds_rf = self.classifier.predict(X_test)
        cat_preds_xgb = self.xgb_classifier.predict(X_test)
        self.metrics['RF Classifier'] = {'accuracy': float(round(accuracy_score(y_cat_test, cat_preds_rf), 4))}
        self.metrics['XGB Classifier'] = {'accuracy': float(round(accuracy_score(y_cat_test, cat_preds_xgb), 4))}

        # Feature importance
        self.feature_importance = {
            'Random Forest': dict(zip(features, [float(round(x, 4)) for x in self.rf_model.feature_importances_])),
            'XGBoost': dict(zip(features, [float(round(x, 4)) for x in self.xgb_model.feature_importances_])),
            'Gradient Boosting': dict(zip(features, [float(round(x, 4)) for x in self.gb_model.feature_importances_])),
        }

        self.is_trained = True
        print("[OK] All models trained successfully!")
        for name, m in self.metrics.items():
            print(f"   {name}: {m}")

        return self.metrics

    def predict(self, student_data):
        """Predict using ensemble of all models."""
        if not self.is_trained:
            raise ValueError("Models not trained yet")

        X = np.array(student_data).reshape(1, -1) if len(np.array(student_data).shape) == 1 else np.array(student_data)
        X_scaled = self.scaler.transform(X)

        results = []
        for i in range(len(X_scaled)):
            rf_pred = self.rf_model.predict(X_scaled[i:i+1])[0]
            xgb_pred = self.xgb_model.predict(X_scaled[i:i+1])[0]
            gb_pred = self.gb_model.predict(X_scaled[i:i+1])[0]
            lr_pred = self.lr_model.predict(X_scaled[i:i+1])[0]

            # Ensemble: weighted average
            ensemble_pred = 0.35 * rf_pred + 0.35 * xgb_pred + 0.2 * gb_pred + 0.1 * lr_pred

            # Classification
            cat_rf = self.label_encoder.inverse_transform(self.classifier.predict(X_scaled[i:i+1]))[0]
            cat_xgb = self.label_encoder.inverse_transform(self.xgb_classifier.predict(X_scaled[i:i+1]))[0]

            # Confidence (probability)
            proba_rf = self.classifier.predict_proba(X_scaled[i:i+1])[0]
            confidence = round(float(max(proba_rf)) * 100, 1)

            results.append({
                'predictions': {
                    'random_forest': round(float(rf_pred), 2),
                    'xgboost': round(float(xgb_pred), 2),
                    'gradient_boosting': round(float(gb_pred), 2),
                    'linear_regression': round(float(lr_pred), 2),
                    'ensemble': round(float(ensemble_pred), 2),
                },
                'risk_classification': {
                    'random_forest': cat_rf,
                    'xgboost': cat_xgb,
                    'confidence': confidence,
                },
            })
        return results


# ══════════════════════════════════════════════════════════════════════════════
# NIRF SCORING MODEL (Ensemble: XGBoost + LightGBM + Random Forest)
# ══════════════════════════════════════════════════════════════════════════════
class NIRFPredictor:
    """Predicts NIRF-style institutional ranking score using an ensemble model."""

    def __init__(self):
        self.models = {
            'xgboost': XGBRegressor(n_estimators=200, learning_rate=0.05, max_depth=6, random_state=42),
            'lightgbm': lgb.LGBMRegressor(n_estimators=200, learning_rate=0.05, max_depth=6, random_state=42, verbose=-1),
            'random_forest': RandomForestRegressor(n_estimators=200, max_depth=10, min_samples_split=5, random_state=42)
        }
        self.weights = {'xgboost': 0.4, 'lightgbm': 0.4, 'random_forest': 0.2}
        self.scaler = StandardScaler()
        self.is_trained = False
        self.feature_importance = None
        self.metrics = {}

    def generate_nirf_data(self, n=300):
        """Generate synthetic NIRF institutional data."""
        np.random.seed(42)
        fsr = np.random.uniform(10, 30, n)              # Faculty-Student Ratio
        phd_faculty = np.random.uniform(30, 100, n)       # % PhD faculty
        publications = np.random.randint(5, 500, n)       # Research publications
        citations = publications * np.random.uniform(1, 10, n)
        patents = np.random.randint(0, 50, n)
        placement_rate = np.random.uniform(30, 98, n)     # %
        median_salary = np.random.uniform(3, 25, n)       # in LPA
        diversity = np.random.uniform(10, 60, n)          # % diversity
        expenditure = np.random.uniform(10, 200, n)       # Cr

        # NIRF score (weighted combination)
        tlr = (fsr / 30 * 20 + phd_faculty / 100 * 10) * (100 / 30)
        rp = (publications / 500 * 15 + citations / 5000 * 10 + patents / 50 * 5) * (100 / 30)
        go = (placement_rate / 100 * 15 + median_salary / 25 * 5) * (100 / 20)
        oi = diversity / 60 * 100
        pr = np.random.uniform(20, 80, n)

        nirf_score = 0.3 * tlr + 0.3 * rp + 0.2 * go + 0.1 * oi + 0.1 * pr
        nirf_score = np.clip(nirf_score + np.random.normal(0, 3, n), 0, 100)

        return pd.DataFrame({
            'faculty_student_ratio': fsr, 'phd_faculty_pct': phd_faculty,
            'publications': publications, 'citations': citations,
            'patents': patents, 'placement_rate': placement_rate,
            'median_salary_lpa': median_salary, 'diversity_pct': diversity,
            'expenditure_cr': expenditure, 'nirf_score': nirf_score,
        })

    def train(self):
        df = self.generate_nirf_data()
        self.feature_names = ['faculty_student_ratio', 'phd_faculty_pct', 'publications',
                     'citations', 'patents', 'placement_rate', 'median_salary_lpa',
                     'diversity_pct', 'expenditure_cr']
        X = df[self.feature_names].values
        y = df['nirf_score'].values
        X_scaled = self.scaler.fit_transform(X)
        X_train, X_test, y_train, y_test = train_test_split(X_scaled, y, test_size=0.2, random_state=42)

        importance_dict = {}
        for name, model in self.models.items():
            model.fit(X_train, y_train)
            if hasattr(model, 'feature_importances_'):
                importance_dict[name] = model.feature_importances_

        # Calculate weighted feature importance
        avg_importance = np.average(
            list(importance_dict.values()),
            axis=0,
            weights=[self.weights[k] for k in importance_dict.keys()]
        )
        self.feature_importance = dict(zip(self.feature_names, [float(round(x, 4)) for x in avg_importance]))

        # Calculate metrics using ensemble predictions
        preds = self.predict_raw(X_test)
        self.metrics = {
            'r2': round(r2_score(y_test, preds), 4),
            'rmse': round(np.sqrt(mean_squared_error(y_test, preds)), 4),
        }
        self.is_trained = True
        print(f"[OK] NIRF Ensemble model trained -- R2: {self.metrics['r2']}, RMSE: {self.metrics['rmse']}")
        joblib.dump(self, os.path.join(MODEL_DIR, 'nirf_predictor.pkl'))

    def predict_raw(self, X):
        predictions = np.zeros(len(X))
        for name, model in self.models.items():
            predictions += model.predict(X) * self.weights[name]
        return predictions

    def predict(self, data):
        if not self.is_trained:
            raise ValueError("Model not trained")
        X = np.array([[
            data.get('faculty_student_ratio', 15),
            data.get('phd_faculty_pct', 70),
            data.get('publications', 100),
            data.get('citations', 500),
            data.get('patents', 10),
            data.get('placement_rate', 75),
            data.get('median_salary_lpa', 8),
            data.get('diversity_pct', 30),
            data.get('expenditure_cr', 50),
        ]])
        X_scaled = self.scaler.transform(X)
        
        # Collect individual predictions for confidence/std
        ind_preds = []
        for name, model in self.models.items():
            ind_preds.append(model.predict(X_scaled)[0])
            
        score = float(self.predict_raw(X_scaled)[0])
        std_dev = float(np.std(ind_preds))
        
        lower_bound = max(0, score - 2 * std_dev)
        upper_bound = min(100, score + 2 * std_dev)

        band = '1-50' if score >= 70 else '51-100' if score >= 50 else '101-150' if score >= 35 else '151-200'
        
        # Recommendations based on data
        recs = []
        if data.get('publications', 0) < 150: recs.append("Increase research publications")
        if data.get('phd_faculty_pct', 0) < 50: recs.append("Enhance faculty quality (recruit PhDs)")
        if data.get('expenditure_cr', 0) < 20: recs.append("Increase research funding and expenditure")
            
        return {
            'predicted_score': round(score, 2),
            'confidence_interval': [round(lower_bound, 2), round(upper_bound, 2)],
            'estimated_band': band,
            'recommendations': recs,
            'feature_importance': self.feature_importance,
        }

# ══════════════════════════════════════════════════════════════════════════════
# INIT: Train models on startup (fast — ~2 seconds)
# ══════════════════════════════════════════════════════════════════════════════
print("[ML] NS-Acad ML Service Starting...")
print("=" * 50)

print("[*] Training performance prediction models...")
predictor = PerformancePredictor()
df = generate_training_data(500)
predictor.train(df)

print("[*] Training NIRF ranking model...")
nirf_predictor = NIRFPredictor()
nirf_predictor.train()

print("=" * 50)
print("[OK] All models ready!")


# ══════════════════════════════════════════════════════════════════════════════
# API ROUTES
# ══════════════════════════════════════════════════════════════════════════════

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'ok',
        'models_loaded': predictor.is_trained and nirf_predictor.is_trained,
        'models': ['Random Forest', 'XGBoost', 'Gradient Boosting', 'Linear Regression', 'RF Classifier', 'XGB Classifier', 'NIRF Predictor'],
    })


@app.route('/api/ml/predict', methods=['POST'])
def predict_performance():
    """
    Predict student end-sem performance using ensemble ML models.
    Input: array of students with { tms_marks, tca_marks, attendance, assignments, lab_marks }
    """
    try:
        data = request.json
        students = data.get('students', [])
        if not students:
            return jsonify({'error': 'No student data provided'}), 400

        results = []
        for s in students:
            features = [
                float(s.get('tms_marks', 0)),
                float(s.get('tca_marks', 0)),
                float(s.get('attendance', 75)),
                float(s.get('assignments', 15)),
                float(s.get('lab_marks', 20)),
            ]
            pred = predictor.predict(features)[0]
            results.append({
                'rollNo': s.get('rollNo', ''),
                'name': s.get('name', ''),
                'input_features': {
                    'tms_marks': features[0], 'tca_marks': features[1],
                    'attendance': features[2], 'assignments': features[3], 'lab_marks': features[4],
                },
                **pred,
            })

        return jsonify(to_native({
            'predictions': results,
            'model_metrics': predictor.metrics,
            'feature_importance': predictor.feature_importance,
            'ensemble_method': 'Weighted Average (RF: 35%, XGB: 35%, GB: 20%, LR: 10%)',
        }))
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@app.route('/api/ml/nirf-predict', methods=['POST'])
def predict_nirf():
    """Predict NIRF-style score for the institution."""
    data = request.json
    result = nirf_predictor.predict(data)
    result['model_metrics'] = nirf_predictor.metrics
    return jsonify(to_native(result))


@app.route('/api/ml/model-info', methods=['GET'])
def model_info():
    """Return information about all trained models."""
    return jsonify(to_native({
        'performance_models': {
            'metrics': predictor.metrics,
            'feature_importance': predictor.feature_importance,
            'features_used': ['tms_marks', 'tca_marks', 'attendance', 'assignments', 'lab_marks'],
            'target': 'tes_marks (End Semester Score)',
            'training_samples': 500,
            'algorithms': [
                {'name': 'Random Forest Regressor', 'type': 'Ensemble (Bagging)', 'n_estimators': 100},
                {'name': 'XGBoost Regressor', 'type': 'Ensemble (Boosting)', 'n_estimators': 100},
                {'name': 'Gradient Boosting Regressor', 'type': 'Ensemble (Boosting)', 'n_estimators': 100},
                {'name': 'Linear Regression', 'type': 'Parametric', 'n_estimators': 'N/A'},
            ],
        },
        'classification_models': {
            'metrics': {k: v for k, v in predictor.metrics.items() if 'Classifier' in k},
            'classes': list(predictor.label_encoder.classes_),
        },
        'nirf_model': {
            'metrics': nirf_predictor.metrics,
            'feature_importance': nirf_predictor.feature_importance,
            'features_used': nirf_predictor.feature_names,
        },
    }))


@app.route('/api/ml/retrain', methods=['POST'])
def retrain():
    """Retrain models with new data from the portal."""
    data = request.json
    students_data = data.get('students', [])

    if students_data and len(students_data) >= 10:
        df = pd.DataFrame(students_data)
        required = ['tms_marks', 'tca_marks', 'attendance', 'assignments', 'lab_marks', 'tes_marks']
        if all(c in df.columns for c in required):
            # Fill missing numerical values with 0
            df.fillna(0, inplace=True)
            # Add category
            total_pct = (df['tms_marks'] / 50 + df['tca_marks'] / 40 + df['tes_marks'] / 100) / 3 * 100
            df['total_percentage'] = total_pct
            df['category'] = pd.cut(total_pct, bins=[-1, 40, 60, 75, 100],
                                    labels=['At-Risk', 'Average', 'Good', 'Excellent'])
            df['category'] = df['category'].fillna('Average') # default if any missing
            metrics = predictor.train(df)
            return jsonify({'status': 'retrained_with_real_data', 'metrics': metrics, 'samples': len(df)})

    # Fall back to synthetic data
    df = generate_training_data(500)
    metrics = predictor.train(df)
    return jsonify({'status': 'retrained_with_synthetic', 'metrics': metrics, 'samples': len(df)})


if __name__ == '__main__':
    print("\n[*] ML Service running at http://localhost:5001")
    print("   Endpoints:")
    print("   POST /api/ml/predict       -- Student performance prediction")
    print("   POST /api/ml/nirf-predict  -- NIRF ranking prediction")
    print("   GET  /api/ml/model-info    -- Model details & metrics")
    print("   POST /api/ml/retrain       -- Retrain with new data")
    print("   GET  /health               -- Health check\n")
    app.run(host='0.0.0.0', port=5001, debug=False)
