import { ref } from 'vue';

// El tema se aplica también desde un script en index.html antes de montar la app (evita parpadeo).
const STORAGE_KEY = 'hc.theme';
const META_COLORS = { dark: '#141414', light: '#f4f4f1' };

function read() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
  } catch {
    /* almacenamiento no disponible */
  }
  return 'dark';
}

export const theme = ref(read());

function apply(value) {
  document.documentElement.dataset.theme = value;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', META_COLORS[value]);
}

export function setTheme(value) {
  theme.value = value;
  apply(value);
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    /* almacenamiento no disponible */
  }
}

export function toggleTheme() {
  setTheme(theme.value === 'dark' ? 'light' : 'dark');
}

apply(theme.value);
