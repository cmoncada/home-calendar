// Pines y constantes de la Cheap Yellow Display (ESP32-2432S028R, 1 USB).
// Los pines de la pantalla (TFT_*) están en platformio.ini porque los necesita TFT_eSPI.
#pragma once

#include <stdint.h>

namespace board {

// Retroiluminación (PWM)
constexpr int kBacklightPin = 21;

// Táctil XPT2046 en su propio bus SPI (VSPI)
constexpr int kTouchClk = 25;
constexpr int kTouchMiso = 39;
constexpr int kTouchMosi = 32;
constexpr int kTouchCs = 33;
constexpr int kTouchIrq = 36;

// Calibración del táctil: valores crudos en los bordes de la pantalla (rotación 1, horizontal).
// Si al tocar los bordes el punto no coincide, ajústalos con los valores que imprime el monitor serie.
constexpr int kTouchRawXMin = 240;
constexpr int kTouchRawXMax = 3800;
constexpr int kTouchRawYMin = 220;
constexpr int kTouchRawYMax = 3820;

// LED RGB (activo a nivel bajo: LOW = encendido)
constexpr int kLedRed = 4;
constexpr int kLedGreen = 16;
constexpr int kLedBlue = 17;

// Sensor de luz (LDR). En la CYD la lectura BAJA cuando hay más luz.
constexpr int kLdrPin = 34;
constexpr int kLdrBright = 0;    // lectura con la habitación muy iluminada
constexpr int kLdrDark = 400;    // lectura a oscuras (ajusta con el monitor serie)

// Botón BOOT
constexpr int kBootButton = 0;

#ifdef SIM_BUTTONS
// Solo en el simulador Wokwi (no hay táctil): pulsadores a GND
constexpr int kSimPrevButton = 22;
constexpr int kSimNextButton = 27;
constexpr int kSimPageButton = 26;
#endif

// Pantalla en horizontal
constexpr int kScreenW = 320;
constexpr int kScreenH = 240;

}  // namespace board
