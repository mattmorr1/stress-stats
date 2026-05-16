import os
import json
from datetime import datetime, timedelta
from dotenv import load_dotenv

try:
    from garminconnect import Garmin
except ImportError:
    print("pip install garminconnect")
    exit(1)

load_dotenv()
email = os.environ.get("GARMIN_EMAIL")
pwd = os.environ.get("GARMIN_PASSWORD")

client = Garmin(email, pwd)
client.login()

target_date = "2026-05-11" # A date we know they had an anomaly

print(f"--- Debugging Garmin Cloud API for {target_date} ---")

print("\\n1. Fetching HRV Data Endpoint:")
try:
    hrv = client.get_hrv_data(target_date)
    print(hrv)
except Exception as e:
    print(f"Error: {e}")

print("\\n2. Fetching Sleep Data Endpoint:")
try:
    sleep = client.get_sleep_data(target_date)
    # Just print top level keys so we don't flood the terminal
    if sleep and isinstance(sleep, dict):
        print(f"Keys available: {list(sleep.keys())}")
        if 'dailySleepDTO' in sleep:
            print(f"Sleep DTO Keys: {list(sleep['dailySleepDTO'].keys())}")
            print(f"Average HRV in sleep: {sleep['dailySleepDTO'].get('averageHRV')}")
    else:
        print(sleep)
except Exception as e:
    print(f"Error: {e}")

print("\\n3. Fetching User Stats Endpoint:")
try:
    stats = client.get_stats(target_date)
    if stats and isinstance(stats, dict):
         print(f"Keys available: {list(stats.keys())}")
    else:
         print(stats)
except Exception as e:
    print(f"Error: {e}")
