"""
data_sources.py — External data integration for pharma supply chain ABM.
Pulls real-world calibration data from GDELT (geopolitical risks) and
FDA (drug shortages) to ground the simulation in empirical reality.
"""

import requests
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Optional
import logging
import json
import time

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# GDELT Doc 2.0 API — geopolitical / supply-chain disruption signals
# ---------------------------------------------------------------------------

GDELT_DOC_API = "https://api.gdeltproject.org/api/v2/doc/doc"
GDELT_GEO_API = "https://api.gdeltproject.org/api/v2/geo/geo"

# GDELT themes relevant to pharma supply chain disruptions
PHARMA_THEMES = [
    "HEALTH_PANDEMIC",
    "HEALTH_SARS",
    "NATURAL_DISASTER",
    "TRADE_DISPUTE",
    "ECONOMIC_SANCTIONS",
    "GENERAL_HEALTH",
    "DRUG_TRADE",
    "MANMADE_DISASTER",
    "PROTEST",
    "POLITICAL_TURMOIL",
]

# Keywords for pharma-specific supply chain events
PHARMA_KEYWORDS = [
    "pharmaceutical supply chain",
    "drug shortage",
    "API shortage",              # Active Pharmaceutical Ingredient
    "pharma manufacturing disruption",
    "cold chain failure",
    "FDA recall",
    "pharmaceutical logistics",
    "generic drug supply",
    "vaccine supply chain",
    "pharmaceutical export ban",
]

# Key pharma manufacturing regions and their GDELT country codes
PHARMA_REGIONS = {
    "IN": {"name": "India", "role": "Generic API manufacturing hub", "api_share": 0.40},
    "CN": {"name": "China", "role": "Raw material / intermediate supplier", "api_share": 0.30},
    "US": {"name": "United States", "role": "Finished dosage / biotech", "api_share": 0.10},
    "IE": {"name": "Ireland", "role": "Biotech manufacturing hub", "api_share": 0.05},
    "DE": {"name": "Germany", "role": "Chemical intermediates", "api_share": 0.05},
    "CH": {"name": "Switzerland", "role": "Specialty pharma", "api_share": 0.03},
    "IL": {"name": "Israel", "role": "Generic finished dosage", "api_share": 0.03},
    "BR": {"name": "Brazil", "role": "Regional manufacturing", "api_share": 0.02},
    "JP": {"name": "Japan", "role": "Specialty APIs", "api_share": 0.02},
}


class GDELTClient:
    """Fetches geopolitical disruption signals from GDELT for simulation calibration."""

    def __init__(self, cache_hours: int = 6):
        self.cache = {}
        self.cache_hours = cache_hours
        self._last_request_time = 0
        self._min_interval = 1.0  # rate-limit: 1 req/sec

    def _rate_limit(self):
        elapsed = time.time() - self._last_request_time
        if elapsed < self._min_interval:
            time.sleep(self._min_interval - elapsed)
        self._last_request_time = time.time()

    def _cached_get(self, url: str, params: dict) -> Optional[dict]:
        cache_key = f"{url}:{json.dumps(params, sort_keys=True)}"
        if cache_key in self.cache:
            ts, data = self.cache[cache_key]
            if (datetime.now() - ts).total_seconds() < self.cache_hours * 3600:
                return data
        self._rate_limit()
        try:
            resp = requests.get(url, params=params, timeout=30)
            resp.raise_for_status()
            data = resp.json() if "json" in resp.headers.get("content-type", "") else resp.text
            self.cache[cache_key] = (datetime.now(), data)
            return data
        except Exception as e:
            logger.warning(f"GDELT request failed: {e}")
            return None

    # --- public helpers ---------------------------------------------------

    def get_disruption_timeline(
        self,
        keyword: str = "pharmaceutical supply chain disruption",
        days_back: int = 90,
    ) -> pd.DataFrame:
        """Volume timeline for a keyword — measures media attention over time."""
        end = datetime.utcnow()
        start = end - timedelta(days=days_back)
        params = {
            "query": keyword,
            "mode": "timelinevol",
            "startdatetime": start.strftime("%Y%m%d%H%M%S"),
            "enddatetime": end.strftime("%Y%m%d%H%M%S"),
            "format": "json",
        }
        data = self._cached_get(GDELT_DOC_API, params)
        if data and isinstance(data, dict) and "timeline" in data:
            rows = []
            for series in data["timeline"]:
                for point in series.get("data", []):
                    rows.append({"date": point["date"], "volume": point["value"]})
            return pd.DataFrame(rows)
        return pd.DataFrame(columns=["date", "volume"])

    def get_regional_risk_scores(self, days_back: int = 30) -> dict:
        """
        Build a risk score per pharma-manufacturing region by querying GDELT
        for disruption-related coverage volume in each country.
        Returns {country_code: risk_score} normalised to [0, 1].
        """
        scores = {}
        for code, meta in PHARMA_REGIONS.items():
            params = {
                "query": f"pharmaceutical OR drug OR shortage OR disruption",
                "sourcecountry": code,
                "mode": "artcount",
                "startdatetime": (datetime.utcnow() - timedelta(days=days_back)).strftime("%Y%m%d%H%M%S"),
                "enddatetime": datetime.utcnow().strftime("%Y%m%d%H%M%S"),
                "format": "json",
            }
            data = self._cached_get(GDELT_DOC_API, params)
            if data and isinstance(data, dict):
                scores[code] = data.get("artcount", 0)
            else:
                scores[code] = 0

        # Normalise to 0-1
        max_val = max(scores.values()) if scores and max(scores.values()) > 0 else 1
        return {k: v / max_val for k, v in scores.items()}

    def get_theme_intensity(self, theme: str = "NATURAL_DISASTER", days_back: int = 30) -> float:
        """Return normalised intensity (0-1) for a GDELT theme."""
        params = {
            "query": f"theme:{theme}",
            "mode": "artcount",
            "startdatetime": (datetime.utcnow() - timedelta(days=days_back)).strftime("%Y%m%d%H%M%S"),
            "enddatetime": datetime.utcnow().strftime("%Y%m%d%H%M%S"),
            "format": "json",
        }
        data = self._cached_get(GDELT_DOC_API, params)
        if data and isinstance(data, dict):
            count = data.get("artcount", 0)
            # Normalise: 10k+ articles in 30 days = max intensity
            return min(count / 10000, 1.0)
        return 0.0


