// Mínimos para el navegador de los televisores Samsung de 2022 (Tizen 6.5, motor Chromium ~85).
// `build.target` en vite.config.js solo traduce sintaxis: las funciones nuevas hay que añadirlas aquí.
// - Object.hasOwn (Chromium 93): lo usa Pinia.
// - Array.prototype.at (Chromium 92): lo usa BaseModal.

if (!Object.hasOwn) {
  Object.hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
}

if (!Array.prototype.at) {
  Object.defineProperty(Array.prototype, 'at', {
    value(index) {
      let i = Math.trunc(index) || 0;
      if (i < 0) i += this.length;
      return this[i];
    },
    writable: true,
    configurable: true,
  });
}
