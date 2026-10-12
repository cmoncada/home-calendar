#include "ui.h"

#include <TFT_eSPI.h>
#include <U8g2_for_TFT_eSPI.h>

#include "board.h"

namespace ui {

namespace {

using namespace color;

// Distribución vertical
constexpr int kHeaderH = 46;
constexpr int kRowH = 44;
constexpr int kListY = kHeaderH + 2;
constexpr int kFooterY = kListY + kRowH * kRowsPerPage;  // 224
constexpr int kFooterH = board::kScreenH - kFooterY;     // 16
constexpr int kArrowZoneW = 60;

// Columnas de cada fila
constexpr int kStripeW = 4;
constexpr int kCheckX = 20;
constexpr int kTimeX = 36;
constexpr int kTitleX = 86;
constexpr int kRightPad = 8;

TFT_eSPI tft;
TFT_eSprite canvas(&tft);
U8g2_for_TFT_eSPI u8f;

// Fuentes U8g2 "_tf": incluyen Latin-1 (á, é, ñ, ü…)
const uint8_t* const kFontTitle = u8g2_font_helvB14_tf;
const uint8_t* const kFontRowTitle = u8g2_font_helvB12_tf;
const uint8_t* const kFontRowTitleDone = u8g2_font_helvR12_tf;
const uint8_t* const kFontTime = u8g2_font_helvB10_tf;
const uint8_t* const kFontSmall = u8g2_font_helvR08_tf;
const uint8_t* const kFontMessage = u8g2_font_helvB18_tf;
const uint8_t* const kFontBody = u8g2_font_helvR10_tf;

/**
 * Dibuja una franja horizontal en un sprite y la vuelca de una vez (sin parpadeo).
 * Si no hay memoria para el sprite, dibuja directamente en la pantalla.
 * `fn(g, oy)`: g = destino, oy = desplazamiento vertical a sumar a las coordenadas.
 */
template <typename Fn>
void region(int y, int h, Fn fn) {
  if (canvas.createSprite(board::kScreenW, h)) {
    u8f.begin(canvas);
    fn(static_cast<TFT_eSPI&>(canvas), 0);
    canvas.pushSprite(0, y);
    canvas.deleteSprite();
  } else {
    u8f.begin(tft);
    fn(tft, y);
  }
}

void text(int x, int y, const std::string& s, const uint8_t* font, uint16_t fg) {
  u8f.setFont(font);
  u8f.setFontMode(1);  // transparente
  u8f.setForegroundColor(fg);
  u8f.drawUTF8(x, y, s.c_str());
}

int width(const std::string& s, const uint8_t* font) {
  u8f.setFont(font);
  return u8f.getUTF8Width(s.c_str());
}

std::string fit(const std::string& s, const uint8_t* font, int maxWidth) {
  u8f.setFont(font);
  return agenda::fitText(s, maxWidth, [](const std::string& t) { return u8f.getUTF8Width(t.c_str()); });
}

void centered(int y, const std::string& s, const uint8_t* font, uint16_t fg) {
  const std::string shown = fit(s, font, board::kScreenW - 16);
  text((board::kScreenW - width(shown, font)) / 2, y, shown, font, fg);
}

void drawCheck(TFT_eSPI& g, int cx, int cy, bool done) {
  if (done) {
    g.fillCircle(cx, cy, 8, kSuccess);
    g.drawLine(cx - 4, cy, cx - 1, cy + 3, kBg);
    g.drawLine(cx - 1, cy + 3, cx + 4, cy - 3, kBg);
    g.drawLine(cx - 4, cy + 1, cx - 1, cy + 4, kBg);
    g.drawLine(cx - 1, cy + 4, cx + 4, cy - 2, kBg);
  } else {
    g.drawCircle(cx, cy, 8, kMuted);
    g.drawCircle(cx, cy, 7, kMuted);
  }
}

void drawHeader(TFT_eSPI& g, int oy, const agenda::Day& day, const ViewState& view) {
  g.fillRect(0, oy, board::kScreenW, kHeaderH, kSurface);
  // Flechas ‹ › (triángulos: la fuente no tiene esos caracteres)
  const int cy = oy + kHeaderH / 2;
  g.fillTriangle(22, cy, 32, cy - 9, 32, cy + 9, kText);
  g.fillTriangle(board::kScreenW - 22, cy, board::kScreenW - 32, cy - 9, board::kScreenW - 32, cy + 9, kText);

  const std::string title = day.weekday + " " + agenda::shortDate(day.date);
  centered(oy + 22, title, kFontTitle, kText);

  std::string sub;
  if (day.total == 0) {
    sub = "Sin tareas";
  } else if (day.pending == 0) {
    sub = "Todo hecho (" + std::to_string(day.total) + ")";
  } else {
    sub = std::to_string(day.pending) + (day.pending == 1 ? " pendiente de " : " pendientes de ") +
          std::to_string(day.total);
  }
  if (view.isToday) sub = "Hoy · " + sub;
  centered(oy + 39, sub, kFontSmall, view.isToday ? kWarning : kMuted);
}

void drawRow(TFT_eSPI& g, int oy, const agenda::Task& t) {
  g.fillRect(0, oy, board::kScreenW, kRowH, kBg);
  g.fillRect(0, oy + 3, kStripeW, kRowH - 6, t.color);
  drawCheck(g, kCheckX, oy + 17, t.done);

  // Hora de inicio y de fin (o "Todo el día" partido en dos líneas)
  const uint16_t timeColor = t.done ? kFaint : kText;
  if (t.time.empty()) {
    text(kTimeX, oy + 18, "Todo", kFontTime, timeColor);
    text(kTimeX, oy + 34, "el día", kFontSmall, kFaint);
  } else {
    text(kTimeX, oy + 18, t.time, kFontTime, timeColor);
    if (!t.end.empty()) text(kTimeX, oy + 34, t.end, kFontSmall, kFaint);
  }

  const int maxW = board::kScreenW - kTitleX - kRightPad;
  const uint8_t* titleFont = t.done ? kFontRowTitleDone : kFontRowTitle;
  const std::string title = fit(t.title, titleFont, maxW);
  text(kTitleX, oy + 18, title, titleFont, t.done ? kFaint : kText);
  if (t.done) {
    const int w = width(title, titleFont);
    g.drawFastHLine(kTitleX, oy + 13, w, kFaint);  // tachado
  }

  std::string meta = t.category;
  const std::string who = agenda::joinNames(t.who);
  if (!who.empty()) meta += (meta.empty() ? "" : " · ") + who;
  if (!t.duration.empty()) meta += (meta.empty() ? "" : " · ") + t.duration;
  if (!meta.empty()) text(kTitleX, oy + 34, fit(meta, kFontSmall, maxW), kFontSmall, kMuted);

  g.drawFastHLine(kTitleX, oy + kRowH - 1, board::kScreenW - kTitleX, kDivider);
}

void drawEmpty(TFT_eSPI& g, int oy, int h, bool isToday) {
  g.fillRect(0, oy, board::kScreenW, h, kBg);
  const int cx = board::kScreenW / 2, cy = oy + h / 2 - 14;
  g.fillCircle(cx, cy, 22, kSuccess);
  g.drawWideLine(cx - 10, cy + 1, cx - 3, cy + 8, 4, kBg, kSuccess);
  g.drawWideLine(cx - 3, cy + 8, cx + 11, cy - 7, 4, kBg, kSuccess);
  centered(oy + h / 2 + 30, isToday ? "Sin tareas para hoy" : "Sin tareas este día", kFontBody, kMuted);
}

void drawFooter(TFT_eSPI& g, int oy, const ViewState& view) {
  g.fillRect(0, oy, board::kScreenW, kFooterH, kSurface);
  text(8, oy + 12, std::string(view.footer.c_str()), kFontSmall, view.footerAlert ? kDanger : kFaint);
  if (view.pages > 1) {
    // Puntos de paginación a la derecha
    const int spacing = 10;
    int x = board::kScreenW - 10 - (view.pages - 1) * spacing;
    for (int i = 0; i < view.pages; i++, x += spacing) {
      if (i == view.page) g.fillCircle(x, oy + kFooterH / 2, 3, kText);
      else g.drawCircle(x, oy + kFooterH / 2, 3, kFaint);
    }
  }
}

}  // namespace

void begin() {
  tft.init();
  tft.setRotation(1);
  tft.fillScreen(kBg);
  canvas.setColorDepth(16);
  u8f.begin(tft);
}

void drawDay(const agenda::Day& day, const ViewState& view) {
  region(0, kHeaderH, [&](TFT_eSPI& g, int oy) { drawHeader(g, oy, day, view); });
  tft.fillRect(0, kHeaderH, board::kScreenW, kListY - kHeaderH, kBg);

  const int count = static_cast<int>(day.tasks.size());
  if (count == 0) {
    region(kListY, kFooterY - kListY, [&](TFT_eSPI& g, int oy) { drawEmpty(g, oy, kFooterY - kListY, view.isToday); });
  } else {
    int first, last;
    agenda::pageRange(count, kRowsPerPage, view.page, first, last);
    for (int slot = 0; slot < kRowsPerPage; slot++) {
      const int i = first + slot;
      region(kListY + slot * kRowH, kRowH, [&](TFT_eSPI& g, int oy) {
        if (i < last) drawRow(g, oy, day.tasks[i]);
        else g.fillRect(0, oy, board::kScreenW, kRowH, kBg);
      });
    }
  }
  region(kFooterY, kFooterH, [&](TFT_eSPI& g, int oy) { drawFooter(g, oy, view); });
}

void drawMessage(const char* title, const String& body, uint16_t accent) {
  u8f.begin(tft);
  tft.fillScreen(kBg);
  tft.fillRect(0, 0, board::kScreenW, 6, accent);
  centered(70, title, kFontMessage, kText);
  // Cuerpo línea a línea
  int y = 108;
  int start = 0;
  while (start <= static_cast<int>(body.length())) {
    int end = body.indexOf('\n', start);
    if (end < 0) end = body.length();
    centered(y, body.substring(start, end).c_str(), kFontBody, kMuted);
    y += 20;
    start = end + 1;
  }
}

void drawPortal(const char* apName, const char* apPassword, const String& ip) {
  u8f.begin(tft);
  tft.fillScreen(kBg);
  tft.fillRect(0, 0, board::kScreenW, 6, kInfo);
  centered(34, "Configurar pantalla", kFontMessage, kText);
  // Cada paso: explicación en una línea y, debajo, el dato a escribir en negrita.
  // Así un nombre de red o una IP largos nunca se salen de la pantalla.
  const int x = 14;
  const int textX = x + 26;
  const int maxW = board::kScreenW - textX - 8;
  int y = 62;
  const auto step = [&](const char* n, const std::string& line, const std::string& strong) {
    tft.fillCircle(x + 8, y - 5, 9, kInfo);
    text(x + 5, y - 1, n, kFontSmall, kText);
    text(textX, y, fit(line, kFontBody, maxW), kFontBody, kMuted);
    if (!strong.empty()) {
      text(textX, y + 17, fit(strong, kFontRowTitle, maxW), kFontRowTitle, kText);
      y += 40;
    } else {
      y += 24;
    }
  };
  step("1", "Conéctate a la WiFi:", apName);
  step("2", "Contraseña:", apPassword);
  step("3", "Si no se abre sola la página, entra en:", ("http://" + ip).c_str());
  step("4", "Elige tu WiFi y pon la URL y el token", "");
  centered(230, "El token se genera en Administrar > Pantalla ESP32", kFontSmall, kFaint);
}

Zone hit(int x, int y) {
  if (y < kHeaderH + 10) {
    if (x < kArrowZoneW) return Zone::PrevDay;
    if (x > board::kScreenW - kArrowZoneW) return Zone::NextDay;
  }
  return Zone::List;
}

}  // namespace ui
