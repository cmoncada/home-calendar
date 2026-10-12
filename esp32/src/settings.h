// Configuración persistente (NVS): URL del servidor y token del ESP32.
#pragma once

#include <Arduino.h>

struct Settings {
  String server;  // p. ej. "http://192.168.1.50" (sin barra final)
  String token;   // "hc_..."

  bool complete() const { return server.length() > 0 && token.length() > 0; }
  /** URL completa del endpoint, opcionalmente para otra fecha. */
  String endpoint(const String& date = "") const;
};

namespace settings {

Settings load();
void save(const Settings& s);
/** Borra URL y token (el reset de fábrica también borra la WiFi en portal.cpp). */
void clear();
/** Quita espacios, la barra final y un "/api/..." pegado por error; añade http:// si falta. */
String normalizeServer(String url);

}  // namespace settings
