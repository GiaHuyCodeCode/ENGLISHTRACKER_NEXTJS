const a = { createdAt: new Date().toISOString() };
const d = new Date(a.createdAt);
const aDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
console.log(aDate);
