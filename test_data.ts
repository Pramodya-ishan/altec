import data from './src/data/zscore_data.json';
const zs = data.students;
console.log("First:", zs[0]["Z-Score"], zs[0]["District Rank"], zs[0]["Island Rank"]);
console.log("Last:", zs[zs.length-1]["Z-Score"], zs[zs.length-1]["District Rank"], zs[zs.length-1]["Island Rank"]);
