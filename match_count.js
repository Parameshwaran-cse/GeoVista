const fs = require('fs');

const geojson = JSON.parse(fs.readFileSync('data/us_counties_simplified.geojson'));
const mapDataDf = fs.readFileSync('data/scored_counties.csv', 'utf8').split('\n');

const mapFips = new Set();
const insufficientFips = new Set();

for (let i = 1; i < mapDataDf.length; i++) {
    const line = mapDataDf[i].split(',');
    if (line.length > 3) {
        const fips = line[0];
        const status = line[25]; // index of score_status is 25? Wait, let's just parse it properly or use the API
    }
}
