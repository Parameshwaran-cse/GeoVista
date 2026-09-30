import pytest
import pandas as pd
import numpy as np
import json
from unittest.mock import patch, mock_open, MagicMock
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from scoring.score import main as score_main
from pipeline.preprocess import main as preprocess_main

# Dummy config for scoring tests (11 indicators like the real one)
# We will just use 11 indicators for testing missing values
DUMMY_CONFIG = {
    "indicators": {
        f"Ind_{i}": {"direction": "positive", "weight": 1/11} for i in range(11)
    }
}
DUMMY_CONFIG["indicators"]["Ind_0"]["direction"] = "negative" # make one negative for testing

@patch("scoring.score.pd.read_csv")
@patch("builtins.open", new_callable=mock_open, read_data=json.dumps(DUMMY_CONFIG))
def test_scoring_logic(mock_file, mock_read_csv):
    # We will patch DataFrame.to_csv to capture the output dataframe
    captured_df = {}
    original_to_csv = pd.DataFrame.to_csv
    
    def mock_to_csv(self, *args, **kwargs):
        captured_df["out"] = self.copy()
        
    with patch("scoring.score.pd.DataFrame.to_csv", mock_to_csv):
        # Create synthetic data
        # We need 11 indicators to test insufficient_data logic (threshold >5 missing out of 11)
        data = {
            "FIPS": ["00001", "00002", "00003", "00004", "00005"],
            "State": ["A", "B", "C", "D", "E"],
            "County": ["C1", "C2", "C3", "C4", "C5"]
        }
        for i in range(11):
            data[f"Ind_{i}"] = [10.0, 50.0, 110.0, 50.0, 50.0]
        
        # Modify specific rows for specific tests
        
        # Zero variance for Ind_1
        data["Ind_1"] = [5.0, 5.0, 5.0, 5.0, 5.0]
        
        # Missing values for row index 3 (Missing 2 out of 11) - partial
        data["Ind_2"][3] = np.nan
        data["Ind_3"][3] = np.nan
        
        # Missing values for row index 4 (Missing 6 out of 11) - insufficient
        for i in range(4, 10):
            data[f"Ind_{i}"][4] = np.nan
            
        df_in = pd.DataFrame(data)
        
        # Precompute 'partial' and 'insufficient_data' as preprocess would do
        null_counts = df_in[[f"Ind_{i}" for i in range(11)]].isnull().sum(axis=1)
        df_in['partial'] = null_counts > 0
        df_in['insufficient_data'] = null_counts > 5
        
        mock_read_csv.return_value = df_in
        
        # 1. Run the scoring main function
        score_main()
        
        out_df = captured_df["out"]
        
        # 1a. Test Normalization: 
        # Ind_0 is negative direction. Min 10, Max 110. Range 100.
        # Val 10 -> norm = 1 - (10-10)/100 = 1.0
        # Val 110 -> norm = 1 - (110-10)/100 = 0.0
        assert out_df.loc[0, "Ind_0_norm"] == 1.0
        assert out_df.loc[2, "Ind_0_norm"] == 0.0
        
        # Ind_2 is positive direction. Val 50 -> (50-10)/100 = 0.4
        assert out_df.loc[1, "Ind_2_norm"] == 0.4
        
        # 1b. Test Zero-Variance:
        # Ind_1 is all 5.0. Should normalize to 0.5.
        assert out_df.loc[0, "Ind_1_norm"] == 0.5
        assert out_df.loc[1, "Ind_1_norm"] == 0.5
        
        # 1c. Test Missing-Value Re-weighting
        # Row 3 (FIPS 00004) is missing Ind_2 and Ind_3.
        # It has 9 available indicators.
        # Let's compute its score manually. 
        # For the 9 available indicators, they all have raw value 50.
        # Norms: 
        # Ind_0 (neg): 1 - (50-10)/100 = 0.6
        # Ind_1 (zero var): 0.5
        # Ind_4..10 (pos): (50-10)/100 = 0.4
        # Weights were equal (1/11). We sum(norm * weight) / sum(weight).
        # Which is equivalent to average of available norms because weights are identical.
        # Average of (0.6 + 0.5 + 0.4*7) / 9 = (1.1 + 2.8) / 9 = 3.9 / 9 = 0.43333...
        expected_score = 3.9 / 9
        assert abs(out_df.loc[3, "Health Score"] - expected_score) < 1e-5
        
        # 1d. Test Insufficient Data Threshold
        # Row 4 (FIPS 00005) is missing 6 out of 11.
        assert out_df.loc[4, "score_status"] == "insufficient_data"
        assert pd.isna(out_df.loc[4, "Health Score"])
        
        # 1e. Test Classification Thresholds
        # Let's check how many computable scores we have: 4 (Rows 0, 1, 2, 3)
        # Classifications are based on quantiles (1/3, 2/3).
        # We just ensure classification column exists and is populated for computable rows.
        assert not pd.isna(out_df.loc[0, "classification"])
        assert out_df.loc[0, "classification"] in ["green", "yellow", "red"]

@patch("pipeline.preprocess.pd.read_excel")
@patch("builtins.open", new_callable=mock_open)
def test_preprocess_duplicate_handling(mock_file, mock_read_excel):
    captured_df = {}
    
    def mock_to_csv(self, *args, **kwargs):
        captured_df["out"] = self.copy()
        
    with patch("pipeline.preprocess.pd.DataFrame.to_csv", mock_to_csv):
        # Create synthetic data with duplicates
        # PRD names map to target names
        df_in = pd.DataFrame({
            "FIPS": [1001, 1001, 1002], # DUPLICATE FIPS
            "State": ["A", "A", "B"],
            "County": ["C1", "C1", "C2"],
            "Years of Potential Life Lost Rate": [10, 10, 20],
            "Poor Physical Health Days | Average Number of Physically Unhealthy Days": [1, 1, 2],
            "Poor Mental Health Days | Average Number of Mentally Unhealthy Days": [1, 1, 2],
            "% Low Birth Weight": [1, 1, 2],
            "Poor or Fair Health | % Fair or Poor Health": [1, 1, 2],
            "Flu Vaccinations | % Vaccinated": [1, 1, 2],
            "Preventable Hospital Stays | Preventable Hospitalization Rate": [1, 1, 2],
            "Mammography Screening | % with Annual Mammogram": [1, 1, 2],
            "Air Pollution: Particulate Matter | Average Daily PM2.5": [1, 1, 2],
            "Income Ratio": [1, 1, 2],
            "Children in Poverty | % Children in Poverty": [1, 1, 2]
        })
        mock_read_excel.return_value = df_in
        
        preprocess_main()
        
        out_df = captured_df["out"]
        
        # Test Duplicate Handling: Only 1 should survive if handled properly.
        # The prompt says "construct synthetic duplicate rows on FIPS and confirm only one survives... If a test reveals an actual bug, report it to me before fixing it."
        assert len(out_df) == 2, f"Expected 2 unique counties, but found {len(out_df)}. Duplicate handling is missing!"
        
