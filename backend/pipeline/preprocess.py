import pandas as pd
import os
import sys

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(os.path.dirname(script_dir))
    data_path = os.path.join(project_root, 'data', 'GeoVista_HDX_Cleaned_Base.xlsx')
    output_path = os.path.join(project_root, 'data', 'processed_counties.csv')
    report_path = os.path.join(project_root, 'data', 'preprocessing_report.txt')

    print("Loading data...")
    try:
        df = pd.read_excel(data_path)
    except Exception as e:
        print(f"Error reading file: {e}")
        sys.exit(1)

    # 1. Zero-pad FIPS
    df['FIPS'] = df['FIPS'].astype(int).astype(str).str.zfill(5)

    # Indicator mapping from PRD -> Actual Column Name
    mapping = {
        "Years of Potential Life Lost Rate": "Years of Potential Life Lost Rate",
        "Poor Physical Health Days | Average Number of Physically Unhealthy Days": "Poor Physical Health Days | Average Number of Physically Unhealthy Days",
        "Poor Mental Health Days | Average Number of Mentally Unhealthy Days": "Poor Mental Health Days | Average Number of Mentally Unhealthy Days",
        "Low Birth Weight | % Low Birth Weight": "% Low Birth Weight",
        "Poor or Fair Health | % Fair or Poor Health": "Poor or Fair Health | % Fair or Poor Health",
        "Flu Vaccinations | % Vaccinated": "Flu Vaccinations | % Vaccinated",
        "Preventable Hospital Stays | Preventable Hospitalization Rate": "Preventable Hospital Stays | Preventable Hospitalization Rate",
        "Mammography Screening | % with Annual Mammogram": "Mammography Screening | % with Annual Mammogram",
        "Air Pollution: Particulate Matter | Average Daily PM2.5": "Air Pollution: Particulate Matter | Average Daily PM2.5",
        "Income Inequality | Income Ratio": "Income Ratio",
        "Children in Poverty | % Children in Poverty": "Children in Poverty | % Children in Poverty"
    }

    actual_indicators = list(mapping.values())
    meta_cols = ['FIPS', 'State', 'County']
    
    # Check if all exist
    missing = [c for c in actual_indicators if c not in df.columns]
    if missing:
        print(f"Error: Missing columns: {missing}")
        sys.exit(1)

    # Subset
    df = df[meta_cols + actual_indicators].copy()

    # Sort deterministically
    df = df.sort_values(by='FIPS').reset_index(drop=True)

    # Handle duplicates
    duplicates = df[df.duplicated(subset=['FIPS'], keep=False)]
    dropped_info = []
    if not duplicates.empty:
        # duplicated(keep='last') is True for all but the last occurrence
        dropped_rows = duplicates[duplicates.duplicated(subset=['FIPS'], keep='last')]
        for _, row in dropped_rows.iterrows():
            dropped_info.append(f"Dropped duplicate for FIPS: {row['FIPS']}, County: {row['County']}, State: {row['State']}")
        df = df.drop_duplicates(subset=['FIPS'], keep='last').reset_index(drop=True)

    # Process missing values
    # partial: True if ANY of the 11 indicators are null for a county
    # insufficient_data: True if > 50% (i.e. > 5) of the 11 indicators are null
    
    null_counts_per_row = df[actual_indicators].isnull().sum(axis=1)
    
    df['partial'] = null_counts_per_row > 0
    df['insufficient_data'] = null_counts_per_row > 5
    
    # Log summary
    with open(report_path, 'w') as f:
        f.write("=== PREPROCESSING REPORT ===\n")
        f.write(f"Total Counties: {len(df)}\n")
        f.write(f"Counties marked partial: {df['partial'].sum()}\n")
        f.write(f"Counties marked insufficient_data: {df['insufficient_data'].sum()}\n\n")
        
        f.write("=== PER-INDICATOR NULL COUNTS ===\n")
        for col in actual_indicators:
            null_count = df[col].isnull().sum()
            f.write(f"{col}: {null_count}\n")
            
        f.write("\n=== INDICATOR MAPPING ===\n")
        for prd_name, actual_name in mapping.items():
            if prd_name != actual_name:
                f.write(f"Matched '{prd_name}' to dataset column '{actual_name}'\n")

        if dropped_info:
            f.write("\n=== DUPLICATE HANDLING ===\n")
            f.write("The following duplicate FIPS rows were found and dropped (keeping the last occurrence):\n")
            for info in dropped_info:
                f.write(info + "\n")

    # Output to csv
    df.to_csv(output_path, index=False)
    print(f"Done. Processed data saved to {output_path}")

if __name__ == "__main__":
    main()
