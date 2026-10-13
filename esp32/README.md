# Home Calendar · pantalla ESP32 (Cheap Yellow Display)

Firmware para la **ESP32-2432S028R** (la "Cheap Yellow Display" clásica, con un solo USB): pantalla de 2,8" de 320×240 (ILI9341) y táctil resistivo (XPT2046). Muestra las tareas del día que devuelve el backend en `GET /api/display/today`.

## Qué hace

- **Lista de tareas del día.** Cada fila muestra:
  - una franja con el color de la tarea;
  - un círculo ✓ si está hecha (además, las hechas salen tachadas y atenuadas);
  - la hora de inicio y de fin, o "Todo el día";
  - el título;
  - la categoría, los responsables y la duración.
- **Táctil:**
  - **‹** y **›** en la cabecera cambian al día anterior y al siguiente;
  - **tocar la lista** o **deslizar** pasa de página (4 tareas por página);
  - si no tocas nada en 2 minutos, vuelve a hoy y a la primera página.
- **LED RGB:**

  | Color | Significado |
  |---|---|
  | Verde | Todo hecho |
  | Ámbar | Hay pendientes |
  | Rojo fijo | Token no válido |
  | Rojo parpadeando | Sin conexión |
  | Azul parpadeando | Portal de configuración abierto |

- **Brillo automático** con el sensor de luz de la placa.
- **Actualización** cada minuto. Si se cae la red, mantiene los últimos datos y avisa en el pie ("Sin conexión · hace N min").
- **Portal WiFi** para configurar WiFi, URL del servidor y token sin tocar el código.

## Requisitos

- VS Code con la extensión **PlatformIO IDE** (ya instalada en este Mac), o la consola: `~/.platformio/penv/bin/pio`.
- Cable USB **de datos**, no solo de carga.
- macOS ya trae el driver del chip USB de la placa (CH340).

## 1. Compilar y subir a la placa

Abre la carpeta `esp32/` en VS Code; PlatformIO la detecta por `platformio.ini`. En la barra inferior elige el entorno **`env:cyd`** y pulsa **→ Upload**. Desde la terminal:

```bash
cd esp32
~/.platformio/penv/bin/pio run -e cyd -t upload
~/.platformio/penv/bin/pio device monitor -e cyd
```

La primera compilación descarga el compilador y las librerías (unos minutos).

| Entorno | Para qué |
|---|---|
| `cyd` | La placa real, con WiFi y servidor |
| `cyd-mock` | La placa real con **datos de ejemplo** (sin WiFi ni servidor): para ver el diseño |
| `wokwi` | El simulador Wokwi (ver más abajo) |
| `native` | Tests de la lógica en el Mac: `pio test -e native` |

## 2. Primera configuración (portal WiFi)

1. **Genera un token** en la web: entra como administrador → **Administrar** → *Pantalla ESP32* → **Generar token**. Cópialo; solo se muestra una vez.
2. **Enciende la placa.** Al no tener configuración, muestra en pantalla las instrucciones del portal y el LED parpadea en azul.
3. **Conéctate desde el móvil** a la WiFi **`HomeCalendar-Setup`** (contraseña **`calendario`**). Se abre una página de configuración; si no, entra en **http://192.168.4.1**.
4. **Pulsa "Configure WiFi"**, elige tu red, escribe su contraseña y rellena:
   - **URL del servidor**:
     - producción: `http://homecalendar.local` (el nombre mDNS de la VM, ver la guía de Proxmox) o `http://IP-DE-LA-VM` (el puerto 80 de Nginx);
     - desarrollo en el Mac: `http://IP-DEL-MAC:3000`.
   - **Token**: `hc_…`.
5. **Guarda.** La placa se conecta y muestra las tareas.

La URL se normaliza sola: puedes pegar `192.168.1.50`, `http://192.168.1.50/` o incluso la URL completa del endpoint.

**Nombres `.local`.** El cliente HTTP del ESP32 no entiende nombres mDNS por sí solo, así que el firmware los resuelve antes de cada petición:
- guarda la IP 10 minutos;
- si la conexión falla, la vuelve a preguntar, por si la VM cambió de dirección.

Si nadie responde a ese nombre, el pie muestra "No se encuentra homecalendar.local". En ese caso, comprueba desde el Mac con `dscacheutil -q host -a name homecalendar.local` que el nombre resuelve a la IP de la VM en tu red.

