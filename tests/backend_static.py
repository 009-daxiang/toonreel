"""Exercise both optional servers in isolated temporary directories."""
import os
from pathlib import Path
import shutil
import socket
import subprocess
import tempfile
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]

def response(base, route):
    try:
        with urllib.request.urlopen(base + route, timeout=3) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as error:
        return error.code, error.read()

for executable, filename in [('node', 'server.js'), ('python3', 'server.py')]:
    with tempfile.TemporaryDirectory(prefix='toonreel-test-') as directory:
        root = Path(directory)
        shutil.copyfile(ROOT / filename, root / filename)
        for folder in ['data', 'js', 'uploads', '.git', 'tools']:
            (root / folder).mkdir()
        for name, content in {'index.html': 'home', 'js/app.js': 'app',
                              'data/catalog.json': '{"shows":[]}',
                              'data/users.json': 'private', 'data/analytics.jsonl': 'private',
                              '.git/HEAD': 'private', 'tools/private.txt': 'private'}.items():
            (root / name).write_text(content)
        outside = root.parent / (root.name + '-outside')
        outside.mkdir()
        (outside / 'secret').write_text('private')
        (root / 'uploads/escape').symlink_to(outside / 'secret')
        (root / 'uploads/internal').symlink_to(root / 'data/users.json')
        with socket.socket() as sock:
            sock.bind(('127.0.0.1', 0))
            port = sock.getsockname()[1]
        with tempfile.TemporaryFile(mode='w+') as log:
            proc = subprocess.Popen([executable, filename], cwd=root,
                                    env={**os.environ, 'PORT': str(port)}, stdout=log, stderr=log)
            try:
                base = 'http://127.0.0.1:' + str(port)
                for attempt in range(100):
                    if proc.poll() is not None:
                        log.seek(0)
                        raise RuntimeError(log.read())
                    try:
                        with socket.create_connection(('127.0.0.1', port), timeout=.1):
                            break
                    except OSError:
                        time.sleep(.05)
                else:
                    raise RuntimeError(filename + ' did not start')
                for route in ['/', '/index.html', '/js/app.js', '/data/catalog.json', '/api/health']:
                    assert response(base, route)[0] == 200, (filename, route)
                for route in ['/data/users.json', '/data/analytics.jsonl', '/.git/HEAD',
                              '/' + filename, '/tools/private.txt', '/uploads/escape', '/uploads/internal',
                              '/%2e%2e/' + outside.name + '/secret', '/js/%2e%2e/data/users.json']:
                    assert response(base, route)[0] == 403, (filename, route)
                assert response(base, '/js/missing.js')[0] == 404
                print(filename + ': public assets and API reachable; private/traversal/symlink paths blocked')
            finally:
                proc.terminate()
                proc.wait(timeout=5)
                shutil.rmtree(outside)
