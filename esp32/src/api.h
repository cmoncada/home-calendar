// Cliente de GET /api/display/today (token Bearer).
#pragma once

#include <Arduino.h>

#include "agenda.h"
#include "settings.h"

enum class FetchStatus {
  Ok,
  Unauthorized,   // 401: token inválido o revocado
  HttpError,      // otro código HTTP
  NetworkError,   // sin WiFi, timeout, servidor caído
  ParseError,     // respuesta que no es el JSON esperado
};

struct FetchResult {
  FetchStatus status = FetchStatus::NetworkError;
  int httpCode = 0;
  uint32_t hash = 0;  // huella de la respuesta (para no redibujar si no cambió)
  String message;     // detalle para la pantalla/monitor serie
};

namespace api {

/** Pide el día `date` ("" = hoy según el servidor). Rellena `out` solo si el resultado es Ok. */
FetchResult fetchDay(const Settings& settings, const String& date, agenda::Day& out);

/** Versión sin red (MOCK_DATA o simulador sin configurar): datos de ejemplo en la fecha pedida. */
FetchResult mockDay(const String& date, agenda::Day& out);

}  // namespace api
