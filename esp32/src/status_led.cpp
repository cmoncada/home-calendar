#include "status_led.h"

#include "board.h"

namespace light {

namespace {

// Canales LEDC (Arduino core 2.x)
constexpr int kChBacklight = 0;
constexpr int kChRed = 1;
constexpr int kChGreen = 2;
constexpr int kChBlue = 3;
constexpr int kPwmBits = 8;

constexpr uint8_t kMinBacklight = 38;   // ~15 %: legible a oscuras sin deslumbrar
constexpr uint8_t kMaxBacklight = 255;
constexpr uint8_t kLedLevel = 40;       // el LED de la placa es muy brillante

LedState ledState = LedState::Off;
bool autoBrightness = true;
float smoothed = kMaxBacklight;
uint32_t lastLdrMs = 0;

void attach(int pin, int channel, uint32_t freq) {
  ledcSetup(channel, freq, kPwmBits);
  ledcAttachPin(pin, channel);
}

// El LED es activo a nivel bajo: 255 = apagado
void writeRgb(uint8_t r, uint8_t g, uint8_t b) {
  ledcWrite(kChRed, 255 - r);
  ledcWrite(kChGreen, 255 - g);
  ledcWrite(kChBlue, 255 - b);
}

void renderLed() {
  const bool blinkOn = (millis() / 500) % 2 == 0;
  switch (ledState) {
    case LedState::AllDone: writeRgb(0, kLedLevel, 0); break;
    case LedState::Pending: writeRgb(kLedLevel, kLedLevel / 3, 0); break;
    case LedState::Error: writeRgb(kLedLevel, 0, 0); break;
    case LedState::Offline: blinkOn ? writeRgb(kLedLevel, 0, 0) : writeRgb(0, 0, 0); break;
    case LedState::Portal: blinkOn ? writeRgb(0, 0, kLedLevel) : writeRgb(0, 0, 0); break;
    case LedState::Working: writeRgb(0, 0, kLedLevel / 3); break;
    case LedState::Off: writeRgb(0, 0, 0); break;
  }
}

uint8_t brightnessFromLdr(int raw) {
  // Más luz → lectura menor → más brillo
  const int clamped = constrain(raw, board::kLdrBright, board::kLdrDark);
  return map(clamped, board::kLdrBright, board::kLdrDark, kMaxBacklight, kMinBacklight);
}

}  // namespace

void begin() {
  attach(board::kBacklightPin, kChBacklight, 5000);
  attach(board::kLedRed, kChRed, 5000);
  attach(board::kLedGreen, kChGreen, 5000);
  attach(board::kLedBlue, kChBlue, 5000);
  ledcWrite(kChBacklight, kMaxBacklight);
  writeRgb(0, 0, 0);
  pinMode(board::kLdrPin, INPUT);
  // Atenuación mínima: el divisor del LDR da tensiones muy bajas
  analogSetPinAttenuation(board::kLdrPin, ADC_0db);
}

void setLed(LedState state) {
  ledState = state;
  renderLed();
}

void setBacklight(uint8_t level) {
  autoBrightness = false;
  ledcWrite(kChBacklight, level);
}

void setAuto(bool enabled) {
  autoBrightness = enabled;
}

void update() {
  renderLed();
  const uint32_t now = millis();
  if (!autoBrightness || now - lastLdrMs < 1000) return;
  lastLdrMs = now;
  const int raw = analogRead(board::kLdrPin);
  // Suavizado exponencial: cambios graduales, sin parpadeos al pasar una sombra
  smoothed = smoothed * 0.8f + brightnessFromLdr(raw) * 0.2f;
  ledcWrite(kChBacklight, static_cast<uint8_t>(smoothed));
#ifdef LDR_DEBUG
  Serial.printf("LDR=%d brillo=%d\n", raw, static_cast<int>(smoothed));
#endif
}

}  // namespace light
