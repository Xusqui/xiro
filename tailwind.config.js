/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./app/public/*.html",
        "./app/public/**/*.{html,js}",
    ],
    // Las clases dinámicas se gestionan en app/public/_tailwind-safelist.html
    // (escaneado automáticamente por el bloque content de arriba).
    // No usar este array — fuente única de verdad: _tailwind-safelist.html
    safelist: [],
    theme: {
        extend: {},
    },
    plugins: [],
}
