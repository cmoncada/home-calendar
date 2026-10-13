// Lógica pura de la pantalla (sin Arduino): modelo del día, parseo del JSON de
// /api/display/today, paginación, fechas y textos. Se prueba en el Mac con `pio test -e native`.
#pragma once

#include <cstddef>
#include <cstdint>
#include <functional>
#include <string>
#include <vector>

namespace agenda {

struct Task {
  int id = 0;
  std::string title;     // "t"
  std::string category;  // "cat" (puede venir vacío)
  std::string time;      // "time": "HH:MM" o vacío (todo el día / continúa de otro día)
  std::string end;       // "end"
  std::string duration;  // "dur": "1h", "2d"
  std::vector<std::string> who;
  bool done = false;
  uint16_t color = 0xE042;  // RGB565 de "color" (#e50914 por defecto)
};

struct Day {
  std::string date;     // YYYY-MM-DD
  std::string weekday;  // "Lunes"
  std::string now;      // hora del servidor al responder, "HH:MM"
  int total = 0;
  int pending = 0;
  std::vector<Task> tasks;
};

/** Parsea la respuesta del endpoint. Devuelve false (y un mensaje) si el JSON no es válido. */
bool parseDay(const char* json, size_t length, Day& out, std::string* error = nullptr);

/** "#rrggbb" → RGB565. Si no es válido devuelve `fallback`. */
uint16_t hexToRgb565(const std::string& hex, uint16_t fallback);

/** Nº de páginas para `items` elementos (mínimo 1). */
int pageCount(int items, int perPage);

/** Índices [first, last) de la página `page` (se ajusta al rango válido). */
void pageRange(int items, int perPage, int page, int& first, int& last);

// ---------- Fechas YYYY-MM-DD ----------
bool isDate(const std::string& ymd);
std::string addDays(const std::string& ymd, int days);
/** 0 = domingo … 6 = sábado */
int weekdayIndex(const std::string& ymd);
/** "Lunes", "Martes"… */
const char* weekdayName(const std::string& ymd);
/** "12 oct" */
std::string shortDate(const std::string& ymd);

// ---------- Textos UTF-8 ----------
/** Une los responsables: "Ana, Luis". */
std::string joinNames(const std::vector<std::string>& names);
/**
 * Recorta `text` para que quepa en `maxWidth` según `measure` (ancho en píxeles),
 * añadiendo "..." y sin cortar nunca un carácter UTF-8 por la mitad.
 */
std::string fitText(const std::string& text, int maxWidth, const std::function<int(const std::string&)>& measure);

/** Hash FNV-1a: detecta si los datos cambiaron para no redibujar sin necesidad. */
uint32_t hash(const char* data, size_t length, uint32_t seed = 2166136261u);

// ---------- URLs ----------
struct Url {
  std::string scheme;  // "http" / "https"
  std::string host;    // "homecalendar.local", "192.168.1.14"
  std::string port;    // "" = el de por defecto
  std::string path;    // "/api/display/today?date=…" (siempre empieza por "/")
};

/** Separa "http://host:puerto/ruta". Devuelve false si no tiene esquema o host. */
bool parseUrl(const std::string& url, Url& out);
/** Vuelve a montar la URL; `host` permite sustituir el nombre (p. ej. por la IP resuelta). */
std::string buildUrl(const Url& url, const std::string& host = "");
/** ¿Es un nombre mDNS ("algo.local")? El cliente HTTP del ESP32 no los resuelve solo. */
bool isMdnsHost(const std::string& host);

}  // namespace agenda
