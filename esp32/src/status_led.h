// LED RGB de estado y retroiluminación automática con el sensor de luz (LDR).
#pragma once

#include <Arduino.h>

enum class LedState {
  Off,
  AllDone,   // verde: no queda nada pendiente
  Pending,   // ámbar: hay tareas pendientes
  Error,     // rojo fijo: token inválido / configuración
  Offline,   // rojo parpadeante: sin conexión con el servidor
  Portal,    // azul parpadeante: portal de configuración abierto
  Working,   // azul tenue: conectando / cargando
};

namespace light {

void begin();
void setLed(LedState state);
/** Llamar a menudo desde loop(): parpadeos del LED y brillo según la luz ambiente. */
void update();
/** Brillo fijo 0–255 (desactiva el automático hasta la próxima llamada a setAuto). */
void setBacklight(uint8_t level);
void setAuto(bool enabled);

}  // namespace light
