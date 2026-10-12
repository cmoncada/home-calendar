// Dibujo de la pantalla (320x240 en horizontal) con TFT_eSPI + fuentes U8g2 (acentos y ñ).
#pragma once

#include <Arduino.h>

#include "agenda.h"

namespace ui {

constexpr int kRowsPerPage = 4;

enum class Zone { PrevDay, NextDay, List };

struct ViewState {
  bool isToday = true;
  int page = 0;
  int pages = 1;
  String footer;         // "Act. 08:15" o "Sin conexión · hace 3 min"
  bool footerAlert = false;
};

void begin();

/** Lista de tareas del día (cabecera, filas de la página actual y pie). */
void drawDay(const agenda::Day& day, const ViewState& view);

/** Pantalla de aviso a pantalla completa (arranque, errores). `body` admite saltos de línea. */
void drawMessage(const char* title, const String& body, uint16_t accent);

/** Instrucciones del portal de configuración WiFi. */
void drawPortal(const char* apName, const char* apPassword, const String& ip);

/** Qué zona de la pantalla se ha tocado. */
Zone hit(int x, int y);

// Colores de la interfaz (RGB565), mismos tonos que el tema oscuro de la web
namespace color {
constexpr uint16_t rgb(uint8_t r, uint8_t g, uint8_t b) {
  return static_cast<uint16_t>(((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3));
}
constexpr uint16_t kBg = rgb(0x14, 0x14, 0x14);
constexpr uint16_t kSurface = rgb(0x1f, 0x1f, 0x1f);
constexpr uint16_t kDivider = rgb(0x33, 0x33, 0x33);
constexpr uint16_t kText = rgb(0xf5, 0xf5, 0xf5);
constexpr uint16_t kMuted = rgb(0xa3, 0xa3, 0xa3);
constexpr uint16_t kFaint = rgb(0x6d, 0x6d, 0x6d);
constexpr uint16_t kAccent = rgb(0xe5, 0x09, 0x14);
constexpr uint16_t kSuccess = rgb(0x2e, 0xcc, 0x71);
constexpr uint16_t kDanger = rgb(0xff, 0x5c, 0x5c);
constexpr uint16_t kWarning = rgb(0xf5, 0xc5, 0x18);
constexpr uint16_t kInfo = rgb(0x00, 0x71, 0xeb);
}  // namespace color

}  // namespace ui
