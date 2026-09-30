from fastapi.testclient import TestClient
from backend.app.main import app

# We need to trigger the startup event manually for TestClient
with TestClient(app) as client:
    
    def test_health():
        response = client.get("/api/v1/health")
        assert response.status_code == 200
    
    def test_geojson():
        response = client.get("/api/v1/geojson/counties")
        assert response.status_code == 200
    
    def test_indicators():
        response = client.get("/api/v1/indicators")
        assert response.status_code == 200
    
    def test_regions():
        response = client.get("/api/v1/regions")
        assert response.status_code == 200
    
    def test_map_valid():
        response = client.get("/api/v1/map?indicator=overall")
        assert response.status_code == 200
        
        response2 = client.get("/api/v1/map?indicator=Income Ratio")
        assert response2.status_code == 200
    
    def test_map_invalid():
        response = client.get("/api/v1/map?indicator=invalid_indicator")
        assert response.status_code == 404
    
    def test_region_valid():
        response = client.get("/api/v1/region/01001")
        assert response.status_code == 200
    
    def test_region_invalid():
        response = client.get("/api/v1/region/99999")
        assert response.status_code == 404
    
    def test_rankings_valid():
        response = client.get("/api/v1/rankings?metric=health_score")
        assert response.status_code == 200
    
    def test_rankings_invalid():
        response = client.get("/api/v1/rankings?metric=invalid_metric")
        assert response.status_code == 400
    
    def test_analytics_correlation():
        response = client.get("/api/v1/analytics/correlation")
        assert response.status_code == 200
