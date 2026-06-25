import data from './src/data/zscore_data.json';
const zs = data.students;
zs.sort((a,b) => b["Z-Score"] - a["Z-Score"]);

let islandIssues = 0;
let districtIssues = 0;

for (let i = 0; i < zs.length - 1; i++) {
   if (zs[i]["Island Rank"] > zs[i+1]["Island Rank"]) {
      islandIssues++;
   }
   if (zs[i]["District Rank"] > zs[i+1]["District Rank"]) {
      districtIssues++;
   }
}

console.log("Island rank monotonicity violations:", islandIssues);
console.log("District rank monotonicity violations:", districtIssues);