# ---------------------------------------------------------------------------
# FDA Drug Shortages API
# ---------------------------------------------------------------------------

FDA_SHORTAGES_API = "https://api.fda.gov/drug/shortages.json"
FDA_DRUG_EVENT_API = "https://api.fda.gov/drug/event.json"


class FDAClient:
    """Fetches drug shortage data from openFDA for calibration."""

    def __init__(self):
        self._last_request_time = 0

    def _rate_limit(self):
        elapsed = time.time() - self._last_request_time
        if elapsed < 0.5:
            time.sleep(0.5 - elapsed)
        self._last_request_time = time.time()

    def get_current_shortages(self, limit: int = 100) -> pd.DataFrame:
        """Fetch currently active drug shortages from FDA."""
        self._rate_limit()
        try:
            resp = requests.get(
                FDA_SHORTAGES_API,
                params={"limit": limit},
                timeout=30,
            )
            resp.raise_for_status()
            data = resp.json()
            results = data.get("results", [])
            if results:
                return pd.DataFrame(results)
        except Exception as e:
            logger.warning(f"FDA shortages request failed: {e}")
        return pd.DataFrame()

    def get_shortage_count_by_category(self) -> dict:
        """Count shortages by therapeutic category."""
        self._rate_limit()
        try:
            resp = requests.get(
                FDA_SHORTAGES_API,
                params={"count": "classification", "limit": 20},
                timeout=30,
            )
            resp.raise_for_status()
            data = resp.json()
            results = data.get("results", [])
            return {r["term"]: r["count"] for r in results}
        except Exception as e:
            logger.warning(f"FDA shortage count failed: {e}")
        return {}

    def get_adverse_event_counts(self, drug_name: str = "", limit: int = 10) -> int:
        """Get count of adverse events — proxy for demand / quality issues."""
        self._rate_limit()
        search = f'patient.drug.medicinalproduct:"{drug_name}"' if drug_name else ""
        try:
            resp = requests.get(
                FDA_DRUG_EVENT_API,
                params={"search": search, "limit": 1} if search else {"limit": 1},
                timeout=30,
            )
            resp.raise_for_status()
            data = resp.json()
            return data.get("meta", {}).get("results", {}).get("total", 0)
        except Exception as e:
            logger.warning(f"FDA adverse events request failed: {e}")
        return 0


# ---------------------------------------------------------------------------
# Synthetic calibration data (fallback when APIs are unreachable)
# ---------------------------------------------------------------------------

