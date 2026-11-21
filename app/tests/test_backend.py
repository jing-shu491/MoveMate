import json
import sys
import tempfile
import threading
import unittest
import urllib.request
import urllib.error
from pathlib import Path
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from backend.ai import complete,validate_config,wire,FORMATS,AIError
from backend.server import App,APP_ID,VERSION
from backend.store import Store,EMPTY

class Mock(BaseHTTPRequestHandler):
    calls=[]
    fail=False
    fail_status=401
    def log_message(self,*a):pass
    def do_POST(self):
        data=json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        self.calls.append((self.path,dict(self.headers),data))
        if self.fail:self.send_response(self.fail_status);self.end_headers();self.wfile.write(b'secret-key-must-not-leak');return
        if self.path.endswith('/chat/completions'):obj={'choices':[{'message':{'content':'MOCK AI OK'}}]}
        elif self.path.endswith('/responses'):obj={'output':[{'type':'message','content':[{'type':'output_text','text':'MOCK AI OK'}]}]}
        elif self.path.endswith('/messages'):obj={'content':[{'type':'text','text':'MOCK AI OK'}]}
        elif ':generateContent' in self.path:obj={'candidates':[{'content':{'parts':[{'text':'MOCK AI OK'}]}}]}
        else:obj={'message':{'content':'MOCK AI OK'}}
        raw=json.dumps(obj).encode();self.send_response(200);self.send_header('Content-Length',str(len(raw)));self.end_headers();self.wfile.write(raw)

class BackendTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.mock=ThreadingHTTPServer(('127.0.0.1',0),Mock);threading.Thread(target=cls.mock.serve_forever,daemon=True).start()
        cls.base=f'http://127.0.0.1:{cls.mock.server_port}'
    @classmethod
    def tearDownClass(cls):cls.mock.shutdown();cls.mock.server_close()
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.store=Store(self.tmp.name);self.app=App(('127.0.0.1',0),self.store);threading.Thread(target=self.app.serve_forever,daemon=True).start();self.url=f'http://127.0.0.1:{self.app.server_port}';Mock.fail=False;Mock.fail_status=401
    def tearDown(self):self.app.shutdown();self.app.server_close();self.tmp.cleanup()
    def config(self,fmt='openai'):return {'format':fmt,'base_url':self.base,'model':'test-model','api_key':'test-only-key'}
    def api(self,path,body=None,token=True):
        h={'Content-Type':'application/json'}
        if token:h['X-MoveMate-Token']=self.app.token
        req=urllib.request.Request(self.url+path,json.dumps(body).encode() if body is not None else None,h)
        try:
            with urllib.request.urlopen(req) as r:return r.status,json.load(r)
        except urllib.error.HTTPError as e:return e.code,json.load(e)
    def test_all_six_wire_formats(self):
        for fmt in ('deepseek','openai','responses','anthropic','gemini','ollama'):
            with self.subTest(fmt=fmt):
                self.assertEqual(complete(self.config(fmt),'system rule',[{'role':'user','content':'hello'}]),'MOCK AI OK')
                path,headers,data=Mock.calls[-1]
                self.assertEqual(data.get('model','test-model'),'test-model')
                if fmt in ('deepseek','openai','responses'):self.assertEqual(headers['Authorization'],'Bearer test-only-key')
                if fmt=='anthropic':self.assertEqual(headers['X-Api-Key'],'test-only-key');self.assertEqual(data['system'],'system rule')
                if fmt=='gemini':self.assertEqual(headers['X-Goog-Api-Key'],'test-only-key');self.assertEqual(data['contents'][0]['role'],'user')
    def test_deepseek_preset(self):
        self.assertEqual(FORMATS['deepseek']['base_url'],'https://api.deepseek.com/v1')
        self.assertEqual(FORMATS['deepseek']['default_model'],'deepseek-chat')
        self.assertEqual(FORMATS['deepseek']['models'],['deepseek-chat','deepseek-reasoner'])
        c=self.config('deepseek');c['base_url']=FORMATS['deepseek']['base_url'];c['model']=FORMATS['deepseek']['default_model']
        url,headers,data=wire(validate_config(c),'system rule',[{'role':'user','content':'hello'}])
        self.assertEqual(url,'https://api.deepseek.com/v1/chat/completions')
        self.assertEqual(headers['Authorization'],'Bearer test-only-key')
        self.assertEqual(data['model'],'deepseek-chat')
        self.assertFalse(data['stream'])
    def test_deepseek_config_test_save_chat(self):
        c=self.config('deepseek')
        self.assertEqual(self.api('/api/config/test',c)[0],200)
        self.assertEqual(self.api('/api/config/save',c)[0],200)
        status,r=self.api('/api/chat',{'question':'DeepSeek 怎么用？','revision':0})
        self.assertEqual(status,200);self.assertEqual(r['text'],'MOCK AI OK');self.assertEqual(r['provider'],'deepseek')
    def test_health_identity(self):
        status,r=self.api('/api/health');self.assertEqual(status,200);self.assertEqual(r['app'],APP_ID);self.assertEqual(r['version'],VERSION)
    def test_key_not_in_public_health(self):
        self.store.put('config',self.config());status,result=self.api('/api/health');self.assertEqual(status,200);self.assertNotIn('test-only-key',json.dumps(result))
    def test_key_not_returned_from_config(self):
        self.store.put('config',self.config());_,result=self.api('/api/config');self.assertTrue(result['has_key']);self.assertNotIn('api_key',result['config'])
    def test_missing_config_chat(self):self.assertEqual(self.api('/api/chat',{'question':'hello','revision':0})[0],428)
    def test_bootstrap(self):self.assertEqual(self.api('/api/bootstrap',token=False)[1]['token'],self.app.token)
    def test_csrf_required(self):self.assertEqual(self.api('/api/config/save',self.config(),token=False)[0],403)
    def test_backend_files_not_served(self):self.assertEqual(self.api('/backend/server.py')[0],404)
    def test_persistence_and_conflict(self):
        s=dict(EMPTY);s['messages']=[{'role':'user','text':'hello'}]
        self.assertEqual(self.api('/api/state',{'state':s,'revision':0})[1]['revision'],1)
        self.assertEqual(self.api('/api/state',{'state':s,'revision':0})[0],409)
        self.assertEqual(Store(self.tmp.name).state()['state']['messages'][0]['text'],'hello')
    def test_config_test_save_chat(self):
        c=self.config()
        self.assertEqual(self.api('/api/config/test',c)[0],200)
        self.assertEqual(self.api('/api/config/save',c)[0],200)
        status,r=self.api('/api/chat',{'question':'why this plan?','revision':0})
        self.assertEqual(status,200);self.assertEqual(r['text'],'MOCK AI OK');self.assertEqual(len(self.store.get('state')['messages']),2)
    def test_keep_existing_key(self):
        self.store.put('config',self.config());c=self.config();c['api_key']=''
        self.assertEqual(self.api('/api/config/test',c)[0],200)
        c['base_url']=self.base+'/new';self.assertEqual(self.api('/api/config/save',c)[0],502)
    def test_upstream_error_redacted(self):
        Mock.fail=True
        status,r=self.api('/api/config/test',self.config());self.assertEqual(status,502);self.assertNotIn('secret-key',json.dumps(r))
    def test_insufficient_balance_hint(self):
        Mock.fail=True;Mock.fail_status=402
        status,r=self.api('/api/config/test',self.config('deepseek'));self.assertEqual(status,502);self.assertIn('余额',r['error'])
    def test_invalid_state(self):self.assertEqual(self.api('/api/state',{'state':{'x':1},'revision':0})[0],400)
    def test_insecure_remote_rejected(self):
        c=self.config();c['base_url']='http://example.com';self.assertRaises(AIError,validate_config,c)
    def test_invalid_model_rejected(self):
        c=self.config();c['model']='bad model';self.assertRaises(AIError,validate_config,c)
    def test_no_key_ollama(self):
        c=self.config('ollama');c['api_key']='';self.assertEqual(complete(c,'system',[{'role':'user','content':'hello'}]),'MOCK AI OK')
    def test_malformed_json_rejected(self):
        request=urllib.request.Request(self.url+'/api/state',b'{"state":NaN}',{'Content-Type':'application/json','X-MoveMate-Token':self.app.token})
        with self.assertRaises(urllib.error.HTTPError) as error:urllib.request.urlopen(request)
        self.assertEqual(error.exception.code,400)

if __name__=='__main__':unittest.main(verbosity=2)
