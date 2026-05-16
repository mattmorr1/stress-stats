import os
import argparse
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from dotenv import load_dotenv
from sklearn.ensemble import IsolationForest
import warnings
import json

from whoop_client import WhoopStressSentinel

try:
    from garminconnect import Garmin
except ImportError:
    Garmin = None

try:
    from statsmodels.tsa.holtwinters import ExponentialSmoothing
    HAS_STATSMODELS = True
except ImportError:
    HAS_STATSMODELS = False

warnings.filterwarnings('ignore')

class GarminStressSentinel:
    def __init__(self, email, password):
        if Garmin is None:
            raise ImportError("Please run: pip install garminconnect")
        self.email = email
        self.password = password
        self.client = None

    def authenticate(self):
        print("Authenticating with Garmin Connect...")
        self.client = Garmin(self.email, self.password)
        self.client.login()
        print("Garmin Authentication successful!")

    def pull_data(self, start_date_str, end_date_str):
        print(f"Fetching biometric data from Garmin ({start_date_str} to {end_date_str})...")
        
        start_date = datetime.strptime(start_date_str, "%Y-%m-%d")
        end_date = datetime.strptime(end_date_str, "%Y-%m-%d")
        days = (end_date - start_date).days + 1
        
        all_daily_data = []
        
        for i in range(days):
            target_date = (start_date + timedelta(days=i)).strftime("%Y-%m-%d")
            try:
                daily_stats = self.client.get_stats(target_date)
                rhr = daily_stats.get("restingHeartRate", np.nan)
                
                hrv_data = self.client.get_hrv_data(target_date)
                rmssd = np.nan
                
                if hrv_data:
                    summary = hrv_data.get('hrvSummary', hrv_data)
                    if isinstance(summary, dict):
                        rmssd = summary.get('lastNightRmssd', summary.get('lastNightAvg', np.nan))
                        
                    if pd.isna(rmssd) or rmssd is None:
                        readings = hrv_data.get('hrvReadings', [])
                        if readings:
                            vals = [r.get('hrvValue') for r in readings if r.get('hrvValue') is not None]
                            if vals:
                                rmssd = np.mean(vals)
                
                all_daily_data.append({
                    'date': pd.to_datetime(target_date),
                    'resting_hr': rhr,
                    'rmssd': rmssd
                })
            except Exception as e:
                print(f"Warning: Failed fetching {target_date}: {e}")
                
        if not all_daily_data:
            return None
            
        df = pd.DataFrame(all_daily_data).set_index('date').sort_index()
        return df

class SentinelCoreMath:
    """Mathematical Lenses and ML Forecasting for the Stress Sentinel SDK."""
    
    @staticmethod
    def engineer_features(df):
        df = df.copy()
        df['rmssd'] = df['rmssd'].interpolate().bfill().ffill()
        df['resting_hr'] = df['resting_hr'].interpolate().bfill().ffill()

        baseline_rhr = df['resting_hr'].min()
        df['red_strain'] = df['resting_hr'] - baseline_rhr
        
        rmssd_mean = df['rmssd'].mean()
        rmssd_std = df['rmssd'].std() if df['rmssd'].std() > 0 else 1
        df['magnitude_z'] = (df['rmssd'] - rmssd_mean) / rmssd_std

        df['volatility_cv'] = df['rmssd'].rolling(7, min_periods=1).std() / df['rmssd'].rolling(7, min_periods=1).mean()
        df['volatility_cv'] = df['volatility_cv'].fillna(0)
        
        cv_mean = df['volatility_cv'].mean()
        cv_std = df['volatility_cv'].std() if df['volatility_cv'].std() > 0 else 1
        df['volatility_z'] = (df['volatility_cv'] - cv_mean) / cv_std

        red_strain_std = df['red_strain'].std() if df['red_strain'].std() > 0 else 1
        df['strain_z'] = (df['red_strain'] - df['red_strain'].mean()) / red_strain_std
        
        df['decoupling_idx'] = df['magnitude_z'] - df['strain_z']
        return df

    @staticmethod
    def classify_readiness_state(df):
        states = []
        for _, row in df.iterrows():
            mag = row['magnitude_z']
            vol = row['volatility_z']
            
            if mag > 0 and -1.0 <= vol <= 1.0:
                states.append("Peak / Ready")
            elif mag < -0.5 and vol > 0:
                states.append("Functional Overreach")
            elif mag < -0.5 and vol < 0:
                states.append("Non-Functional Fatigue")
            elif mag > 0.5 and vol < -1.0:
                states.append("Autonomic Exhaustion (RED-S Risk)")
            else:
                states.append("Maintaining / Normal")
                
        df['readiness_state'] = states
        return df

    @staticmethod
    def run_anomaly_detection(df):
        features = df[['magnitude_z', 'volatility_z', 'decoupling_idx']].fillna(0)
        try:
            model = IsolationForest(contamination=0.1, random_state=42)
            df['anomaly'] = model.fit_predict(features)
        except Exception:
            df['anomaly'] = 1
        return df
        
    @staticmethod
    def forecast_burnout(df, days_ahead=3):
        """Uses Holt-Winters Exponential Smoothing to predict future decoupling."""
        if not HAS_STATSMODELS:
            print("\\n[WARNING] statsmodels not installed. Skipping ML Forecast. (Run: pip install statsmodels)")
            return None
            
        if len(df) < 14:
            print("\\n[WARNING] Need at least 14 days of data for robust forecasting.")
            return None
            
        print(f"\\n--- Running Time-Series Forecasting (Next {days_ahead} Days) ---")
        
        ts_data = df['decoupling_idx'].values
        
        try:
            # Simple Exponential Smoothing
            model = ExponentialSmoothing(ts_data, trend='add', seasonal=None, initialization_method="estimated")
            fit_model = model.fit()
            forecast = fit_model.forecast(days_ahead)
            
            last_date = df.index[-1]
            future_dates = [last_date + timedelta(days=i) for i in range(1, days_ahead + 1)]
            
            forecast_df = pd.DataFrame({
                'date': future_dates,
                'forecasted_decoupling': forecast
            }).set_index('date')
            
            # Predict risk purely based on decoupling threshold
            forecast_df['predicted_risk'] = forecast_df['forecasted_decoupling'].apply(
                lambda x: "High Burnout Risk" if x < -1.5 else ("Watch Load" if x < 0 else "Optimal")
            )
            return forecast_df
            
        except Exception as e:
            print(f"Forecasting failed: {e}")
            return None

