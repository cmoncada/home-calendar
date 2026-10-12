// Entrada táctil (XPT2046). En el simulador Wokwi se sustituye por pulsadores.
#pragma once

#include <Arduino.h>

enum class Gesture { None, Tap, SwipeLeft, SwipeRight };

struct TouchEvent {
  Gesture gesture = Gesture::None;
  int16_t x = 0;  // coordenadas de pantalla (320x240) donde empezó el toque
  int16_t y = 0;
};

namespace touch {

void begin();
/** Llamar desde loop(). Devuelve un gesto cuando el dedo se levanta. */
TouchEvent poll();
/** true mientras hay un dedo en la pantalla (para la pulsación larga de reset). */
bool isPressed();

}  // namespace touch
