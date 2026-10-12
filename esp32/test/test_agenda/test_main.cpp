// Tests de lib/agenda en el Mac:  pio test -e native
#include <unity.h>

#include <cstring>
#include <string>

#include "agenda.h"
#include "mock_today.h"

using namespace agenda;

void setUp() {}
void tearDown() {}

// Ancho falso para fitText: 1 px por carácter (no por byte) — igual que una fuente monoespaciada.
static int charWidth(const std::string& s) {
  int n = 0;
  for (unsigned char c : s) n += (c & 0xC0) != 0x80;
  return n;
}

void test_parse_mock() {
  Day day;
  std::string error;
  TEST_ASSERT_TRUE(parseDay(kMockToday, std::strlen(kMockToday), day, &error));
  TEST_ASSERT_EQUAL_STRING("2026-10-12", day.date.c_str());
  TEST_ASSERT_EQUAL_STRING("Lunes", day.weekday.c_str());
  TEST_ASSERT_EQUAL(7, day.total);
  TEST_ASSERT_EQUAL(5, day.pending);
  TEST_ASSERT_EQUAL(7, (int)day.tasks.size());

  const Task& t = day.tasks[2];
  TEST_ASSERT_EQUAL(3, t.id);
  TEST_ASSERT_EQUAL_STRING("Mantenimiento", t.category.c_str());
  TEST_ASSERT_EQUAL_STRING("11:00", t.time.c_str());
  TEST_ASSERT_EQUAL_STRING("Luis, Ana", joinNames(t.who).c_str());
  TEST_ASSERT_FALSE(t.done);

  // Campos null → cadenas vacías
  const Task& allDay = day.tasks[5];
  TEST_ASSERT_TRUE(allDay.time.empty());
  TEST_ASSERT_TRUE(allDay.category.empty());
  TEST_ASSERT_EQUAL(3, (int)allDay.who.size());
}

void test_parse_readme_example() {
  // Ejemplo exacto del README del proyecto (contrato de la API)
  const char* json = R"({"date":"2026-09-30","weekday":"Miércoles","now":"18:31","total":2,"pending":1,
    "tasks":[{"id":1,"t":"Sacar la basura","cat":"Limpieza","time":"20:00","end":"21:00","dur":"1h","who":["Ana"],"done":false,"color":"#e50914"}]})";
  Day day;
  TEST_ASSERT_TRUE(parseDay(json, std::strlen(json), day));
  TEST_ASSERT_EQUAL_STRING("Miércoles", day.weekday.c_str());
  TEST_ASSERT_EQUAL(1, (int)day.tasks.size());
  TEST_ASSERT_EQUAL_HEX16(0xE042, day.tasks[0].color);  // #e50914
}

void test_parse_errors() {
  Day day;
  std::string error;
  TEST_ASSERT_FALSE(parseDay("{oops", 5, day, &error));
  TEST_ASSERT_FALSE(error.empty());
  const char* noTasks = R"({"error":"Token inválido"})";
  TEST_ASSERT_FALSE(parseDay(noTasks, std::strlen(noTasks), day, &error));
}

void test_parse_empty_day_and_missing_counts() {
  const char* json = R"({"date":"2026-10-13","tasks":[{"t":"A","done":true},{"t":"B"}]})";
  Day day;
  TEST_ASSERT_TRUE(parseDay(json, std::strlen(json), day));
  TEST_ASSERT_EQUAL(2, day.total);
  TEST_ASSERT_EQUAL(1, day.pending);
  TEST_ASSERT_EQUAL_STRING("Martes", day.weekday.c_str());  // calculado si falta
}

void test_colors() {
  TEST_ASSERT_EQUAL_HEX16(0xFFFF, hexToRgb565("#ffffff", 0));
  TEST_ASSERT_EQUAL_HEX16(0x0000, hexToRgb565("#000000", 1));
  TEST_ASSERT_EQUAL_HEX16(0xF800, hexToRgb565("#FF0000", 0));
  TEST_ASSERT_EQUAL_HEX16(0x07E0, hexToRgb565("#00ff00", 0));
  TEST_ASSERT_EQUAL_HEX16(0x1234, hexToRgb565("rojo", 0x1234));
  TEST_ASSERT_EQUAL_HEX16(0x1234, hexToRgb565("#12345", 0x1234));
  TEST_ASSERT_EQUAL_HEX16(0x1234, hexToRgb565("#12345g", 0x1234));
}

