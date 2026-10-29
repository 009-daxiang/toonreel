#!/usr/bin/env python3
"""Generate ToonReel app icons (PNG) with zero dependencies.
Renders the brand mark (gradient rounded square + play triangle)
at 512/192/180 px. Run once:  python3 tools/gen_icons.py
"""

import os
import struct
import zlib

SIZE = 512
RADIUS = 112
C1 = (168, 85, 247)   # #a855f7
CM = (217, 70, 239)   # #d946ef
C2 = (34, 211, 238)   # #22d3ee
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'icons')


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def grad(t):
    return lerp(C1, CM, t * 2) if t < 0.5 else lerp(CM, C2, (t - 0.5) * 2)


def inside_rounded_rect(x, y, size, radius):
    r = radius * size / SIZE
    if x < r and y < r:
        return (x - r) ** 2 + (y - r) ** 2 <= r * r
    if x > size - r and y < r:
        return (x - (size - r)) ** 2 + (y - r) ** 2 <= r * r
    if x < r and y > size - r:
        return (x - r) ** 2 + (y - (size - r)) ** 2 <= r * r
    if x > size - r and y > size - r:
        return (x - (size - r)) ** 2 + (y - (size - r)) ** 2 <= r * r
    return True


def inside_triangle(x, y, size):
    """Centered play triangle, matching the logo mark proportions."""
    s = size / SIZE
    ax, ay = 218 * s, 186 * s
    bx, by = 218 * s, 326 * s
    cx, cy = 333 * s, 256 * s
    den = (by - ay) * (cx - ax) - (bx - ax) * (cy - ay)
    if den == 0:
        return False
    w1 = ((x - ax) * (by - ay) - (y - ay) * (bx - ax)) / den
    w2 = ((y - ay) * (cx - ax) - (x - ax) * (cy - ay)) / den
    w3 = 1 - w1 - w2
    pad = 0.004
    return w1 >= -pad and w2 >= -pad and w3 >= -pad


def render(size, ss=2):
    """Render at size with ss× supersampling."""
    big = size * ss
    px = bytearray()
    for y in range(big):
        row = bytearray([0])  # filter byte
        fy = (y + 0.5) * SIZE / big
        for x in range(big):
            fx = (x + 0.5) * SIZE / big
            if not inside_rounded_rect(fx, fy, SIZE, RADIUS):
                row += b'\x00\x00\x00\x00'
                continue
            t = (fx + fy) / (2 * SIZE)
            c = grad(t)
            if inside_triangle(fx, fy, SIZE):
                row += bytes((255, 255, 255, 255))
            else:
                row += bytes((c[0], c[1], c[2], 255))
        px += row
    # box-downsample ss×
    out = bytearray()
    stride = big * 4 + 1
    for y in range(size):
        out.append(0)
        for x in range(size):
            r = g = b = a = 0
            for dy in range(ss):
                for dx in range(ss):
                    o = (y * ss + dy) * stride + 1 + (x * ss + dx) * 4
                    r += px[o]; g += px[o + 1]; b += px[o + 2]; a += px[o + 3]
            n = ss * ss
            out += bytes((r // n, g // n, b // n, a // n))
    return bytes(out)


def write_png(path, size, raw):
    def chunk(tag, data):
        c = tag + data
        return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c))
    ihdr = struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)
    png = (b'\x89PNG\r\n\x1a\n'
           + chunk(b'IHDR', ihdr)
           + chunk(b'IDAT', zlib.compress(raw, 9))
           + chunk(b'IEND', b''))
    with open(path, 'wb') as f:
        f.write(png)
    print('wrote', path, os.path.getsize(path), 'bytes')


os.makedirs(OUT, exist_ok=True)
full = render(SIZE)
write_png(os.path.join(OUT, 'icon-512.png'), SIZE, full)
write_png(os.path.join(OUT, 'icon-192.png'), 192, render(192))
write_png(os.path.join(OUT, 'apple-touch-icon.png'), 180, render(180))
