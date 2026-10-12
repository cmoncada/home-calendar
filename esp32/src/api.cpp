#include "api.h"

#include <HTTPClient.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>

#include <memory>

#include "mock_today.h"

namespace api {

namespace {
constexpr uint16_t kConnectTimeoutMs = 5000;
constexpr uint16_t kReadTimeoutMs = 8000;
// Respuesta máxima que se acepta (unas 60 tareas). Evita quedarse sin memoria.
constexpr size_t kMaxBody = 24 * 1024;
}  // namespace

FetchResult fetchDay(const Settings& settings, const String& date, agenda::Day& out) {
  FetchResult result;
  if (WiFi.status() != WL_CONNECTED) {
    result.message = "Sin WiFi";
    return result;
  }

  // HTTPS opcional (p. ej. detrás de un proxy con certificado). No se valida el certificado:
  // es una red doméstica y el ESP32 no tiene dónde guardar la CA de forma práctica.
  const String url = settings.endpoint(date);
  std::unique_ptr<WiFiClient> client;
  if (url.startsWith("https://")) {
    auto* secure = new WiFiClientSecure();
    secure->setInsecure();
    client.reset(secure);
  } else {
    client.reset(new WiFiClient());
  }

  HTTPClient http;
  http.setConnectTimeout(kConnectTimeoutMs);
  http.setTimeout(kReadTimeoutMs);
  http.setReuse(false);
  if (!http.begin(*client, url)) {
    result.message = "URL inválida";
    return result;
  }
  http.addHeader("Authorization", "Bearer " + settings.token);
  http.addHeader("Accept", "application/json");

  const int code = http.GET();
  result.httpCode = code;
  if (code <= 0) {
    result.message = HTTPClient::errorToString(code);
    http.end();
    return result;
  }
  if (code == HTTP_CODE_UNAUTHORIZED) {
    result.status = FetchStatus::Unauthorized;
    result.message = "Token inválido o revocado";
    http.end();
    return result;
  }
  if (code != HTTP_CODE_OK) {
    result.status = FetchStatus::HttpError;
    result.message = "HTTP " + String(code);
    http.end();
    return result;
  }

  const int size = http.getSize();
  if (size > static_cast<int>(kMaxBody)) {
    result.status = FetchStatus::ParseError;
    result.message = "Respuesta demasiado grande";
    http.end();
    return result;
  }
  // El cuerpo se lee entero: se necesita para el hash y para el parseo (es pequeño)
  const String body = http.getString();
  http.end();

  std::string error;
  agenda::Day day;
  if (!agenda::parseDay(body.c_str(), body.length(), day, &error)) {
    result.status = FetchStatus::ParseError;
    result.message = String("JSON: ") + error.c_str();
    return result;
  }
  out = std::move(day);
  result.status = FetchStatus::Ok;
  result.hash = agenda::hash(body.c_str(), body.length());
  return result;
}

FetchResult mockDay(const String& date, agenda::Day& out) {
  FetchResult result;
  agenda::Day day;
  agenda::parseDay(agenda::kMockToday, sizeof(agenda::kMockToday) - 1, day);
  if (date.length() && date != day.date.c_str()) {
    // Otros días: misma lista con la fecha pedida y la mitad de tareas, para que se note el cambio
    day.date = date.c_str();
    day.weekday = agenda::weekdayName(day.date);
    const int parity = agenda::weekdayIndex(day.date) % 2;
    std::vector<agenda::Task> kept;
    for (size_t i = 0; i < day.tasks.size(); i++) {
      if (static_cast<int>(i % 2) == parity) kept.push_back(day.tasks[i]);
    }
    day.tasks = std::move(kept);
    day.total = day.tasks.size();
    day.pending = 0;
    for (const auto& t : day.tasks) day.pending += t.done ? 0 : 1;
  }
  result.hash = agenda::hash(day.date.data(), day.date.size(), day.tasks.size());
  result.status = FetchStatus::Ok;
  out = std::move(day);
  return result;
}

}  // namespace api
