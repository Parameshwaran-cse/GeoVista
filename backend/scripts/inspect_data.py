import pandas as pd
import sys
import os

def main():
    try:
        # Get path relative to the script directory
        script_dir = os.path.dirname(os.path.abspath(__file__))
        project_root = os.path.dirname(os.path.dirname(script_dir))
        data_path = os.path.join(project_root, 'data', 'GeoVista_HDX_Cleaned_Base.xlsx')
        report_path = os.path.join(project_root, 'backend', 'data', 'inspection_report.txt')
        
        df = pd.read_excel(data_path)
        with open(report_path, 'w') as f:
            original_stdout = sys.stdout
            sys.stdout = f
            
            print("=== DATASET SHAPE ===")
            print(f"Rows: {df.shape[0]}, Columns: {df.shape[1]}\n")
            
            print("=== COLUMN NAMES AND DTYPES ===")
            for col in df.columns:
                print(f"{col}: {df[col].dtype}")
            print("\n")
            
            print("=== FIRST 5 ROWS ===")
            print(df.head())
            print("\n")
            
            print("=== NULL COUNT PER COLUMN ===")
            print(df.isnull().sum().to_string())
            print("\n")
            
            # Find potential region identifier (FIPS, GEOID, County, State, etc)
            id_cols = [c for c in df.columns if any(x in str(c).lower() for x in ['fips', 'geoid', 'county', 'state', 'region'])]
            print("=== POTENTIAL REGION IDENTIFIERS ===")
            print(id_cols)
            
            for col in id_cols:
                print(f"\nUnique values in {col}: {df[col].nunique()}")
                duplicates = df[df.duplicated(subset=[col], keep=False)].sort_values(by=col)
                print(f"Duplicates in {col}: {len(duplicates)} rows")
                if len(duplicates) > 0:
                    print("Sample duplicates:")
                    print(duplicates.head(10))
            
            sys.stdout = original_stdout
            print(f"Inspection complete. Saved to {report_path}")
    except Exception as e:
        print(f"Error reading file: {e}")

if __name__ == "__main__":
    main()
