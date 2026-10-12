// Home Calendar · pantalla ESP32 (Cheap Yellow Display)
//
// Muestra las tareas del día de GET /api/display/today. Táctil: ‹ › cambia de día,
// tocar la lista o deslizar pasa de página. BOOT 3 s = abrir el portal de configuración.
// Mantener BOOT o la pantalla pulsados 5 s al encender = borrar WiFi, URL y token.

#include <Arduino.h>
#include <WiFi.h>

#include "agenda.h"
#include "api.h"
#include "board.h"
#include "portal.h"
#include "settings.h"
#include "status_led.h"
#include "touch.h"
#include "ui.h"

#if defined(SIMULATOR) && __has_include("sim_config.h")
#include "sim_config.h"
#define HAVE_SIM_CONFIG 1
#endif

#if defined(MOCK_DATA) || (defined(SIMULATOR) && !defined(HAVE_SIM_CONFIG))
constexpr bool kUseMock = true;
#else
constexpr bool kUseMock = false;
#endif

namespace {

constexpr uint32_t kRefreshMs = 60 * 1000;        // datos nuevos cada minuto
constexpr uint32_t kRetryMs = 30 * 1000;          // reintento tras un error
constexpr uint32_t kIdleBackToTodayMs = 2 * 60 * 1000;
constexpr uint32_t kFooterTickMs = 30 * 1000;     // refresca "hace N min"
constexpr uint32_t kBootHoldMs = 3000;            // BOOT: abrir portal
constexpr uint32_t kFactoryHoldMs = 5000;         // al encender: reset de fábrica

Settings cfg;
agenda::Day day;
bool hasData = false;
String todayDate;          // fecha de "hoy" según el servidor
String viewDate;           // "" = hoy; si no, YYYY-MM-DD
int page = 0;
uint32_t lastHash = 0;
FetchStatus lastStatus = FetchStatus::Ok;
String lastError;
bool todayAllDone = false;

uint32_t lastFetchMs = 0;
uint32_t nextFetchMs = 0;
bool fetchNow = true;      // pedir datos en la próxima vuelta del loop
uint32_t lastOkMs = 0;
uint32_t lastTouchMs = 0;
uint32_t lastFooterMs = 0;
uint32_t bootPressedMs = 0;
bool fatalShown = false;   // hay un mensaje a pantalla completa (token inválido, etc.)

int pages() {
  return agenda::pageCount(static_cast<int>(day.tasks.size()), ui::kRowsPerPage);
}

bool viewingToday() {
  return viewDate.isEmpty() || viewDate == todayDate;
}

String footerText(bool& alert) {
  alert = false;
  if (kUseMock) return "Datos de ejemplo";
  if (lastStatus != FetchStatus::Ok && hasData) {
    alert = true;
    const uint32_t mins = (millis() - lastOkMs) / 60000;
    return mins ? "Sin conexión · hace " + String(mins) + " min" : "Sin conexión · reintentando";
  }
  return day.now.empty() ? String("") : "Act. " + String(day.now.c_str());
}

void render() {
  if (!hasData) return;
  fatalShown = false;
  ui::ViewState view;
  view.isToday = viewingToday();
  view.pages = pages();
  page = constrain(page, 0, view.pages - 1);
  view.page = page;
  view.footer = footerText(view.footerAlert);
  ui::drawDay(day, view);
  lastFooterMs = millis();
}

void updateLed() {
  if (lastStatus == FetchStatus::Unauthorized) light::setLed(LedState::Error);
  else if (lastStatus != FetchStatus::Ok) light::setLed(hasData ? LedState::Offline : LedState::Error);
  else light::setLed(todayAllDone ? LedState::AllDone : LedState::Pending);
}

void fetch() {
  const uint32_t now = millis();
  lastFetchMs = now;
  fetchNow = false;
  if (!hasData) light::setLed(LedState::Working);

  agenda::Day fresh;
  const String requested = viewingToday() ? String("") : viewDate;
  const FetchResult r = kUseMock ? api::mockDay(requested, fresh) : api::fetchDay(cfg, requested, fresh);
  lastStatus = r.status;
  Serial.printf("GET %s -> %d %s\n", requested.length() ? requested.c_str() : "hoy", r.httpCode, r.message.c_str());

  if (r.status == FetchStatus::Ok) {
    lastOkMs = now;
    lastError = "";
    nextFetchMs = now + kRefreshMs;
    if (requested.isEmpty()) {
      todayDate = fresh.date.c_str();
      todayAllDone = fresh.pending == 0;
    }
    const bool changed = !hasData || r.hash != lastHash || fresh.date != day.date || fatalShown;
    day = std::move(fresh);
    hasData = true;
    lastHash = r.hash;
    if (changed) render();
    updateLed();
    return;
  }

  lastError = r.message;
  nextFetchMs = now + kRetryMs;
  updateLed();
  if (r.status == FetchStatus::Unauthorized) {
    hasData = false;
    fatalShown = true;
    ui::drawMessage("Token no válido",
                    "Genera uno nuevo en Administrar > Pantalla ESP32\ny mantén pulsado BOOT 3 s para cambiarlo.",
                    ui::color::kDanger);
  } else if (!hasData) {
    fatalShown = true;
    ui::drawMessage("Sin conexión", cfg.server + "\n" + r.message + "\nReintentando cada 30 s", ui::color::kDanger);
  } else {
    render();  // se mantienen los datos anteriores con el aviso en el pie
  }
}

void goToDay(int delta) {
  const std::string base = hasData ? day.date : std::string(todayDate.c_str());
  if (base.empty()) return;
  const String target = agenda::addDays(base, delta).c_str();
  viewDate = target == todayDate ? String("") : target;
  page = 0;
  fetchNow = true;
}

void handleTouch() {
  const TouchEvent ev = touch::poll();
  if (ev.gesture == Gesture::None) return;
  lastTouchMs = millis();
  if (!hasData) {  // en una pantalla de error, tocar = reintentar ya
    fetchNow = true;
    return;
  }
  const int total = pages();
  if (ev.gesture == Gesture::SwipeLeft) {
    page = (page + 1) % total;
    render();
  } else if (ev.gesture == Gesture::SwipeRight) {
    page = (page - 1 + total) % total;
    render();
  } else {
    switch (ui::hit(ev.x, ev.y)) {
      case ui::Zone::PrevDay: goToDay(-1); break;
      case ui::Zone::NextDay: goToDay(1); break;
      case ui::Zone::List:
        if (total > 1) {
          page = (page + 1) % total;
          render();
        }
        break;
    }
  }
}

/** Al encender: BOOT o pantalla pulsados 5 s → reset de fábrica. */
void checkFactoryReset() {
  if (digitalRead(board::kBootButton) == HIGH && !touch::isPressed()) return;
  const uint32_t start = millis();
  while (digitalRead(board::kBootButton) == LOW || touch::isPressed()) {
    const uint32_t held = millis() - start;
    const int left = (kFactoryHoldMs - min(held, kFactoryHoldMs) + 999) / 1000;
    ui::drawMessage("Borrar configuración", "Sigue pulsando " + String(left) + " s para borrar\nWiFi, URL y token.",
                    ui::color::kWarning);
    if (held >= kFactoryHoldMs) portal::factoryReset();
    delay(250);
  }
  ui::drawMessage("Cancelado", "Se mantiene la configuración.", ui::color::kInfo);
  delay(800);
}

/** BOOT mantenido 3 s con la pantalla funcionando → abrir el portal para cambiar WiFi/URL/token. */
void checkBootButton() {
  if (kUseMock) return;
  if (digitalRead(board::kBootButton) == LOW) {
    if (!bootPressedMs) bootPressedMs = millis();
    if (millis() - bootPressedMs >= kBootHoldMs && !portal::active()) {
      bootPressedMs = 0;
#ifndef SIMULATOR
      portal::connect(cfg, true);
#endif
    }
  } else {
    bootPressedMs = 0;
  }
}

bool connectWifi() {
#ifdef SIMULATOR
  // Wokwi ofrece una WiFi abierta "Wokwi-GUEST" en el canal 6
  ui::drawMessage("Conectando…", "Wokwi-GUEST", ui::color::kInfo);
  WiFi.begin("Wokwi-GUEST", "", 6);
  for (int i = 0; i < 100 && WiFi.status() != WL_CONNECTED; i++) delay(100);
  return WiFi.status() == WL_CONNECTED;
#else
  cfg = settings::load();
  ui::drawMessage("Conectando…", cfg.complete() ? "WiFi guardada" : "Primera configuración", ui::color::kInfo);
  return portal::connect(cfg);
#endif
}

}  // namespace

