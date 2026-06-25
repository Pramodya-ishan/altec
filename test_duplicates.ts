import data from './src/data/zscore_data.json';
const zs = data.students.map(s => s["Z-Score"]);
const zSet = new Set(zs);
console.log("Total students:", zs.length);
console.log("Unique Z-scores:", zSet.size);

const sorted = zs.sort((a,b)=>b-a);
for(let i=0; i<sorted.length-1; i++){
  if(sorted[i] === sorted[i+1]) {
    console.log("Duplicate Z:", sorted[i]);
  }
}