def generate_fallback_calibration_data() -> dict:
    """
    Empirically-grounded synthetic data derived from published studies.
    Used when live APIs are unavailable.
    """
    np.random.seed(42)

    return {
        "regional_risk_scores": {
            "IN": 0.65,   # India — high exposure to monsoons, export bans
            "CN": 0.72,   # China — geopolitical tension, zero-COVID legacy
            "US": 0.25,   # US — domestic, lower geopolitical risk
            "IE": 0.15,   # Ireland — stable, EU regulatory
            "DE": 0.20,   # Germany — energy price volatility
            "CH": 0.10,   # Switzerland — very stable
            "IL": 0.40,   # Israel — regional conflict
            "BR": 0.50,   # Brazil — logistics infrastructure
            "JP": 0.18,   # Japan — natural disaster risk
        },
        # FDA reports ~300 active shortages at any time (2023-2024 data)
        "baseline_shortage_rate": 0.05,        # 5% of SKUs in shortage at any time
        "tier2_disruption_share": 0.85,        # 85% of disruptions from tier-2
        "cold_chain_breach_rate": 0.08,        # 8% of shipments have temp excursions
        "cold_chain_spoilage_rate": 0.03,      # 3% spoilage baseline
        "batch_failure_rate": 0.02,            # 2% batch failure rate
        "rbe_time_reduction": 0.70,            # RbE reduces review time by 70%
        "forecast_mape_baseline": 0.117,       # 11.7% MAPE baseline
        "forecast_mape_ai": 0.060,             # 6.0% MAPE with AI agents
        "demand_seasonality": [                # Monthly demand multiplier
            0.95, 0.90, 1.00, 1.05, 1.10, 1.15,
            1.10, 1.05, 1.00, 1.05, 1.10, 1.20,
        ],
        "avg_lead_time_days": {
            "raw_material": 45,
            "api_manufacturing": 30,
            "finished_dosage": 14,
            "distribution": 7,
        },
        # Geopolitical event probabilities per month per region
        "event_probabilities": {
            "natural_disaster": 0.03,
            "regulatory_change": 0.02,
            "trade_dispute": 0.04,
            "pandemic_wave": 0.01,
            "cyber_attack": 0.02,
            "quality_failure": 0.05,
        },
    }


# ---------------------------------------------------------------------------
# Unified calibration loader
# ---------------------------------------------------------------------------

def load_calibration_data(use_live_apis: bool = True) -> dict:
    """
    Attempt to load live data from GDELT + FDA.
    Falls back to empirical synthetic data if APIs fail.
    """
    calibration = generate_fallback_calibration_data()

    if not use_live_apis:
        logger.info("Using fallback calibration data (live APIs disabled).")
        return calibration

    # Try GDELT
    try:
        gdelt = GDELTClient()
        live_risk = gdelt.get_regional_risk_scores(days_back=30)
        if live_risk and any(v > 0 for v in live_risk.values()):
            # Blend live data with baseline (70% live, 30% prior)
            for code in calibration["regional_risk_scores"]:
                if code in live_risk:
                    calibration["regional_risk_scores"][code] = (
                        0.7 * live_risk[code]
                        + 0.3 * calibration["regional_risk_scores"][code]
                    )
            logger.info("GDELT regional risk scores loaded and blended.")

        # Theme intensities for event probability adjustment
        for theme in ["NATURAL_DISASTER", "HEALTH_PANDEMIC", "TRADE_DISPUTE"]:
            intensity = gdelt.get_theme_intensity(theme)
            if intensity > 0:
                key_map = {
                    "NATURAL_DISASTER": "natural_disaster",
                    "HEALTH_PANDEMIC": "pandemic_wave",
                    "TRADE_DISPUTE": "trade_dispute",
                }
                base_key = key_map.get(theme)
                if base_key and base_key in calibration["event_probabilities"]:
                    # Scale event probability up when media intensity is high
                    calibration["event_probabilities"][base_key] *= (1 + intensity)
        logger.info("GDELT theme intensities applied.")

    except Exception as e:
        logger.warning(f"GDELT integration failed, using fallback: {e}")

    # Try FDA
    try:
        fda = FDAClient()
        shortages = fda.get_current_shortages(limit=100)
        if not shortages.empty:
            # Adjust baseline shortage rate based on real count
            real_rate = len(shortages) / 2000  # ~2000 tracked drugs
            calibration["baseline_shortage_rate"] = (
                0.6 * real_rate + 0.4 * calibration["baseline_shortage_rate"]
            )
            logger.info(f"FDA shortage data loaded: {len(shortages)} active shortages.")
    except Exception as e:
        logger.warning(f"FDA integration failed, using fallback: {e}")

    return calibration
