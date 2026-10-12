// Copia este archivo como sim_config.h (no se sube a git) para que el simulador Wokwi
// pida los datos reales al backend de desarrollo del Mac. Sin sim_config.h usa datos de ejemplo.
#pragma once

// host.wokwi.internal = tu Mac (gateway privado de Wokwi para VS Code). Puerto 3000 = API de Docker dev.
#define SIM_SERVER "http://host.wokwi.internal:3000"
// Token generado en Administrar > Pantalla ESP32 (en el backend de desarrollo)
#define SIM_TOKEN "hc_pega_aqui_tu_token"