**Cambiar la configuración más tarde:**
- **Mantén pulsado BOOT 3 s** (con la pantalla funcionando): se abre el portal con los valores actuales ya rellenados.
- **Reset de fábrica:** mantén **BOOT** o **la pantalla** pulsados **al encender** durante 5 s. Borra WiFi, URL y token.

## 3. Cómo simular y probar la recepción de datos

Hay cinco niveles, de menos a más real.

### a) Tests de la lógica en el Mac (sin hardware)

```bash
cd esp32 && ~/.platformio/penv/bin/pio test -e native
```

Prueban `lib/agenda`:
- el parseo del JSON, con el ejemplo del README del proyecto y datos de ejemplo;
- la paginación;
- los colores;
- las fechas (fin de mes, bisiestos);
- el recorte de textos con acentos sin romper caracteres UTF-8.

### b) Datos de ejemplo en la placa (sin WiFi ni servidor)

```bash
~/.platformio/penv/bin/pio run -e cyd-mock -t upload
```

Usa el JSON de `lib/agenda/mock_today.h` (7 tareas, 2 páginas). Es ideal para ver el diseño y probar el táctil, el LED y el brillo.

### c) Vista previa por USB: enviar un JSON a la placa

Con la placa conectada al Mac, puedes mandarle cualquier JSON con el formato de `/api/display/today` y la dibuja al momento. No hace falta WiFi, servidor ni recompilar, y funciona incluso con el portal de configuración abierto.

```bash
cd esp32
~/.platformio/penv/bin/python tools/send_json.py samples/02-muchas-tareas.json
~/.platformio/penv/bin/python tools/send_json.py samples/*.json --pause 5   # todos, uno cada 5 s
```

| Ejemplo (`samples/`) | Qué revisa |
|---|---|
| `01-normal.json` | Un día típico (7 tareas, 2 páginas) |
| `02-muchas-tareas.json` | 13 tareas → 4 páginas, puntos de paginación |
| `03-textos-largos.json` | Títulos largos, ñ y tildes, 4 responsables, tareas sin hora, cruce de medianoche |
| `04-todo-hecho.json` | Todo completado (LED verde, tachados) |
| `05-vacio.json` | Día sin tareas |
| `06-prueba-colores.json` | Franjas rojo, verde, azul, amarillo, blanco, cian y magenta: el título dice el color esperado |

También acepta comandos para ver otras pantallas:

| Comando | Pantalla |
|---|---|
| `:portal` | El portal WiFi |
| `:token` | "Token no válido" |
| `:offline` | El último JSON con el aviso "Sin conexión" |
| `:live` | Vuelve a los datos reales |

Con `-` lee el JSON de la entrada estándar, por ejemplo el de tu servidor:

```bash
curl -s -H "Authorization: Bearer hc_…" http://localhost:3000/api/display/today | ~/.platformio/penv/bin/python tools/send_json.py -
```

Detalles:
- Mientras dura la vista previa (10 minutos o hasta `:live`), el pie muestra "Vista previa (USB)" y no se piden datos al servidor.
- El táctil pasa páginas; las flechas de día no hacen nada.
- Cierra el monitor serie antes de usar el script: el puerto USB solo admite un programa a la vez.
- Al abrir el puerto, macOS reinicia la placa; el script lo detecta y espera unos segundos.

### d) Simulador Wokwi en VS Code (sin placa)

1. **Instala** la extensión **Wokwi Simulator** en VS Code y activa la licencia gratuita: F1 → *Wokwi: Request a New License*.
2. **Compila** el entorno del simulador: `pio run -e wokwi`.
3. **Abre** `esp32/diagram.json` o pulsa F1 → **Wokwi: Start Simulator**.

El simulador monta ESP32 + pantalla ILI9341 + LED RGB + sensor de luz. Wokwi no tiene el táctil XPT2046, así que se usan **pulsadores**: `< Día`, `Página`, `Día >` y `BOOT`.

- **Sin más configuración** muestra los **datos de ejemplo**.
- **Para recibir los datos reales de tu backend de desarrollo:**
  1. Levanta Docker dev en el Mac (`docker compose -f docker-compose.dev.yml up -d`).
  2. Genera un token en http://localhost:5173 → Administrar → Pantalla ESP32.
  3. Copia `include/sim_config.example.h` como `include/sim_config.h` (está en `.gitignore`) y pega el token.
  4. Recompila con `pio run -e wokwi` y arranca el simulador.

  El simulador se conecta a la WiFi `Wokwi-GUEST` y llama a `http://host.wokwi.internal:3000`. Ese nombre apunta a tu Mac a través del *Private IoT Gateway* que la extensión de VS Code incluye. Si en tu licencia no está disponible, la petición fallará ("Sin conexión"); en ese caso, usa los datos de ejemplo o la placa real.

