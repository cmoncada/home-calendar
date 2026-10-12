// Genera los iconos de la PWA a partir de los SVG de diseño de frontend/src/images.
//   pnpm icons
// Salida en frontend/public (se sirve tal cual en la raíz del sitio):
//   favicon.svg               copia del favicon adaptativo (claro/oscuro según el sistema)
//   icons/favicon-32.png      favicon de respaldo para navegadores sin soporte SVG
//   icons/apple-touch-icon.png  180x180, cuadrado y opaco (iOS redondea las esquinas)
//   icons/icon-192.png, icon-512.png   iconos de la app (manifest, purpose "any")
//   icons/maskable-512.png    icono adaptable de Android (fondo a sangre, purpose "maskable")
import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

// sharp ya es dependencia del backend: se reutiliza en lugar de añadirla al frontend
const require = createRequire(new URL('../../backend/package.json', import.meta.url));
const sharp = require('sharp');

const images = new URL('../src/images/', import.meta.url);
const pub = new URL('../public/', import.meta.url);
const icons = new URL('icons/', pub);

const appleSvg = await readFile(new URL('apple-touch-icon.svg', images), 'utf8');
// Versión a sangre (sin esquinas redondeadas): iOS y Android aplican su propia máscara,
// y las esquinas transparentes se verían negras en iOS.
const squareSvg = appleSvg.replace(/<rect([^>]*?)rx="[^"]*"/, '<rect$1');
if (squareSvg === appleSvg) throw new Error('apple-touch-icon.svg: no se encontró el fondo con rx');

const render = (svg, size, file, { opaque = false } = {}) => {
  let img = sharp(Buffer.from(svg), { density: 72 * (size / 180) * 2 }).resize(size, size);
  // Los iconos a sangre se aplanan sobre blanco: sin canal alfa, sin bordes negros en iOS
  if (opaque) img = img.flatten({ background: '#ffffff' });
  return img.png({ compressionLevel: 9 }).toFile(fileURLToPath(new URL(file, icons)));
};

await mkdir(icons, { recursive: true });
await copyFile(new URL('favicon.svg', images), new URL('favicon.svg', pub));
await Promise.all([
  render(squareSvg, 180, 'apple-touch-icon.png', { opaque: true }),
  render(appleSvg, 192, 'icon-192.png'),
  render(appleSvg, 512, 'icon-512.png'),
  render(squareSvg, 512, 'maskable-512.png', { opaque: true }),
  // librsvg no entiende las variables CSS del favicon adaptativo: el PNG sale de la versión clara
  sharp(await readFile(new URL('icon_light.svg', images)), { density: 300 })
    .resize(32, 32)
    .png()
    .toFile(fileURLToPath(new URL('favicon-32.png', icons))),
]);
console.log('Iconos PWA generados en frontend/public');
