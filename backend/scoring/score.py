import pandas as pd
import numpy as np
import json
import os

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(os.path.dirname(script_dir))
    data_in = os.path.join(project_root, 'data', 'processed_counties.csv')
    config_in = os.path.join(script_dir, 'scoring_config.json')
    data_out = os.path.join(project_root, 'data', 'scored_counties.csv')
    report_out = os.path.join(project_root, 'data', 'scoring_report.txt')

    df = pd.read_csv(data_in)
    
    with open(config_in, 'r') as f:
        config = json.load(f)
        
    indicators = config['indicators']
    zero_variance_logged = []
    
    # 2a. NORMALIZATION
    for ind, props in indicators.items():
        direction = props['direction']
        
        valid_vals = df.loc[~df['insufficient_data'], ind]
        valid_vals = valid_vals.dropna()
        
        if len(valid_vals) == 0:
            min_val = 0
            max_val = 0
        else:
            min_val = valid_vals.min()
            max_val = valid_vals.max()
            
        norm_col = ind + "_norm"
        
        if min_val == max_val:
            df[norm_col] = 0.5
            zero_variance_logged.append(ind)
        else:
            if direction == 'positive':
                df[norm_col] = (df[ind] - min_val) / (max_val - min_val)
            else:
                df[norm_col] = 1 - (df[ind] - min_val) / (max_val - min_val)
                
    # 2b & 2c & 2d. COMPUTE SCORES
    hs_list = []
    ds_list = []
    status_list = []
    
    for idx, row in df.iterrows():
        if row['insufficient_data']:
            hs_list.append(np.nan)
            ds_list.append(np.nan)
            status_list.append('insufficient_data')
            continue
            
        # calculate sum of weights for available indicators
        total_weight = 0
        score = 0
        for ind, props in indicators.items():
            norm_col = ind + "_norm"
            if not pd.isna(row[norm_col]) and not pd.isna(row[ind]):
                w = props['weight']
                total_weight += w
                score += row[norm_col] * w
                
        if total_weight > 0:
            final_hs = score / total_weight
            hs_list.append(final_hs)
            ds_list.append(1 - final_hs)
            if row['partial']:
                status_list.append('partial')
            else:
                status_list.append('complete')
        else:
            hs_list.append(np.nan)
            ds_list.append(np.nan)
            status_list.append('insufficient_data')

    df['Health Score'] = hs_list
    df['Disparity Score'] = ds_list
    df['score_status'] = status_list
    
    # 2e. CLASSIFICATION
    # Only use computable scores
    computable = df[df['score_status'] != 'insufficient_data']
    hs_values = computable['Health Score'].dropna()
    
    t33 = hs_values.quantile(1/3)
    t66 = hs_values.quantile(2/3)
    
    def classify(hs):
        if pd.isna(hs):
            return np.nan
        if hs < t33:
            return 'red'
        elif hs < t66:
            return 'yellow'
        else:
            return 'green'
            
    df['classification'] = df['Health Score'].apply(classify)
    
    # 2f. HIGH-DISPARITY FLAG
    # High disparity means highest DS (worst). 
    # The prompt says "bottom quartile (25th percentile) of all computed Disparity Scores" 
    # but also "high_disparity". To resolve the semantic contradiction, the highest 25% of 
    # Disparity Scores correspond to the worst 25% of counties. We will use DS >= 75th percentile.
    # Note: DS = 1 - HS. So top 25% of DS == bottom 25% of HS.
    ds_values = computable['Disparity Score'].dropna()
    ds_75 = ds_values.quantile(0.75)
    
    df['high_disparity'] = df['Disparity Score'].apply(lambda x: True if not pd.isna(x) and x >= ds_75 else False)
    
    # Fill nan in high_disparity for insufficient data? Wait, it says boolean, but for nan we can set it to False or None. 
    # We will leave as False if it's missing, or we can set it explicitly. 
    # Since it's boolean, False is fine.
    
    # 2g. Output file
    out_cols = ['FIPS', 'State', 'County'] + list(indicators.keys()) + [ind + "_norm" for ind in indicators.keys()] + \
               ['Health Score', 'Disparity Score', 'classification', 'score_status', 'high_disparity']
    
    df = df[out_cols]
    df.to_csv(data_out, index=False)
    
    # 2h. Report
    green_count = (df['classification'] == 'green').sum()
    yellow_count = (df['classification'] == 'yellow').sum()
    red_count = (df['classification'] == 'red').sum()
    hd_count = df['high_disparity'].sum()
    
    with open(report_out, 'w') as f:
        f.write("=== SCORING REPORT ===\n")
        f.write(f"Zero-variance indicators: {zero_variance_logged if zero_variance_logged else 'None'}\n\n")
        f.write("=== CLASSIFICATION THRESHOLDS (Health Score) ===\n")
        f.write(f"Red (bottom 1/3) < {t33:.6f}\n")
        f.write(f"Yellow (middle 1/3) between {t33:.6f} and {t66:.6f}\n")
        f.write(f"Green (top 1/3) >= {t66:.6f}\n\n")
        
        f.write(f"High Disparity Threshold (Disparity Score >= 75th percentile): {ds_75:.6f}\n\n")
        
        f.write("=== SUMMARY COUNTS ===\n")
        f.write(f"Green: {green_count}\n")
        f.write(f"Yellow: {yellow_count}\n")
        f.write(f"Red: {red_count}\n")
        f.write(f"Insufficient Data: {(df['score_status'] == 'insufficient_data').sum()}\n")
        f.write(f"High Disparity Flagged: {hd_count}\n")

    print(f"Scoring complete. Saved to {data_out}")

if __name__ == "__main__":
    main()
