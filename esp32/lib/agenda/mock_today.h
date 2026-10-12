// Respuesta de ejemplo de /api/display/today para el modo sin red (-DMOCK_DATA)
// y para los tests. Misma forma que backend/src/routes/display.js.
#pragma once

namespace agenda {

static const char kMockToday[] = R"json({
  "date": "2026-10-12",
  "weekday": "Lunes",
  "now": "08:15",
  "total": 7,
  "pending": 5,
  "tasks": [
    { "id": 1, "t": "Sacar la basura", "cat": "Limpieza", "time": "07:30", "end": "08:00", "dur": "1h", "who": ["Ana"], "done": true, "color": "#00b8a9" },
    { "id": 2, "t": "Pagar la factura de la luz", "cat": "Pagos", "time": "09:00", "end": "10:00", "dur": "1h", "who": ["Luis"], "done": false, "color": "#2ecc71" },
    { "id": 3, "t": "Revisar la caldera y purgar los radiadores del salón", "cat": "Mantenimiento", "time": "11:00", "end": "13:00", "dur": "2h", "who": ["Luis", "Ana"], "done": false, "color": "#ff7a00" },
    { "id": 4, "t": "Llamar al médico", "cat": "Recordatorios", "time": "12:30", "end": "13:30", "dur": "1h", "who": ["Ana"], "done": true, "color": "#f5c518" },
    { "id": 5, "t": "Aspirar habitaciones", "cat": "Limpieza", "time": "17:00", "end": "18:00", "dur": "1h", "who": [], "done": false, "color": "#00b8a9" },
    { "id": 6, "t": "Regar plantas del balcón", "cat": null, "time": null, "end": null, "dur": "1d", "who": ["Ana", "Luis", "Martín"], "done": false, "color": "#9b59b6" },
    { "id": 7, "t": "Preparar mochilas", "cat": "Recordatorios", "time": "21:00", "end": "21:30", "dur": "1h", "who": ["Martín"], "done": false, "color": "#ff4f9a" }
  ]
})json";

}  // namespace agenda
