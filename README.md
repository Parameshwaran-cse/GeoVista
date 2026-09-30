# GeoVista-HDX

GeoVista-HDX is a research tool and interactive dashboard designed for regional health-disparity analysis. It aggregates complex health outcomes, clinical care behaviors, and socioeconomic determinants across US counties into a unified visualization platform, enabling researchers, students, and public-health analysts to easily identify and investigate geographic health inequities.

## Tech Stack
*   **Backend:** Python 3, FastAPI, Uvicorn, Pandas (for data pipeline/scoring), Pytest
*   **Frontend:** React 19, Vite, React Leaflet (for mapping), Recharts (for analytics), Vitest, Playwright

## Setup Instructions

### 1. Backend Setup & Data Pipeline
Ensure you have Python 3.10+ installed.

```bash
# Navigate to the backend directory
cd backend/

# Create and activate a virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run the data processing pipeline (Cleans the raw HDX data)
python pipeline/preprocess.py

# Run the scoring pipeline (Generates classifications and scores)
python scoring/score.py
```

### 2. Running the Backend Server
With the virtual environment still active:
```bash
# Start the FastAPI server (defaults to http://localhost:8080)
uvicorn app.main:app --host 0.0.0.0 --port 8080 --reload
```
You can view the interactive API documentation at `http://localhost:8080/docs`.

### 3. Frontend Setup & Running
In a new terminal window:
```bash
# Navigate to the frontend directory
cd frontend/

# Install dependencies
npm install

# Start the Vite development server (defaults to http://localhost:5173 or 5174)
npm run dev
```
Visit the local URL provided by Vite (e.g., `http://localhost:5173`) in your browser to view the application.

## Testing

GeoVista-HDX includes a robust suite of automated tests for both the backend algorithms and frontend interfaces.

**Backend Tests (Pytest)**
```bash
cd backend/
pytest tests/
```

**Frontend Component Tests (Vitest)**
```bash
cd frontend/
npx vitest run
```

**Browser End-to-End Tests (Playwright)**
Ensure the frontend development server is running on `http://localhost:5174` (or update the URL in `app.spec.js`), then run:
```bash
cd frontend/
npx playwright test tests/app.spec.js
```

## Project Structure
*   **`backend/`**: Contains the FastAPI server (`app/`), the pandas-driven data pipelines (`pipeline/`, `scoring/`), and the backend unit/integration tests (`tests/`).
*   **`data/`**: The persistent storage directory for the raw dataset (`GeoVista_HDX_Cleaned_Base.xlsx`), generated `.csv` artifacts, logging reports, and static mapping files (`counties.json`).
*   **`frontend/`**: The React/Vite web application, containing components (`src/`), styling (`src/*.css`), and frontend test suites (`src/*.test.jsx`, `tests/`).
*   **`METHODOLOGY.md`**: A detailed, faculty-facing document outlining the epidemiological logic, weighting schemas, and data selection rules.

## Known Limitations
*   **Missing Data Exclusions**: Due to strict statistical reliability rules, 27 counties are completely excluded from the dashboard due to insufficient data (>50% indicators missing).
*   **Boundary Mismatches**: There are approximately 64 FIPS mismatches between the health dataset and the rendering GeoJSON boundary file due to real-world historical boundary shifts (e.g., in Alaska). These appear as empty spaces on the map.
*   **Temporal Scope**: This application visualizes a single cross-sectional snapshot in time and does not currently support multi-year time-series analysis.
