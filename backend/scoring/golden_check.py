import pandas as pd
import json

df = pd.read_csv('data/scored_counties.csv')
with open('backend/scoring/scoring_config.json', 'r') as f:
    config = json.load(f)

inds = config['indicators']

def print_county(row, title):
    print(f"\n--- {title} ---")
    print(f"County: {row['County']}, {row['State']} (FIPS: {row['FIPS']})")
    print(f"Status: {row['score_status']}, Class: {row['classification']}")
    print(f"Computed HS: {row['Health Score']:.6f}, DS: {row['Disparity Score']:.6f}")
    
    total_w = 0
    calc_hs = 0
    print("\nIndicators:")
    for k, v in inds.items():
        raw = row[k]
        norm = row[k + '_norm']
        if pd.isna(norm):
            print(f"  {k}: raw={raw}, norm=NaN (skipped)")
            continue
        w = v['weight']
        total_w += w
        calc_hs += norm * w
        print(f"  {k}: raw={raw:.2f}, norm={norm:.4f}, w={w:.4f}")
    
    if total_w > 0:
        calc_hs /= total_w
    else:
        calc_hs = float('nan')
        
    print(f"\nExpected HS (sum(norm*w) / sum(w)): {calc_hs:.6f}")
    print(f"Matches output: {abs(calc_hs - row['Health Score']) < 1e-5 if not pd.isna(calc_hs) else 'N/A'}")

green = df[(df['classification'] == 'green') & (df['high_disparity'] == False) & (df['score_status'] == 'complete')].iloc[0]
red = df[(df['classification'] == 'red') & (df['high_disparity'] == True) & (df['score_status'] == 'complete')].iloc[0]
partial = df[df['score_status'] == 'partial'].iloc[0]

print_county(green, "GREEN, LOW DISPARITY")
print_county(red, "RED, HIGH DISPARITY")
print_county(partial, "PARTIAL COUNTY")
