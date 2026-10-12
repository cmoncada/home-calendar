#include "touch.h"

#include "board.h"

#ifndef SIM_BUTTONS
#include <SPI.h>
#include <XPT2046_Touchscreen.h>
#endif

namespace touch {

namespace {
constexpr int kSwipeMinPx = 60;
constexpr uint32_t kDebounceMs = 40;
}  // namespace

#ifdef SIM_BUTTONS
// ---------- Simulador: tres pulsadores que imitan toques en la pantalla ----------
namespace {
struct Button {
  int pin;
  int16_t x, y;  // dónde "toca" en la pantalla
  bool last;
  uint32_t changedMs;
};
Button buttons[] = {
    {board::kSimPrevButton, 10, 15, true, 0},   // ‹ día anterior
    {board::kSimNextButton, 310, 15, true, 0},  // › día siguiente
    {board::kSimPageButton, 160, 130, true, 0}, // siguiente página
};
}  // namespace

void begin() {
  for (auto& b : buttons) pinMode(b.pin, INPUT_PULLUP);
}

TouchEvent poll() {
  TouchEvent ev;
  const uint32_t now = millis();
  for (auto& b : buttons) {
    const bool level = digitalRead(b.pin);
    if (level != b.last && now - b.changedMs > kDebounceMs) {
      b.changedMs = now;
      b.last = level;
      if (level == HIGH) {  // al soltar
        ev.gesture = Gesture::Tap;
        ev.x = b.x;
        ev.y = b.y;
      }
    }
  }
  return ev;
}

bool isPressed() {
  for (auto& b : buttons) {
    if (digitalRead(b.pin) == LOW) return true;
  }
  return false;
}

#else
// ---------- Placa real: XPT2046 en el bus VSPI ----------
namespace {
SPIClass touchSpi(VSPI);
XPT2046_Touchscreen ts(board::kTouchCs, board::kTouchIrq);

bool down = false;
int16_t startX = 0, startY = 0, lastX = 0, lastY = 0;
uint32_t lastSeenMs = 0;

bool readPoint(int16_t& x, int16_t& y) {
  if (!(ts.tirqTouched() && ts.touched())) return false;
  const TS_Point p = ts.getPoint();
  if (p.z < 200) return false;  // presión demasiado débil: ruido
  x = constrain(map(p.x, board::kTouchRawXMin, board::kTouchRawXMax, 0, board::kScreenW - 1), 0, board::kScreenW - 1);
  y = constrain(map(p.y, board::kTouchRawYMin, board::kTouchRawYMax, 0, board::kScreenH - 1), 0, board::kScreenH - 1);
#ifdef TOUCH_DEBUG
  Serial.printf("touch raw=(%d,%d,%d) -> (%d,%d)\n", p.x, p.y, p.z, x, y);
#endif
  return true;
}
}  // namespace

void begin() {
  touchSpi.begin(board::kTouchClk, board::kTouchMiso, board::kTouchMosi, board::kTouchCs);
  ts.begin(touchSpi);
  ts.setRotation(1);  // misma orientación que la pantalla
}

TouchEvent poll() {
  TouchEvent ev;
  int16_t x, y;
  const uint32_t now = millis();
  if (readPoint(x, y)) {
    if (!down) {
      down = true;
      startX = x;
      startY = y;
    }
    lastX = x;
    lastY = y;
    lastSeenMs = now;
    return ev;
  }
  // El XPT2046 pierde lecturas sueltas: se considera "soltado" tras 60 ms sin contacto
  if (down && now - lastSeenMs > 60) {
    down = false;
    const int dx = lastX - startX;
    const int dy = lastY - startY;
    if (abs(dx) >= kSwipeMinPx && abs(dx) > abs(dy)) {
      ev.gesture = dx < 0 ? Gesture::SwipeLeft : Gesture::SwipeRight;
    } else {
      ev.gesture = Gesture::Tap;
    }
    ev.x = startX;
    ev.y = startY;
  }
  return ev;
}

bool isPressed() {
  int16_t x, y;
  return readPoint(x, y);
}
#endif

}  // namespace touch