void setup() {
  Serial.begin(115200);
  Serial.println("\nHome Calendar · pantalla ESP32");
  pinMode(board::kBootButton, INPUT_PULLUP);
  light::begin();
  ui::begin();
  touch::begin();

  checkFactoryReset();

#ifdef HAVE_SIM_CONFIG
  cfg.server = settings::normalizeServer(SIM_SERVER);
  cfg.token = SIM_TOKEN;
#endif

  if (kUseMock) {
    Serial.println("Modo datos de ejemplo (MOCK_DATA)");
  } else if (connectWifi()) {
    Serial.printf("WiFi OK, IP %s, servidor %s\n", WiFi.localIP().toString().c_str(), cfg.server.c_str());
  } else if (!portal::active()) {
    ui::drawMessage("Sin WiFi", "No se pudo conectar.\nReinicia la placa para reintentar.", ui::color::kDanger);
  }
  lastTouchMs = millis();
}

void loop() {
  light::update();
  checkBootButton();

  if (portal::active()) {
    if (portal::process(cfg)) {
      Serial.println("Portal cerrado: configuración lista");
      hasData = false;
      fetchNow = true;
      ui::drawMessage("Conectado", "Cargando tareas…", ui::color::kSuccess);
    }
    return;
  }

  const uint32_t now = millis();
  if (fetchNow || static_cast<int32_t>(now - nextFetchMs) >= 0) fetch();

  handleTouch();

  // Sin tocar nada durante un rato: volver a hoy y a la primera página
  if ((!viewingToday() || page != 0) && now - lastTouchMs > kIdleBackToTodayMs) {
    viewDate = "";
    page = 0;
    fetchNow = true;
    lastTouchMs = now;
  }

  // Actualizar el "hace N min" del pie cuando no hay conexión
  if (hasData && lastStatus != FetchStatus::Ok && now - lastFooterMs > kFooterTickMs) render();

  delay(10);
}