### e) Placa real contra el backend de desarrollo del Mac

1. **Averigua la IP del Mac** con `ipconfig getifaddr en0`.
2. **Comprueba el endpoint con curl** desde el Mac, con un token de desarrollo:

   ```bash
   curl -H "Authorization: Bearer hc_TU_TOKEN" http://IP-DEL-MAC:3000/api/display/today
   ```

3. **En el portal**, pon como URL `http://IP-DEL-MAC:3000` y ese token. La placa y el Mac deben estar en la misma red; el firewall de macOS puede pedir permiso para Docker.
4. **Prueba otros días** con `?date=2026-10-13` en el curl, o con las flechas en la placa.

Cuando funcione, cambia la URL a la de la VM de producción (BOOT 3 s) y usa un token generado en producción.

## Ajustes finos

**Táctil desplazado:**
1. Compila con los valores de depuración del táctil:

   ```bash
   PLATFORMIO_BUILD_FLAGS="-DTOUCH_DEBUG" pio run -e cyd -t upload && pio device monitor -e cyd
   ```

2. Toca las cuatro esquinas.
3. Copia los valores `raw` mínimos y máximos en `kTouchRaw*` de `include/board.h`.

**Brillo automático:**
1. Compila con `-DLDR_DEBUG` y apunta la lectura del LDR con la habitación iluminada y a oscuras.
2. Ponlas en `kLdrBright` / `kLdrDark` de `include/board.h`. En la CYD la lectura **baja** cuando hay más luz.

**Frecuencia de actualización y tareas por página:** `kRefreshMs` en `src/main.cpp` y `kRowsPerPage` en `src/ui.h`.

## Solución de problemas

| Síntoma | Solución |
|---|---|
| Colores invertidos (fondo blanco, rojo→cian, verde→morado, azul→amarillo) | Envía `samples/06-prueba-colores.json` para comprobarlo. Si están invertidos, cambia en `env:cyd` de `platformio.ini` `-DTFT_INVERSION_ON=1` por `-DTFT_INVERSION_OFF=1` (o al revés). La placa de este proyecto necesita `ON`. |
| Rojo y azul intercambiados (el verde bien) | Añade `-DTFT_RGB_ORDER=TFT_BGR` en `env:cyd`. |
| Pantalla en blanco | Algunas placas necesitan otro driver: en `env:cyd` cambia `-DILI9341_2_DRIVER` por `-DILI9341_DRIVER`. |
| No aparece el puerto al subir | Prueba otro cable (de datos) o puerto. Mantén BOOT pulsado al empezar la subida si se queda en "Connecting…". |
| "Token no válido" | El token se revocó o es de otro servidor (dev o prod). Genera uno nuevo y cámbialo con BOOT 3 s. |
| "No se encuentra NOMBRE.local" | La VM no responde por mDNS. Comprueba que `avahi-daemon` está activo en la VM y que el nombre resuelve a la IP de tu red (no a una `172.x` de Docker). Mientras tanto, puedes usar la IP. |
| "Sin conexión" | Comprueba la URL con curl desde otro equipo de la misma red. En dev, el puerto es `:3000`; en producción, `:80`. |
| No veo tareas privadas | Es intencionado: la pantalla nunca muestra tareas privadas. |

## Estructura

```
esp32/
├── platformio.ini        entornos cyd, cyd-mock, wokwi y native; configuración de TFT_eSPI
├── wokwi.toml, diagram.json   simulador
├── include/board.h       pines y calibración de la CYD
├── include/sim_config.example.h
├── src/main.cpp          bucle principal: datos, táctil, refresco
├── src/api.*             GET /api/display/today con el token Bearer
├── src/portal.*          WiFiManager (WiFi + URL + token)
├── src/settings.*        URL y token guardados en NVS
├── src/ui.*              dibujo con TFT_eSPI + fuentes U8g2 (con acentos)
├── src/touch.*           XPT2046 (o pulsadores en el simulador)
├── src/status_led.*      LED RGB y brillo automático
├── lib/agenda/           lógica pura y testeable: JSON, páginas, fechas, textos
├── test/test_agenda/     tests Unity (pio test -e native)
├── tools/send_json.py    vista previa: envía un JSON por USB a la placa
└── samples/              JSON de ejemplo para la vista previa
```

El firmware depende del formato de `/api/display/today` (`backend/src/routes/display.js`). Si cambia el JSON, actualiza `lib/agenda` y sus tests.
