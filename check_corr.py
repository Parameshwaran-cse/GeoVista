import urllib.request
import json

try:
    with urllib.request.urlopen('http://localhost:8080/api/v1/analytics/correlation') as response:
        data = json.loads(response.read().decode())
    
    keys = list(data.keys())
    
    def get_key(substr):
        for k in keys:
            if substr in k:
                return k
        return None
        
    p_phys = get_key('Poor Physical Health Days')
    p_ment = get_key('Poor Mental Health Days')
    inc_rat = get_key('Income Ratio')
    flu = get_key('Flu Vaccinations')
    mammo = get_key('Mammography Screening')
    
    print("A: Poor Physical vs Poor Mental:", data[p_phys][p_ment])
    print("B: Income Ratio vs Income Ratio:", data[inc_rat][inc_rat])
    print("C: Flu Vaccinations vs Mammography Screening:", data[flu][mammo])
except Exception as e:
    print("Error:", e)
