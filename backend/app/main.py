import os
import json
import pandas as pd
import geopandas as gpd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List, Literal

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variables to store loaded data
SCORED_DATA = None
CONFIG_DATA = None
GEOJSON_DATA = None
GEOJSON_SIZES = {}
INDICATORS = []
INDICATORS_SET = set()
THRESHOLDS = {}

def simplify_geojson(input_path: str, output_path: str):
    print("Loading GeoJSON for simplification...")
    gdf = gpd.read_file(input_path)
    print("Simplifying GeoJSON...")
    # Tolerance of 0.005 is usually sufficient for county boundaries visually while shrinking size drastically
    gdf.geometry = gdf.geometry.simplify(tolerance=0.005, preserve_topology=True)
    gdf.to_file(output_path, driver='GeoJSON')
    print("Simplified GeoJSON saved.")

@app.on_event("startup")
async def startup_event():
    global SCORED_DATA, CONFIG_DATA, GEOJSON_DATA, GEOJSON_SIZES, INDICATORS, INDICATORS_SET, THRESHOLDS
    
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(os.path.dirname(script_dir))
    
    # 1. Load config
    config_path = os.path.join(project_root, 'backend', 'scoring', 'scoring_config.json')
    with open(config_path, 'r') as f:
        CONFIG_DATA = json.load(f)
        
    for k, v in CONFIG_DATA['indicators'].items():
        # Title case, replace pipes
        label = k.split('|')[0].strip().title()
        INDICATORS.append({
            "name": k,
            "direction": v['direction'],
            "weight": v['weight'],
            "label": label
        })
        INDICATORS_SET.add(k)
        
    # 2. Load scored counties
    scored_path = os.path.join(project_root, 'data', 'scored_counties.csv')
    # Load as pandas dataframe, ensure FIPS is zero-padded string
    SCORED_DATA = pd.read_csv(scored_path, dtype={'FIPS': str})
    SCORED_DATA['FIPS'] = SCORED_DATA['FIPS'].str.zfill(5)
    
    # Replace NaN with None for JSON serialization
    SCORED_DATA = SCORED_DATA.replace({float('nan'): None})
    
    # Compute thresholds
    computable = SCORED_DATA[SCORED_DATA['score_status'] != 'insufficient_data']
    hs_values = pd.to_numeric(computable['Health Score']).dropna()
    ds_values = pd.to_numeric(computable['Disparity Score']).dropna()

    t33 = float(hs_values.quantile(1/3))
    t66 = float(hs_values.quantile(2/3))
    ds_75 = float(ds_values.quantile(0.75))

    THRESHOLDS = {
        "classification": {
            "red_max": t33,
            "yellow_max": t66
        },
        "high_disparity_cutoff": ds_75
    }
    
    # 3. Load GeoJSON
    geojson_path = os.path.join(project_root, 'data', 'us_counties.geojson')
    simplified_path = os.path.join(project_root, 'data', 'us_counties_simplified.geojson')
    
    original_size = os.path.getsize(geojson_path)
    GEOJSON_SIZES['original'] = original_size
    
    if original_size > 2 * 1024 * 1024:
        if not os.path.exists(simplified_path):
            simplify_geojson(geojson_path, simplified_path)
        
        simplified_size = os.path.getsize(simplified_path)
        GEOJSON_SIZES['simplified'] = simplified_size
        
        with open(simplified_path, 'r') as f:
            GEOJSON_DATA = json.load(f)
    else:
        with open(geojson_path, 'r') as f:
            GEOJSON_DATA = json.load(f)


@app.get("/api/v1/health")
async def health():
    return {"status": "ok"}


@app.get("/api/v1/thresholds")
async def get_thresholds():
    return THRESHOLDS


@app.get("/api/v1/geojson/counties")
async def geojson_counties():
    return GEOJSON_DATA


@app.get("/api/v1/indicators")
async def get_indicators():
    return INDICATORS


@app.get("/api/v1/regions")
async def get_regions():
    # List of all 3210 counties with: FIPS, State, County, Health Score, Disparity Score, classification, score_status, high_disparity
    cols = ['FIPS', 'State', 'County', 'Health Score', 'Disparity Score', 'classification', 'score_status', 'high_disparity']
    regions = SCORED_DATA[cols].to_dict(orient='records')
    return regions


@app.get("/api/v1/map")
async def get_map(indicator: str = "overall"):
    if indicator == "overall":
        # return {FIPS: {value: Health Score, classification, score_status}}
        result = {}
        for _, row in SCORED_DATA.iterrows():
            result[row['FIPS']] = {
                "value": row['Health Score'],
                "classification": row['classification'],
                "score_status": row['score_status']
            }
        return result
    else:
        if indicator not in INDICATORS_SET:
            valid_names = list(INDICATORS_SET) + ["overall"]
            raise HTTPException(status_code=404, detail=f"Invalid indicator '{indicator}'. Valid indicators are: {valid_names}")
            
        result = {}
        for _, row in SCORED_DATA.iterrows():
            # Check if county has that indicator
            if row[indicator] is not None:
                result[row['FIPS']] = {
                    "value": row[indicator],
                    "normalized_value": row[indicator + '_norm']
                }
        return result


@app.get("/api/v1/region/{fips}")
async def get_region(fips: str):
    fips = str(fips).zfill(5)
    row = SCORED_DATA[SCORED_DATA['FIPS'] == fips]
    if len(row) == 0:
        raise HTTPException(status_code=404, detail=f"County with FIPS {fips} not found.")
        
    return row.iloc[0].to_dict()


@app.get("/api/v1/rankings")
async def get_rankings(
    metric: str = Query(..., description="Metric to rank by: health_score, disparity_score, or an indicator name"),
    order: Literal["asc", "desc"] = "desc",
    limit: int = 50
):
    # Determine the actual column name
    if metric == "health_score":
        col_name = "Health Score"
    elif metric == "disparity_score":
        col_name = "Disparity Score"
    else:
        if metric not in INDICATORS_SET:
            raise HTTPException(status_code=400, detail=f"Invalid metric '{metric}'. Valid metrics are: health_score, disparity_score, or any valid indicator name.")
        col_name = metric
        
    # Drop nulls for this metric
    valid_data = SCORED_DATA.dropna(subset=[col_name])
    
    ascending = True if order == "asc" else False
    
    ranked = valid_data.sort_values(by=col_name, ascending=ascending).head(limit)
    
    # Return FIPS, State, County, and the requested metric's value
    result = []
    for _, row in ranked.iterrows():
        result.append({
            "FIPS": row['FIPS'],
            "State": row['State'],
            "County": row['County'],
            "value": row[col_name]
        })
        
    return result


@app.get("/api/v1/analytics/correlation")
async def get_correlation():
    # compute correlation matrix using complete cases
    complete_cases = SCORED_DATA[SCORED_DATA['score_status'] == 'complete']
    
    norm_cols = [ind + "_norm" for ind in INDICATORS_SET]
    # compute correlation
    corr_matrix = complete_cases[norm_cols].corr(method='pearson')
    
    # rename index/columns to original indicator names
    corr_matrix.index = list(INDICATORS_SET)
    corr_matrix.columns = list(INDICATORS_SET)
    
    # replace NaN with None
    corr_matrix = corr_matrix.replace({float('nan'): None})
    
    # return as nested object
    return corr_matrix.to_dict()