def main():
    parser = argparse.ArgumentParser(description="Stress Sentinel SDK (Phase 2)")
    parser.add_argument('--source', type=str, choices=['garmin', 'whoop'], default='garmin', help='Data source API')
    
    # Defaults to last 30 days
    default_end = datetime.today().strftime("%Y-%m-%d")
    default_start = (datetime.today() - timedelta(days=30)).strftime("%Y-%m-%d")
    
    parser.add_argument('--start', type=str, default=default_start, help='Start date YYYY-MM-DD')
    parser.add_argument('--end', type=str, default=default_end, help='End date YYYY-MM-DD')
    
    args = parser.parse_args()
    
    print("=== STRESS SENTINEL SDK (Phase 2) ===")
    load_dotenv()
    
    if args.source == 'garmin':
        email = os.environ.get("GARMIN_EMAIL")
        pwd = os.environ.get("GARMIN_PASSWORD")
        if not email or not pwd:
            print("[ERROR] Missing GARMIN_EMAIL or GARMIN_PASSWORD in .env")
            return
        engine = GarminStressSentinel(email, pwd)
    else:
        email = os.environ.get("WHOOP_USERNAME")
        pwd = os.environ.get("WHOOP_PASSWORD")
        if not email or not pwd:
            print("[ERROR] Missing WHOOP_USERNAME or WHOOP_PASSWORD in .env")
            return
        engine = WhoopStressSentinel(email, pwd)

    try:
        engine.authenticate()
    except Exception as e:
        print(f"[ERROR] Authentication failed: {e}")
        return
        
    # 1. Ingestion
    raw_df = engine.pull_data(args.start, args.end)
    if raw_df is None or raw_df.empty:
        print("[ERROR] No data pulled.")
        return
        
    # 2. Math & ML
    print("\\nApplying Readiness Mathematical Lenses...")
    df = SentinelCoreMath.engineer_features(raw_df)
    df = SentinelCoreMath.classify_readiness_state(df)
    df = SentinelCoreMath.run_anomaly_detection(df)
    
    # 3. Time Series Forecasting
    forecast_df = SentinelCoreMath.forecast_burnout(df, days_ahead=3)
    
    # Output Results
    print(f"\\n--- Historical Readiness States ({args.source.upper()}) ---")
    display_cols = ['rmssd', 'magnitude_z', 'volatility_cv', 'decoupling_idx', 'readiness_state', 'anomaly']
    print(df[display_cols].round(2).tail(10).to_string())
    
    if forecast_df is not None:
        print(f"\\n--- AI Burnout Forecast (Next 3 Days) ---")
        print(forecast_df.round(2).to_string())

if __name__ == "__main__":
    main()