void test_pagination() {
  TEST_ASSERT_EQUAL(1, pageCount(0, 4));
  TEST_ASSERT_EQUAL(1, pageCount(4, 4));
  TEST_ASSERT_EQUAL(2, pageCount(5, 4));
  int first, last;
  pageRange(7, 4, 0, first, last);
  TEST_ASSERT_EQUAL(0, first);
  TEST_ASSERT_EQUAL(4, last);
  pageRange(7, 4, 1, first, last);
  TEST_ASSERT_EQUAL(4, first);
  TEST_ASSERT_EQUAL(7, last);
  pageRange(7, 4, 9, first, last);  // fuera de rango → última página
  TEST_ASSERT_EQUAL(4, first);
  pageRange(0, 4, 0, first, last);
  TEST_ASSERT_EQUAL(0, first);
  TEST_ASSERT_EQUAL(0, last);
}

void test_dates() {
  TEST_ASSERT_EQUAL_STRING("2026-11-01", addDays("2026-10-31", 1).c_str());
  TEST_ASSERT_EQUAL_STRING("2026-12-31", addDays("2027-01-01", -1).c_str());
  TEST_ASSERT_EQUAL_STRING("2028-02-29", addDays("2028-02-28", 1).c_str());  // bisiesto
  TEST_ASSERT_EQUAL_STRING("2026-03-01", addDays("2026-02-28", 1).c_str());
  TEST_ASSERT_TRUE(isDate("2028-02-29"));
  TEST_ASSERT_FALSE(isDate("2026-02-29"));
  TEST_ASSERT_FALSE(isDate("2026-13-01"));
  TEST_ASSERT_FALSE(isDate("12-10-2026"));
  TEST_ASSERT_EQUAL_STRING("Lunes", weekdayName("2026-10-12"));
  TEST_ASSERT_EQUAL_STRING("Jueves", weekdayName("1970-01-01"));
  TEST_ASSERT_EQUAL_STRING("Miércoles", weekdayName("1969-12-31"));
  TEST_ASSERT_EQUAL_STRING("12 oct", shortDate("2026-10-12").c_str());
  TEST_ASSERT_EQUAL_STRING("1 ene", shortDate("2027-01-01").c_str());
}

void test_fit_text_utf8() {
  TEST_ASSERT_EQUAL_STRING("Corto", fitText("Corto", 10, charWidth).c_str());
  TEST_ASSERT_EQUAL_STRING("Revisar...", fitText("Revisar la caldera", 10, charWidth).c_str());
  // No parte la "ñ" ni la "ó" (2 bytes en UTF-8)
  std::string out = fitText("Añadir canción nueva", 9, charWidth);
  TEST_ASSERT_EQUAL_STRING("Añadir...", out.c_str());
  out = fitText("Canción larguísima", 8, charWidth);
  TEST_ASSERT_EQUAL_STRING("Canci...", out.c_str());
  TEST_ASSERT_EQUAL_STRING("...", fitText("Larguísimo", 3, charWidth).c_str());
  TEST_ASSERT_EQUAL_STRING("", fitText("Larguísimo", 2, charWidth).c_str());
}

void test_hash_changes() {
  const char* a = "hola";
  const char* b = "holb";
  TEST_ASSERT_NOT_EQUAL(hash(a, 4), hash(b, 4));
  TEST_ASSERT_EQUAL(hash(a, 4), hash(a, 4));
}

int main() {
  UNITY_BEGIN();
  RUN_TEST(test_parse_mock);
  RUN_TEST(test_parse_readme_example);
  RUN_TEST(test_parse_errors);
  RUN_TEST(test_parse_empty_day_and_missing_counts);
  RUN_TEST(test_colors);
  RUN_TEST(test_pagination);
  RUN_TEST(test_dates);
  RUN_TEST(test_fit_text_utf8);
  RUN_TEST(test_hash_changes);
  return UNITY_END();
}
