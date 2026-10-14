#!/usr/bin/env python3
"""sculpt_next_relay.py: the room relay for Sculpt together (lib/sculpt_next_collab.js), Python standard library only:  python3 tools/sculpt_next_relay.py [port]   (default 8787)
Same protocol as tools/sculpt_next_relay.mjs: each headset gets an id, every message is NUMBERED and sent to everyone in the room (the sender too), a leaving headset is announced.
Headsets connect to ws://<this computer>:8787/?room=atelier."""
import asyncio, base64, hashlib, json, os, struct, sys
from urllib.parse import urlparse, parse_qs

MAX = 64 * 1024 * 1024
rooms = {}


def frame(text):
    body = text.encode('utf-8'); n = len(body)
    if n < 126: head = bytes([0x81, n])
    elif n < 65536: head = bytes([0x81, 126]) + struct.pack('>H', n)
    else: head = bytes([0x81, 127]) + struct.pack('>Q', n)
    return head + body


def log(*a):
    if not os.environ.get('QUIET'): print(*a, flush=True)


async def handle(reader, writer):
    try:
        head = await reader.readuntil(b'\r\n\r\n')
    except Exception:
        writer.close(); return
    lines = head.decode('latin-1').split('\r\n'); path = lines[0].split(' ')[1] if len(lines[0].split(' ')) > 1 else '/'
    hdr = {l.split(':', 1)[0].strip().lower(): l.split(':', 1)[1].strip() for l in lines[1:] if ':' in l}
    key = hdr.get('sec-websocket-key')
    if not key or hdr.get('upgrade', '').lower() != 'websocket':
        txt = 'Sculpt together relay. Rooms: ' + (', '.join('%s (%d)' % (k, len(r['peers'])) for k, r in rooms.items()) or 'none') + '\n'
        writer.write(('HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: %d\r\n\r\n%s' % (len(txt), txt)).encode()); await writer.drain(); writer.close(); return
    accept = base64.b64encode(hashlib.sha1((key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').encode()).digest()).decode()
    writer.write(('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: %s\r\n\r\n' % accept).encode())
    name = (parse_qs(urlparse(path).query).get('room') or ['atelier'])[0][:64]
    room = rooms.setdefault(name, {'n': 0, 'id': 0, 'peers': {}})
    room['id'] += 1; pid = 'p%d' % room['id']; others = list(room['peers'].keys()); room['peers'][pid] = writer
    log('room', name, '+', pid, '(%d)' % len(room['peers']))

    def send(w, text):
        try: w.write(frame(text))
        except Exception: pass

    send(writer, json.dumps({'t': 'welcome', 'id': pid, 'peers': others, 'n': room['n']}))
    parts = []
    try:
        while True:
            b0, b1 = await reader.readexactly(2)
            fin, op, masked, n = b0 & 0x80, b0 & 0x0f, b1 & 0x80, b1 & 0x7f
            if n == 126: n = struct.unpack('>H', await reader.readexactly(2))[0]
            elif n == 127: n = struct.unpack('>Q', await reader.readexactly(8))[0]
            if n > MAX: break
            mask = await reader.readexactly(4) if masked else None
            data = await reader.readexactly(n)
            if mask and n:
                data = (int.from_bytes(data, 'big') ^ int.from_bytes((mask * (n // 4 + 1))[:n], 'big')).to_bytes(n, 'big')
            if op == 8:
                try: writer.write(bytes([0x88, 0]))
                except Exception: pass
                break
            if op == 9: writer.write(bytes([0x8A, len(data)]) + bytes(data)); continue
            if op == 10: continue
            parts.append(bytes(data))
            if not fin: continue
            text = b''.join(parts).decode('utf-8', 'replace'); parts = []
            try: m = json.loads(text)
            except Exception: continue
            if not isinstance(m, dict) or 't' not in m: continue
            room['n'] += 1; m['from'] = pid; m['n'] = room['n']; out = json.dumps(m, separators=(',', ':'))
            if m['t'] == 'snap' and m.get('for') and m.get('for') != '*':
                w = room['peers'].get(m['for'])
                if w: send(w, out)
            else:
                for w in list(room['peers'].values()): send(w, out)
            await writer.drain()
    except (asyncio.IncompleteReadError, ConnectionError):
        pass
    finally:
        room['peers'].pop(pid, None); room['n'] += 1; log('room', name, '-', pid, '(%d)' % len(room['peers']))
        out = json.dumps({'t': 'bye', 'from': pid, 'n': room['n']})
        for w in list(room['peers'].values()): send(w, out)
        if not room['peers']: rooms.pop(name, None)
        try: writer.close()
        except Exception: pass


async def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else int(os.environ.get('PORT', 8787))
    srv = await asyncio.start_server(handle, '0.0.0.0', port)
    log('Sculpt together relay on ws://0.0.0.0:%d/?room=atelier' % port)
    async with srv: await srv.serve_forever()

if __name__ == '__main__':
    asyncio.run(main())
