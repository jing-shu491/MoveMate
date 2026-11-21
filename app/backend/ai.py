"""Small wire-format adapters. Keys never go to the browser after saving."""
import json
import re
import socket
import urllib.error
import urllib.parse
import urllib.request

FORMATS = {
    'deepseek': {
        'name':'DeepSeek 官方 API（OpenAI 兼容）',
        'base_url':'https://api.deepseek.com/v1',
        'default_model':'deepseek-chat',
        'models':['deepseek-chat','deepseek-reasoner'],
        'key_url':'https://platform.deepseek.com/api_keys',
    },
    'openai': {'name':'OpenAI Chat Completions / 兼容接口', 'base_url':'https://api.openai.com/v1'},
    'responses': {'name':'OpenAI Responses', 'base_url':'https://api.openai.com/v1'},
    'anthropic': {'name':'Anthropic Messages', 'base_url':'https://api.anthropic.com/v1'},
    'gemini': {'name':'Gemini generateContent', 'base_url':'https://generativelanguage.googleapis.com/v1beta'},
    'ollama': {'name':'Ollama 本机模型', 'base_url':'http://127.0.0.1:11434'},
}
class AIError(Exception):
    pass
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise AIError('接口返回重定向，请填写最终 API 地址后重试。')

def validate_config(c):
    if c.get('format') not in FORMATS:
        raise AIError('请选择支持的 API 格式。')
    for key in ('base_url','model','api_key'):
        if not isinstance(c.get(key,''),str) or len(c.get(key,''))>4096:
            raise AIError('配置字段格式无效。')
    c={k:c.get(k,'').strip() for k in ('format','base_url','model','api_key')}
    c['base_url']=c['base_url'].rstrip('/')
    u=urllib.parse.urlsplit(c['base_url'])
    if not u.hostname or u.username or u.password or u.query or u.fragment:
        raise AIError('API 地址不能包含密码、查询参数或锚点。')
    if u.scheme!='https' and not (u.scheme=='http' and u.hostname in ('127.0.0.1','localhost','::1')):
        raise AIError('远程接口请使用 HTTPS；本机模型支持 HTTP。')
    if not c['model'] or not re.fullmatch(r'[A-Za-z0-9_./:@+\-]+',c['model']):
        raise AIError('请填写有效模型 ID（不是网页上的展示名称）。')
    if c['format']!='ollama' and not c['api_key']:
        raise AIError('请填写 API Key。')
    return c

def wire(c, system, messages):
    base=c['base_url']; model=c['model']; key=c['api_key']; fmt=c['format']
    headers={'Content-Type':'application/json','Accept':'application/json','User-Agent':'MoveMate/3.2'}
    if fmt in ('deepseek','openai'):
        suffix='/chat/completions'; headers['Authorization']='Bearer '+key
        data={'model':model,'messages':[{'role':'system','content':system}]+messages,'stream':False}
    elif fmt=='responses':
        suffix='/responses';headers['Authorization']='Bearer '+key
        data={'model':model,'instructions':system,'input':messages,'store':False,'stream':False}
    elif fmt=='anthropic':
        suffix='/messages';headers.update({'x-api-key':key,'anthropic-version':'2023-06-01'})
        data={'model':model,'system':system,'messages':messages,'max_tokens':2048,'stream':False}
    elif fmt=='gemini':
        suffix='/models/'+urllib.parse.quote(model.removeprefix('models/'),safe='')+':generateContent'
        headers['x-goog-api-key']=key
        data={'systemInstruction':{'parts':[{'text':system}]},'contents':[{'role':'model' if m['role']=='assistant' else 'user','parts':[{'text':m['content']}]} for m in messages]}
    else:
        suffix='/api/chat'
        data={'model':model,'messages':[{'role':'system','content':system}]+messages,'stream':False}
    # Accept either the base prefix or the full endpoint pasted from a provider.
    url=base if base.endswith(suffix) else base+suffix
    return url, headers, data

def extract(fmt, obj):
    try:
        if fmt in ('deepseek','openai'): text=obj['choices'][0]['message']['content']
        elif fmt=='responses':
            text='\n'.join(p['text'] for item in obj.get('output',[]) if item.get('type')=='message' for p in item.get('content',[]) if p.get('type')=='output_text')
        elif fmt=='anthropic':text='\n'.join(p['text'] for p in obj['content'] if p.get('type')=='text')
        elif fmt=='gemini':text='\n'.join(p.get('text','') for p in obj['candidates'][0]['content']['parts'] if not p.get('thought'))
        else:text=obj['message']['content']
    except (KeyError,IndexError,TypeError):
        raise AIError('接口已响应，但返回内容不符合所选 API 格式。请检查格式和模型 ID。')
    if not isinstance(text,str) or not text.strip():raise AIError('模型没有返回可显示的文本。')
    return text.strip()[:24000]

def complete(config, system, messages, timeout=60):
    c=validate_config(config);url,headers,data=wire(c,system,messages)
    request=urllib.request.Request(url,json.dumps(data).encode(),headers,method='POST')
    try:
        opener=urllib.request.build_opener(NoRedirect())
        with opener.open(request,timeout=timeout) as response:
            raw=response.read(2_000_001)
        if len(raw)>2_000_000:raise AIError('接口响应过大，请更换模型或缩短问题。')
        return extract(c['format'],json.loads(raw))
    except urllib.error.HTTPError as e:
        hints={400:'请求格式或模型不匹配',401:'API Key 无效或已失效',402:'账户余额不足',403:'无访问权限或地区限制',404:'地址或模型不存在',429:'请求限流或余额不足'}
        raise AIError(f'API 返回 HTTP {e.code}：{hints.get(e.code,"服务暂时不可用")}。')
    except (TimeoutError,socket.timeout):raise AIError('模型请求超时，请稍后重试。')
    except urllib.error.URLError:raise AIError('连接失败，请检查 API 地址、网络、代理和证书。')
    except (ValueError,UnicodeError):raise AIError('接口未返回有效 JSON，请检查是否误填成了网页地址。')
