const existing = { a: 1, b: 2 };
const data = { a: undefined, c: 3 };
const merged = { ...existing, ...data };
console.log(merged);
