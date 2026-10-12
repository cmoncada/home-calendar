#include "settings.h"

#include <Preferences.h>

namespace {
constexpr const char* kNamespace = "hcal";
}

String Settings::endpoint(const String& date) const {
  String url = server + "/api/display/today";
  if (date.length()) url += "?date=" + date;
  return url;
}

namespace settings {

Settings load() {
  Preferences prefs;
  Settings s;
  if (prefs.begin(kNamespace, true)) {
    s.server = prefs.getString("server", "");
    s.token = prefs.getString("token", "");
    prefs.end();
  }
  return s;
}

void save(const Settings& s) {
  Preferences prefs;
  prefs.begin(kNamespace, false);
  prefs.putString("server", s.server);
  prefs.putString("token", s.token);
  prefs.end();
}

void clear() {
  Preferences prefs;
  prefs.begin(kNamespace, false);
  prefs.clear();
  prefs.end();
}

String normalizeServer(String url) {
  url.trim();
  if (!url.length()) return url;
  if (!url.startsWith("http://") && !url.startsWith("https://")) url = "http://" + url;
  const int api = url.indexOf("/api/");
  if (api > 0) url = url.substring(0, api);
  while (url.endsWith("/")) url.remove(url.length() - 1);
  return url;
}

}  // namespace settings
