#include "agenda.h"

#include <ArduinoJson.h>

#include <cstdio>
#include <cstdlib>

namespace agenda {

namespace {

const char* const kWeekdays[] = {"Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"};
const char* const kMonths[] = {"ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"};

std::string str(JsonVariantConst v) {
  const char* s = v.as<const char*>();
  return s ? std::string(s) : std::string();
}

// Algoritmo de Howard Hinnant: días desde 1970-01-01 ↔ fecha civil (exacto, sin zonas horarias).
long daysFromCivil(int y, unsigned m, unsigned d) {
  y -= m <= 2;
  const long era = (y >= 0 ? y : y - 399) / 400;
  const unsigned yoe = static_cast<unsigned>(y - era * 400);
  const unsigned doy = (153 * (m + (m > 2 ? -3 : 9)) + 2) / 5 + d - 1;
  const unsigned doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
  return era * 146097 + static_cast<long>(doe) - 719468;
}

void civilFromDays(long z, int& y, unsigned& m, unsigned& d) {
  z += 719468;
  const long era = (z >= 0 ? z : z - 146096) / 146097;
  const unsigned doe = static_cast<unsigned>(z - era * 146097);
  const unsigned yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
  y = static_cast<int>(yoe) + static_cast<int>(era) * 400;
  const unsigned doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
  const unsigned mp = (5 * doy + 2) / 153;
  d = doy - (153 * mp + 2) / 5 + 1;
  m = mp < 10 ? mp + 3 : mp - 9;
  y += m <= 2;
}

bool splitDate(const std::string& ymd, int& y, unsigned& m, unsigned& d) {
  if (ymd.size() != 10 || ymd[4] != '-' || ymd[7] != '-') return false;
  for (size_t i : {0u, 1u, 2u, 3u, 5u, 6u, 8u, 9u}) {
    if (ymd[i] < '0' || ymd[i] > '9') return false;
  }
  y = std::atoi(ymd.substr(0, 4).c_str());
  m = static_cast<unsigned>(std::atoi(ymd.substr(5, 2).c_str()));
  d = static_cast<unsigned>(std::atoi(ymd.substr(8, 2).c_str()));
  return true;
}

std::string formatDate(int y, unsigned m, unsigned d) {
  char buf[11];
  std::snprintf(buf, sizeof buf, "%04d-%02u-%02u", y, m, d);
  return buf;
}

int hexDigit(char c) {
  if (c >= '0' && c <= '9') return c - '0';
  if (c >= 'a' && c <= 'f') return c - 'a' + 10;
  if (c >= 'A' && c <= 'F') return c - 'A' + 10;
  return -1;
}

}  // namespace

bool parseDay(const char* json, size_t length, Day& out, std::string* error) {
  JsonDocument doc;
  DeserializationError err = deserializeJson(doc, json, length);
  if (err) {
    if (error) *error = err.c_str();
    return false;
  }
  if (!doc["date"].is<const char*>() || !doc["tasks"].is<JsonArrayConst>()) {
    if (error) *error = "Respuesta sin 'date' o 'tasks'";
    return false;
  }

  Day day;
  day.date = str(doc["date"]);
  day.weekday = str(doc["weekday"]);
  if (day.weekday.empty()) day.weekday = weekdayName(day.date);
  day.now = str(doc["now"]);
  for (JsonObjectConst t : doc["tasks"].as<JsonArrayConst>()) {
    Task task;
    task.id = t["id"] | 0;
    task.title = str(t["t"]);
    task.category = str(t["cat"]);
    task.time = str(t["time"]);
    task.end = str(t["end"]);
    task.duration = str(t["dur"]);
    task.done = t["done"] | false;
    task.color = hexToRgb565(str(t["color"]), task.color);
    for (JsonVariantConst name : t["who"].as<JsonArrayConst>()) {
      if (name.is<const char*>()) task.who.push_back(name.as<const char*>());
    }
    day.tasks.push_back(std::move(task));
  }
  // Si el servidor no los manda, se calculan de la lista
  day.total = doc["total"] | static_cast<int>(day.tasks.size());
  int pending = 0;
  for (const Task& t : day.tasks) pending += t.done ? 0 : 1;
  day.pending = doc["pending"] | pending;

  out = std::move(day);
  return true;
}

uint16_t hexToRgb565(const std::string& hex, uint16_t fallback) {
  if (hex.size() != 7 || hex[0] != '#') return fallback;
  int v[6];
  for (int i = 0; i < 6; i++) {
    v[i] = hexDigit(hex[i + 1]);
    if (v[i] < 0) return fallback;
  }
  const unsigned r = v[0] * 16 + v[1], g = v[2] * 16 + v[3], b = v[4] * 16 + v[5];
  return static_cast<uint16_t>(((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3));
}

int pageCount(int items, int perPage) {
  if (perPage <= 0 || items <= 0) return 1;
  return (items + perPage - 1) / perPage;
}

void pageRange(int items, int perPage, int page, int& first, int& last) {
  const int pages = pageCount(items, perPage);
  if (page < 0) page = 0;
  if (page >= pages) page = pages - 1;
  first = page * perPage;
  last = first + perPage < items ? first + perPage : items;
  if (first > items) first = items;
}

bool isDate(const std::string& ymd) {
  int y;
  unsigned m, d;
  if (!splitDate(ymd, y, m, d) || m < 1 || m > 12 || d < 1 || d > 31) return false;
  // La fecha es válida si sobrevive al ida y vuelta (rechaza 2026-02-30)
  return addDays(ymd, 0) == ymd;
}

std::string addDays(const std::string& ymd, int days) {
  int y;
  unsigned m, d;
  if (!splitDate(ymd, y, m, d)) return ymd;
  civilFromDays(daysFromCivil(y, m, d) + days, y, m, d);
  return formatDate(y, m, d);
}

int weekdayIndex(const std::string& ymd) {
  int y;
  unsigned m, d;
  if (!splitDate(ymd, y, m, d)) return 0;
  const long z = daysFromCivil(y, m, d);
  // 1970-01-01 fue jueves (4); módulo siempre positivo para fechas anteriores
  return static_cast<int>(((z % 7) + 7 + 4) % 7);
}

const char* weekdayName(const std::string& ymd) {
  return kWeekdays[weekdayIndex(ymd)];
}

std::string shortDate(const std::string& ymd) {
  int y;
  unsigned m, d;
  if (!splitDate(ymd, y, m, d) || m < 1 || m > 12) return ymd;
  return std::to_string(d) + " " + kMonths[m - 1];
}

std::string joinNames(const std::vector<std::string>& names) {
  std::string out;
  for (const std::string& n : names) {
    if (!out.empty()) out += ", ";
    out += n;
  }
  return out;
}

std::string fitText(const std::string& text, int maxWidth, const std::function<int(const std::string&)>& measure) {
  if (measure(text) <= maxWidth) return text;
  static const std::string kEllipsis = "...";
  // Fronteras de carácter UTF-8: bytes que no son de continuación (10xxxxxx)
  std::vector<size_t> cuts;
  for (size_t i = 1; i < text.size(); i++) {
    if ((static_cast<unsigned char>(text[i]) & 0xC0) != 0x80) cuts.push_back(i);
  }
  // Búsqueda binaria del corte más largo que todavía cabe
  int lo = 0, hi = static_cast<int>(cuts.size()) - 1, best = -1;
  while (lo <= hi) {
    const int mid = (lo + hi) / 2;
    std::string candidate = text.substr(0, cuts[mid]);
    while (!candidate.empty() && candidate.back() == ' ') candidate.pop_back();
    if (measure(candidate + kEllipsis) <= maxWidth) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (best < 0) return measure(kEllipsis) <= maxWidth ? kEllipsis : std::string();
  std::string cut = text.substr(0, cuts[best]);
  while (!cut.empty() && cut.back() == ' ') cut.pop_back();
  return cut + kEllipsis;
}

uint32_t hash(const char* data, size_t length, uint32_t seed) {
  uint32_t h = seed;
  for (size_t i = 0; i < length; i++) {
    h ^= static_cast<unsigned char>(data[i]);
    h *= 16777619u;
  }
  return h;
}

bool parseUrl(const std::string& url, Url& out) {
  const size_t sep = url.find("://");
  if (sep == std::string::npos || sep == 0) return false;
  Url u;
  u.scheme = url.substr(0, sep);
  const size_t hostStart = sep + 3;
  size_t pathStart = url.find_first_of("/?", hostStart);
  if (pathStart == std::string::npos) pathStart = url.size();
  const std::string authority = url.substr(hostStart, pathStart - hostStart);
  const size_t colon = authority.rfind(':');
  if (colon != std::string::npos) {
    u.host = authority.substr(0, colon);
    u.port = authority.substr(colon + 1);
  } else {
    u.host = authority;
  }
  if (u.host.empty()) return false;
  u.path = url.substr(pathStart);
  if (u.path.empty() || u.path[0] != '/') u.path = "/" + u.path;
  out = std::move(u);
  return true;
}

std::string buildUrl(const Url& url, const std::string& host) {
  std::string out = url.scheme + "://" + (host.empty() ? url.host : host);
  if (!url.port.empty()) out += ":" + url.port;
  return out + url.path;
}

bool isMdnsHost(const std::string& host) {
  static const std::string kSuffix = ".local";
  if (host.size() <= kSuffix.size()) return false;
  for (size_t i = 0; i < kSuffix.size(); i++) {
    char c = host[host.size() - kSuffix.size() + i];
    if (c >= 'A' && c <= 'Z') c = static_cast<char>(c - 'A' + 'a');
    if (c != kSuffix[i]) return false;
  }
  return true;
}

}  // namespace agenda
