// Sustituto mínimo: la skill nunca escribe en /uploads (import.service.js solo lee uploadDir)
module.exports = { uploadDir: require('path').join(__dirname, '../uploads') };
