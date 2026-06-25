import data from './src/data/zscore_data.json';
const zs = data.students;
// Sort them by Z-Score descending just like the function does
zs.sort((a,b) => b["Z-Score"] - a["Z-Score"]);

const last1 = zs[zs.length - 2];
const last2 = zs[zs.length - 1];

console.log("Last 2:");
console.log(last1["Z-Score"], "Island:", last1["Island Rank"], "District:", last1["District Rank"]);
console.log(last2["Z-Score"], "Island:", last2["Island Rank"], "District:", last2["District Rank"]);
