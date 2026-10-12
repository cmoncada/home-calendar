#!/usr/bin/env python3
"""Envía un JSON (o un comando) por USB a la pantalla para revisar la interfaz sin servidor.

La placa lo dibuja como si viniera de /api/display/today ("Vista previa (USB)" en el pie)
y deja de pedir datos al servidor durante 10 minutos o hasta que se envía `:live`.

Uso (con el Python de PlatformIO, que ya trae pyserial):
  ~/.platformio/penv/bin/python tools/send_json.py samples/02-muchas-tareas.json
  ~/.platformio/penv/bin/python tools/send_json.py samples/*.json --pause 5     # pase de diapositivas
  ~/.platformio/penv/bin/python tools/send_json.py :portal     # pantalla del portal WiFi
  ~/.platformio/penv/bin/python tools/send_json.py :token      # pantalla de token no válido
  ~/.platformio/penv/bin/python tools/send_json.py :offline    # último JSON con aviso "Sin conexión"
  ~/.platformio/penv/bin/python tools/send_json.py :live       # volver a los datos reales
  cat mi.json | ~/.platformio/penv/bin/python tools/send_json.py -

Cierra antes el monitor serie de PlatformIO: el puerto solo lo puede usar un programa a la vez.
"""
import argparse
import json
import sys
import time

try:
    import serial
    from serial.tools import list_ports
except ImportError:
    sys.exit("Falta pyserial. Usa el Python de PlatformIO: ~/.platformio/penv/bin/python tools/send_json.py …")

# Chips USB-serie habituales en la CYD: CH340 (1A86) y CP210x (10C4)
USB_VIDS = {0x1A86, 0x10C4}
COMMANDS = {":portal", ":token", ":offline", ":live"}


def find_port():
    ports = [p for p in list_ports.comports() if p.vid in USB_VIDS]
    if not ports:
        sys.exit("No encuentro la placa por USB. Conéctala o indica el puerto con --port /dev/cu.usbserial-XXX")
    return ports[0].device


def open_port(device):
    # DTR/RTS a False antes de abrir: así no se reinicia el ESP32 al conectar
    s = serial.Serial()
    s.port = device
    s.baudrate = 115200
    s.timeout = 0.1
    s.dtr = False
    s.rts = False
    s.open()
    # Si aun así se reinició, esperar a que arranque
    time.sleep(0.4)
    boot = s.read(4096).decode("utf-8", "replace")
    if "rst:" in boot or "ets " in boot:
        print("La placa se ha reiniciado al abrir el puerto; esperando a que arranque…")
        time.sleep(4)
        s.reset_input_buffer()
    return s


def load_payload(arg):
    if arg in COMMANDS:
        return arg, arg
    raw = sys.stdin.read() if arg == "-" else open(arg, encoding="utf-8").read()
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        sys.exit(f"{arg}: JSON no válido ({e})")
    if not isinstance(data, dict) or "date" not in data or not isinstance(data.get("tasks"), list):
        sys.exit(f"{arg}: debe tener al menos 'date' y una lista 'tasks' (formato de /api/display/today)")
    # Una sola línea: la placa lee hasta el salto de línea
    line = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    label = f"{arg} ({len(data['tasks'])} tareas, {len(line.encode())} bytes)"
    return line, label


def send(s, line, timeout=6.0):
    payload = (line + "\n").encode("utf-8")
    # Trozos pequeños para no desbordar el buffer de recepción mientras la placa dibuja
    for i in range(0, len(payload), 256):
        s.write(payload[i:i + 256])
        s.flush()
        time.sleep(0.01)
    deadline = time.time() + timeout
    buf = ""
    while time.time() < deadline:
        buf += s.read(512).decode("utf-8", "replace")
        for out in buf.splitlines():
            if out.startswith("PREVIEW"):
                return out
    return "Sin respuesta de la placa (¿firmware antiguo? súbelo con: pio run -e cyd -t upload)"


def main():
    parser = argparse.ArgumentParser(description="Vista previa de la interfaz por USB")
    parser.add_argument("items", nargs="+", help="archivos .json, '-' (stdin) o :portal / :token / :offline / :live")
    parser.add_argument("--port", help="puerto serie (por defecto, se detecta)")
    parser.add_argument("--pause", type=float, default=4.0, help="segundos entre envíos si hay varios (por defecto 4)")
    args = parser.parse_args()

    payloads = [load_payload(item) for item in args.items]
    device = args.port or find_port()
    s = open_port(device)
    try:
        for n, (line, label) in enumerate(payloads):
            if n:
                time.sleep(args.pause)
            print(f"→ {label}")
            print(f"  {send(s, line)}")
    finally:
        s.close()


if __name__ == "__main__":
    main()
