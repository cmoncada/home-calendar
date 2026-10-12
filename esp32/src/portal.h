// Conexión WiFi y portal de configuración (WiFiManager): WiFi, URL del servidor y token.
#pragma once

#include <Arduino.h>

#include "settings.h"

namespace portal {

constexpr const char* kApName = "HomeCalendar-Setup";
constexpr const char* kApPassword = "calendario";

/**
 * Conecta a la WiFi guardada (hasta 20 s). Si no hay WiFi, falla, faltan URL/token o
 * `forcePortal` es true, abre el portal en segundo plano y devuelve false.
 */
bool connect(Settings& settings, bool forcePortal = false);

/** ¿Está el portal abierto? */
bool active();

/**
 * Atiende el portal; llamar desde loop() mientras active().
 * Devuelve true cuando el usuario ha guardado la configuración y hay WiFi.
 */
bool process(Settings& settings);

/** Borra WiFi, URL y token y reinicia. */
[[noreturn]] void factoryReset();

}  // namespace portal
