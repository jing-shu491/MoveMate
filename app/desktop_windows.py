"""Windows native window (WinForms + Edge WebView2), no browser UI."""
import ctypes
import os
import sys
import threading
from pathlib import Path
ROOT=Path(__file__).resolve().parent
os.chdir(ROOT)
os.environ.setdefault('SSL_CERT_FILE',str(ROOT/'certs'/'cacert.pem'))

def message(text,error=True):
    return ctypes.windll.user32.MessageBoxW(None,text,'MoveMate 启动自检',0x10 if error else 0x40)

class DesktopApi:
    """Small JS bridge for native WebView2 page zoom."""

    def _form(self):
        import webview
        from webview.platforms.winforms import BrowserView
        if not webview.windows:
            return None
        return BrowserView.instances.get(webview.windows[0].uid)

    def _run_on_ui(self, form, action):
        from System import Action
        if form.InvokeRequired:
            form.Invoke(Action(action))
        else:
            action()

    def get_zoom(self):
        try:
            form = self._form()
            if form is None or not hasattr(form, 'webview'):
                return {'ok': False}
            result = {}
            def read():
                result['factor'] = float(form.webview.ZoomFactor)
            self._run_on_ui(form, read)
            return {'ok': True, 'percent': round(result['factor'] * 100)}
        except Exception:
            return {'ok': False}

    def set_zoom(self, percent):
        try:
            value = max(80.0, min(200.0, float(percent)))
        except (TypeError, ValueError):
            return {'ok': False}
        try:
            form = self._form()
            if form is None or not hasattr(form, 'webview'):
                return {'ok': False}
            result = {}
            def write():
                form.webview.ZoomFactor = value / 100.0
                result['factor'] = float(form.webview.ZoomFactor)
            self._run_on_ui(form, write)
            return {'ok': True, 'percent': round(result['factor'] * 100)}
        except Exception:
            return {'ok': False}

def main():
    from backend.server import App,data_dir
    from backend.store import Store
    import webview
    store=Store(data_dir())
    if not store.healthy():raise RuntimeError('数据库检查失败，请先备份用户数据目录。')
    for port in range(8765,8780):
        try:server=App(('127.0.0.1',port),store);break
        except OSError:continue
    else:raise RuntimeError('本机端口已占用，请退出其他 MoveMate 窗口后重试。')
    thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
    webview.settings['ALLOW_DOWNLOADS']=True
    webview.settings['OPEN_EXTERNAL_LINKS_IN_BROWSER']=True
    api=DesktopApi()
    try:
        webview.create_window('MoveMate 跃动',f'http://127.0.0.1:{server.server_port}',width=1240,height=850,min_size=(820,640),background_color='#f7f8f4',text_select=True,zoomable=True,js_api=api)
        webview.start(gui='edgechromium',debug=False,private_mode=False,storage_path=str(data_dir()/'WebView2'))
    finally:server.shutdown();server.server_close()

if __name__=='__main__':
    try:main()
    except Exception as e:
        message('独立窗口未能启动。\n\n请确认 Windows 已安装 Microsoft Edge WebView2 Runtime 和 .NET Framework 4.8，并完整解压程序包。\n\n错误：'+str(e))
