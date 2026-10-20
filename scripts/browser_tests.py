#!/usr/bin/env python3
"""Actual browser module tests using Chromium via Playwright when available."""
import argparse,subprocess,sys,time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def main():
 p=argparse.ArgumentParser();p.add_argument('--port',type=int,default=8765);args=p.parse_args()
 try:from playwright.sync_api import sync_playwright
 except ImportError:sys.exit('Optional playwright not installed; open /tests.html in a browser instead.')
 server=subprocess.Popen([sys.executable,'-m','http.server',str(args.port),'--bind','127.0.0.1'],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 time.sleep(.35)
 try:
  with sync_playwright() as pw:
   browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium');page=browser.new_page();page.goto(f'http://127.0.0.1:{args.port}/tests.html');page.wait_for_function('window.__rocketTestResults !== undefined',timeout=10000);data=page.evaluate('window.__rocketTestResults');print(page.locator('#result').inner_text());browser.close()
   if data['failed']:sys.exit(1)
 finally:server.terminate();server.wait(timeout=5)
if __name__=='__main__':main()
