# GeoVista-HDX Methodology

This document outlines the data sources, methodology, and scoring algorithms used to power the GeoVista-HDX research dashboard.

## 1. Data Source
The primary dataset used in this project is the **HDX (Health Data Explorer) Cleaned Base**, representing health outcomes, clinical care, and health behavior metrics across **3,210 US counties**. This dataset provides a cross-sectional snapshot of regional health disparities. 

## 2. Indicators and Selection Criteria
From the extensive raw dataset, we carefully selected **11 core indicators** to build the composite Health Score. We explicitly excluded raw demographic breakdowns, confidence intervals (CIs), Z-scores, and redundant count/ratio columns to avoid collinearity and prevent implicit bias in the final scoring. 

The 11 included indicators, mapped from the raw dataset, are:

### Positive Indicators (Higher value = Better Health Outcome)
*   **Flu Vaccinations**: `% Vaccinated` (Preventive care measure)
*   **Mammography Screening**: `% with Annual Mammogram` (Preventive care measure)

### Negative Indicators (Higher value = Worse Health Outcome)
*   **Years of Potential Life Lost Rate**: (Broad mortality metric)
*   **Poor Physical Health Days**: `Average Number of Physically Unhealthy Days` (Morbidity measure)
*   **Poor Mental Health Days**: `Average Number of Mentally Unhealthy Days` (Morbidity measure)
*   **Low Birth Weight**: `% Low Birth Weight` (Maternal/child health)
*   **Poor or Fair Health**: `% Fair or Poor Health` (Self-reported outcome)
*   **Preventable Hospital Stays**: `Preventable Hospitalization Rate` (Healthcare access/quality)
*   **Air Pollution**: `Average Daily PM2.5` (Environmental factor)
*   **Income Inequality**: `Income Ratio` (Socioeconomic determinant)
*   **Children in Poverty**: `% Children in Poverty` (Socioeconomic determinant)

## 3. Normalization Method
To combine metrics with drastically different scales (e.g., percentages vs. rates), we apply **Min-Max Normalization** to map all indicator values to a standard `[0, 1]` scale where **1.0 always represents the best possible health outcome** and **0.0 represents the worst**.

*   **For Positive Indicators:** `Normalized = (Value - Min) / (Max - Min)`
*   **For Negative Indicators:** `Normalized = 1.0 - ((Value - Min) / (Max - Min))`

**Zero-Variance Edge Case:** If an indicator has zero variance across all counties (i.e., `Min == Max`), the normalization algorithm safely assigns a neutral baseline score of `0.5` to all counties to prevent division-by-zero errors and mathematically skewed composite scores.

## 4. Weighting Scheme
By default, the composite index uses an **Equal Weighting** scheme, where each of the 11 indicators contributes exactly `1/11` to the final score. 

**Note for Researchers:** This equal weighting is a baseline configuration, not a definitive claim of epidemiological impact. Alternate weighting schemes (e.g., heavily weighting clinical care vs. environmental factors) can be easily modeled by editing the `backend/scoring/scoring_config.json` file without requiring any code changes.

## 5. Composite Health & Disparity Scores
*   **Health Score**: The weighted sum of a county's available normalized indicators. It ranges from `0.0` (lowest relative health performance) to `1.0` (highest relative health performance).
*   **Disparity Score**: A direct mathematical inversion of the Health Score, defined as `Disparity Score = 1 - Health Score`. It serves as the primary metric for highlighting regional need.

## 6. Missing-Data Handling
Missing data is a common reality in county-level public health datasets. To maximize coverage while maintaining statistical integrity, we apply two strict rules:

1.  **Partial Data Re-weighting:** If a county is missing up to 5 indicators, we compute the Health Score using only the available indicators. The weights of the available indicators are proportionally scaled up so they still sum to 1.0. 
    *   *Impact: 341 counties currently utilize this partial re-weighting logic.*
2.  **Insufficient Data Threshold:** If a county is missing **more than 50%** of the indicators (i.e., > 5 missing out of 11), we flag it as `insufficient_data`. These counties are assigned a `null` score and are rendered gray on the map.
    *   *Impact: 27 counties are excluded from scoring due to insufficient data.*

## 7. Classification Methodology
We categorize the continuous Health Score into three discrete performance tiers using strict **Quantile Tertiles** to ensure an even distribution of counties across the color scale:

*   **Worse Performance (Red):** Bottom 1/3 (`Score < 0.666632`)
*   **Moderate Performance (Yellow):** Middle 1/3 (`0.666632 ≤ Score < 0.736966`)
*   **Better Performance (Green):** Top 1/3 (`Score ≥ 0.736966`)

*(Exact threshold values reflect the current dataset and dynamically update if the data or weighting configuration changes).*

## 8. High Disparity Flag
To help researchers rapidly identify the regions with the most severe health equity gaps, we define a boolean `high_disparity` flag. This is applied to any county falling into the **bottom quartile (25th percentile)** of the Health Score (or equivalently, the top quartile of the Disparity Score).
*   **Current High Disparity Threshold:** Disparity Score ≥ `0.356734`
*   **Flagged Counties:** `796`

## 9. Reproducibility
The data pipeline (`preprocess.py` -> `score.py`) is entirely deterministic. Data is sorted by FIPS code prior to missing-value evaluation to ensure identical results across runs. 

To verify the pipeline locally, execute the test suite (which validates normalization math, duplicate handling, and edge cases) or run the pipeline sequentially and diff the resulting CSV artifacts:
```bash
# Verify backend logic tests
cd backend/
pytest tests/

# Verify end-to-end determinism
python pipeline/preprocess.py
python scoring/score.py
```

## 10. Limitations and Future Work
*   **Single-Year Snapshot**: This application visualizes a single cross-sectional time period. Future versions could introduce temporal dimensions (e.g., slider bars for multi-year trend analysis).
*   **Boundary Mismatches**: There are approximately ~64 FIPS mismatches between the health dataset and the rendering GeoJSON boundary file, primarily due to real-world county boundary changes (e.g., in Alaska or Connecticut). These currently render as empty spaces on the map.
*   **Simplifying Assumptions**: The default equal-weighting scheme assumes all 11 indicators have an equal impact on holistic health, which may not align with specific clinical research hypotheses. 
*   **Excluded Demographics**: Racial, ethnic, and age demographic stratifications exist in the raw data but were omitted from Phase 1 to establish a baseline geographic dashboard. Integrating these as filtering layers is a prime target for future work.
*   **Accessibility Improvements**: The red/yellow/green diverging scale is a standard reporting pattern, but a future refinement could introduce a continuous, color-blind safe sequential scale (e.g., Viridis or Magma) as an alternative rendering option.
