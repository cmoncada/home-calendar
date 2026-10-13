#include "portal.h"

#include <WiFi.h>
#include <WiFiManager.h>

#include "status_led.h"
#include "ui.h"

namespace portal {

namespace {

WiFiManager wm;
WiFiManagerParameter paramHelp(
    "<p style='margin:8px 0'>Datos de tu servidor Home Calendar. El token se genera en "
    "<b>Administrar &gt; Pantalla ESP32</b>.</p>");
WiFiManagerParameter paramServer("server", "URL del servidor (ej. http://homecalendar.local o http://192.168.1.14)", "", 120);
WiFiManagerParameter paramToken("token", "Token del ESP32 (hc_...)", "", 80);

bool configured = false;  // se configuró WiFiManager (callbacks, parámetros)
bool saved = false;       // el usuario pulsó "Guardar" en el portal
bool savedSinceOpen = false;
// Si el portal se abrió a mano o faltaban datos, solo se cierra cuando el usuario guarda.
// Si se abrió porque la WiFi no conectaba (router apagado…), se cierra solo al volver la conexión.
bool requireSave = false;

void onSave() {
  saved = true;
}

void onPortalStarted(WiFiManager*) {
  light::setLed(LedState::Portal);
  ui::drawPortal(kApName, kApPassword, WiFi.softAPIP().toString());
}

void setup(const Settings& settings) {
  paramServer.setValue(settings.server.c_str(), 120);
  paramToken.setValue(settings.token.c_str(), 80);
  if (configured) return;
  configured = true;
  wm.setTitle("Home Calendar");
  wm.setHostname("home-calendar");
  wm.setConnectTimeout(20);
  wm.setConfigPortalBlocking(false);
  wm.setBreakAfterConfig(true);  // guarda URL y token aunque la WiFi falle
  wm.setAPCallback(onPortalStarted);
  wm.setSaveConfigCallback(onSave);
  wm.setSaveParamsCallback(onSave);
  wm.addParameter(&paramHelp);
  wm.addParameter(&paramServer);
  wm.addParameter(&paramToken);
  std::vector<const char*> menu = {"wifi", "restart"};
  wm.setMenu(menu);
  wm.setClass("invert");  // tema oscuro
}

void storeParams(Settings& settings) {
  settings.server = settings::normalizeServer(paramServer.getValue());
  settings.token = String(paramToken.getValue());
  settings.token.trim();
  settings::save(settings);
  Serial.printf("Configuración guardada: %s (token %s)\n", settings.server.c_str(),
                settings.token.length() ? "sí" : "no");
}

}  // namespace

bool connect(Settings& settings, bool forcePortal) {
  WiFi.mode(WIFI_STA);
  setup(settings);
  saved = false;
  savedSinceOpen = false;
  requireSave = forcePortal || !settings.complete();
  if (requireSave) {
    wm.startConfigPortal(kApName, kApPassword);
    return false;
  }
  // Con el portal no bloqueante, autoConnect devuelve false y deja el portal abierto si no conecta
  return wm.autoConnect(kApName, kApPassword);
}

bool active() {
  return wm.getConfigPortalActive();
}

bool process(Settings& settings) {
  const bool connected = wm.process();
  if (saved) {
    saved = false;
    savedSinceOpen = true;
    storeParams(settings);
  }
  const bool online = connected || WiFi.status() == WL_CONNECTED;
  if (online && settings.complete() && (savedSinceOpen || !requireSave)) {
    wm.stopConfigPortal();
    return true;
  }
  return false;
}

void factoryReset() {
  Serial.println("Reset de fábrica: borrando WiFi, URL y token");
  settings::clear();
  wm.resetSettings();
  delay(300);
  ESP.restart();
  while (true) {
  }
}

}  // namespace portal
