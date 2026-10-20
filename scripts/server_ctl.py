#!/usr/bin/env python3
"""Control development-only stdlib static server, no application backend."""
import argparse,os,signal,socket,subprocess,sys,time,urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];PID=ROOT/'.server.pid';LOG=ROOT/'.server.log'
def live(pid):
 try: os.kill(pid,0);return True
 except (OSError,ProcessLookupError):return False
def pid():
 try:return int(PID.read_text())
 except (ValueError,OSError):return None
def healthy(host,port):
 try:
  with urllib.request.urlopen(f'http://{host}:{port}/',timeout=1) as r:return r.status==200
 except Exception:return False
def stop():
 p=pid()
 if p and live(p):
  os.kill(p,signal.SIGTERM)
  for _ in range(20):
   if not live(p):break
   time.sleep(.1)
 if PID.exists():PID.unlink()
 print('Stopped' if p else 'No managed server')
def start(a):
 p=pid()
 if p and live(p):print(f'Already running PID {p}');return
 if healthy(a.host,a.port):print('Port occupied by another HTTP server; refusing to start');sys.exit(1)
 with LOG.open('ab') as f: proc=subprocess.Popen([sys.executable,'-m','http.server',str(a.port),'--bind',a.host],cwd=ROOT,stdout=f,stderr=subprocess.STDOUT,start_new_session=True)
 PID.write_text(str(proc.pid))
 for _ in range(30):
  if healthy(a.host,a.port):break
  if proc.poll() is not None:break
  time.sleep(.15)
 if not healthy(a.host,a.port):print('Server failed; inspect .server.log');sys.exit(1)
 print(f'Running PID {proc.pid}: http://{a.host}:{a.port}/')
def main():
 pa=argparse.ArgumentParser();pa.add_argument('action',choices=['start','stop','restart','status']);pa.add_argument('--host',default='127.0.0.1');pa.add_argument('--port',type=int,default=8765);a=pa.parse_args()
 if a.action=='start':start(a)
 elif a.action=='stop':stop()
 elif a.action=='restart':stop();start(a)
 else:
  p=pid();print(f'Status: {"RUNNING" if p and live(p) and healthy(a.host,a.port) else "STOPPED/UNHEALTHY"}; PID: {p or "—"}; URL: http://{a.host}:{a.port}/; browser tests: /tests.html')
if __name__=='__main__':main()
