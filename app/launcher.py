"""Shared desktop launcher, invoked by the OS-specific entry point."""
import os
import sys
import json
import urllib.request
import webbrowser
from pathlib import Path
ROOT=Path(__file__).resolve().parent
os.chdir(ROOT)
cert=ROOT/'certs'/'cacert.pem'
if cert.exists():os.environ.setdefault('SSL_CERT_FILE',str(cert))

def reuse():
    for port in range(8765,8780):
        base=f'http://127.0.0.1:{port}'
        try:
            # Ignore system HTTP proxy for a loopback readiness probe.
            opener=urllib.request.build_opener(urllib.request.ProxyHandler({}))
            token=json.load(opener.open(base+'/api/bootstrap',timeout=.2))['token']
            req=urllib.request.Request(base+'/api/health',headers={'X-MoveMate-Token':token})
            result=json.load(opener.open(req,timeout=.3))
            if result.get('app')=='movemate' and result.get('ok'):
                webbrowser.open(base);print('MoveMate is already running: '+base);return True
        except Exception:pass
    return False
if __name__=='__main__':
    try:
        import sqlite3,ssl
        if not reuse():
            from backend.server import main
            main()
    except KeyboardInterrupt:pass
    except Exception as e:
        print('MoveMate startup failed: '+str(e))
        input('Press Enter to close...')
