import data from './src/data/zscore_data.json';
const zs = data.students;
const minZ = Math.min(...zs.map(s => s["Z-Score"]));
console.log("Min Z-Score in students:", minZ);
