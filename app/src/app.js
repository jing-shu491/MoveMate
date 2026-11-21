import {dayKey,weekStart,dateAt,generatePlan,validateLog,stats,SOURCE} from './domain.js';
const KEY='movemate.v2';
const fresh=()=>({version:2,profile:null,plan:null,logs:[],messages:[],knowledge:[]});
let state=fresh(), storageError='';
let revision=0, token='', backendReady=false, apiStatus={configured:false}, busy=false;
async function request(path, body) {
  const response=await fetch(path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json','X-MoveMate-Token':token},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const result=await response.json();
  if(!response.ok)throw new Error(result.error||`服务返回 ${response.status}`);
  return result;
}
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const weekdays=['周一','周二','周三','周四','周五','周六','周日'];
const titles={home:'今日概览',profile:'健康与偏好',plan:'我的计划',record:'训练记录',chat:'计划助手',manage:'本地数据管理'};
let toastTimer;
function toast(s){$('#toast').textContent=s;$('#toast').style.display='block';clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').style.display='none',3500);}
async function save(next){
  if(storageError||!backendReady){toast(storageError||'本机服务未连接，请重新启动应用');return false;}
  try{const result=await request('/api/state',{state:next,revision});state=next;revision=result.revision;return true;}
  catch(e){toast(e.message);return false;}
}
function go(page){if(location.hash==='#'+page)render();else location.hash=page;}
const button=(text,page,secondary=false)=>`<a class="${secondary?'secondary':'primary'}" href="#${page}">${text}<span>↗</span></a>`;
function head(title,sub,action=''){return `<div class="page-head"><div><div class="eyebrow">YOUR EVERYDAY, A LITTLE BETTER</div><h1>${title}</h1><p class="sub">${sub}</p></div>${action}</div>`;}
function empty(title,text,action=button('创建我的计划','profile')){return `<div class="empty"><strong>${title}</strong>${text}<div>${action}</div></div>`;}
function metric(title,value,unit,detail,icon){return `<div class="metric"><div class="metric-top"><span>${title}</span><span>${icon}</span></div><strong>${value}<small>${unit}</small></strong><div class="sub">${detail}</div></div>`;}
function strip(){const start=weekStart();return `<div class="week-strip">${weekdays.map((d,i)=>{const date=dateAt(start,i),done=state.logs.some(l=>l.date===date);return `<div class="day ${date===dayKey()?'today':''} ${done?'done':''}">${d}<b>${new Date(date+'T12:00:00').getDate()}</b><span class="dot"></span></div>`;}).join('')}</div>`;}
const art=`<svg class="hero-art" viewBox="0 0 290 270" aria-hidden="true"><circle cx="162" cy="142" r="101" fill="#dce6c9"/><circle cx="162" cy="142" r="78" fill="none" stroke="#c6d4af" stroke-dasharray="3 7"/><path d="M30 244H280" stroke="#b6c69e"/><path d="M164 143L140 184 93 218" fill="none" stroke="#214a3c" stroke-width="23" stroke-linecap="round"/><path d="M169 144L202 174 228 214" fill="none" stroke="#39604b" stroke-width="22" stroke-linecap="round"/><path d="M182 83L164 143" stroke="#a7c66d" stroke-width="34" stroke-linecap="round"/><path d="M179 91L204 124 235 112M174 94L143 114 123 102" fill="none" stroke="#deb997" stroke-width="12" stroke-linecap="round"/><circle cx="190" cy="53" r="19" fill="#deb997"/><path d="M172 49Q171 25 192 29Q213 29 211 47L194 44 185 52" fill="#23483a"/><path d="M82 222L100 223M223 222L245 222" stroke="#254c3b" stroke-width="10" stroke-linecap="round"/><path d="M48 172L73 164M58 183L81 177" stroke="#b9cd93" stroke-width="3" stroke-linecap="round"/><circle cx="252" cy="61" r="18" fill="#f5f8ec"/><path d="M244 61L250 67 260 55" fill="none" stroke="#87a15e" stroke-width="2"/></svg>`;
function home(){const s=stats(state.logs,state.plan);const current=state.plan?.start===dayKey(weekStart());const today=state.plan?.items.find(i=>i.date===dayKey());const done=state.logs.some(l=>l.date===dayKey());const latest=state.logs.filter(l=>l.weight!==null).slice().sort((a,b)=>a.date.localeCompare(b.date)).at(-1);return head(`你好，${esc(state.profile?.name||'新朋友')}。`,'把大目标，变成今天的小小行动。',button('编辑我的偏好','profile',true))+`<section class="hero"><div class="hero-copy"><span class="pill">${current?'属于你的运动节奏':'从一个小目标开始'}</span><h2>${today&&!today.rest?'今天，给自己一点<br>动起来的时间。':'运动的好习惯，<br>从今天开始。'}</h2><p>${today&&!today.rest?`${esc(today.title)} · ${today.minutes} 分钟 · 按自己的节奏完成`:'找到适合你的节奏，让每一次坚持都看得见。'}</p>${button(current?'查看我的计划':state.plan?'更新本周计划':'定制第一周计划',current?'plan':'profile')}</div>${art}</section><div class="metrics">${metric('本周训练',s.count,`/ ${s.target||'—'} 次`,s.target?`计划完成 ${s.percent}%`:'生成计划后开始累计','▦')}${metric('本周活动',s.total,'分钟','记录每一次真实的付出','◷')}${metric('连续记录',s.streak,'天',s.streak?'保持自己的节奏':'每一天都可以是新的开始','↗')}${metric('最近体重',latest?latest.weight:'—','kg',latest?`${latest.date} · 手动记录`:'尚未记录身体数据','◎')}</div><div class="columns"><section class="card"><div class="card-head"><h2>这一周，慢慢来</h2><a class="text-link" href="#plan">查看周计划 ↗</a></div>${strip()}${today&&!today.rest?`<div class="session"><div class="session-icon">↗</div><div class="session-text"><h3>${esc(today.title)}</h3><p>${today.minutes} 分钟 · ${done?'已完成记录':'今天的训练安排'}</p></div>${button(done?'查看记录':'去打卡','record')}</div>`:`<div class="session"><div class="session-icon">☀</div><div class="session-text"><h3>${current?'今天留给恢复':state.plan?'新的一周，重新出发':'你的第一周，由你开启'}</h3><p>${current?'查看周计划，找到下一个训练日。':'完成健康与偏好档案，就可以生成本周计划。'}</p></div></div>`}<div class="progress-top"><span>本周完成进度</span><span>${s.count} / ${s.target||'—'}</span></div><div class="bar"><i style="width:${s.percent}%"></i></div><p class="note">休息也是计划的一部分。无需每天训练，规律比连续打卡更重要。</p></section><section class="card"><div class="card-head"><h2>给今天的一点灵感</h2><span class="badge">MOVE NOTES</span></div><div class="insight"><b>01 &nbsp; 先建立习惯，再增加运动量</b><p>从少量活动开始，根据自己的状态逐步增加时间与频率。</p></div><div class="insight"><b>02 &nbsp; 记录感受，找到你的节奏</b><p>训练后标记感受。觉得吃力时，重新生成计划会缩短单次时长。</p></div><a class="source" href="${SOURCE}" target="_blank" rel="noopener">通用活动原则参考：WHO ↗</a><p class="note">此版本提供入门模板与记录工具，适用于通过本页筛查的 18–64 岁成年人。非医疗建议。</p></section></div>`;}
function profile(){const p=state.profile||{name:'',age:22,height:170,weight:65,days:3,minutes:20,goal:'habit',place:'home',level:'beginner',risks:[false,false,false],notes:'',confirm:false};const select=(key,options)=>`<select name="${key}">${options.map(([v,t])=>`<option value="${v}" ${p[key]===v?'selected':''}>${t}</option>`).join('')}</select>`;return head('找到适合你的节奏','用几分钟认识自己，开启一周运动安排。')+`<div class="columns"><form id="profile-form" class="card"><div class="card-head"><h2>01 / 关于你</h2><span class="badge">保存在本机数据库</span></div><div class="form-grid"><label class="field span2">怎么称呼你<input name="name" maxlength="30" required value="${esc(p.name)}" placeholder="输入你的称呼"></label>${[['age','年龄',18,64,1],['height','身高 · cm',100,230,.1],['weight','体重 · kg',30,250,.1]].map(([k,t,min,max,step])=>`<label class="field">${t}<input name="${k}" type="number" required min="${min}" max="${max}" step="${step}" value="${p[k]}"></label>`).join('')}<label class="field">当前运动习惯${select('level',[['beginner','刚开始 / 偶尔活动'],['regular','已经有规律运动']])}</label><label class="field">这次最想做到${select('goal',[['habit','建立运动习惯'],['fitness','改善日常体能'],['strength','增加力量练习']])}</label><label class="field">更喜欢在哪里${select('place',[['home','居家 · 无器械'],['outdoor','户外 · 步行']])}</label><label class="field">每周可以安排${select('days',[[2,'2 天'],[3,'3 天'],[4,'4 天'],[5,'5 天']].map(([v,t])=>[v,t]))}</label><label class="field">每次可以留出 · 分钟<input name="minutes" type="number" min="10" max="60" required value="${p.minutes}"></label></div><h2 class="form-section">02 / 先确认身体状态</h2><p class="sub">这是本项目的简化风险确认，不是完整 PAR-Q+ 问卷。以下任一项适用时暂停自动安排。</p>${['有心血管或其他需专业指导的健康情况','近期有胸痛、眩晕、呼吸困难等情况','有未痊愈的伤病，或活动时疼痛'].map((t,i)=>`<label class="check"><input type="checkbox" name="risk${i}" ${p.risks[i]?'checked':''}>${t}</label>`).join('')}<label class="field">需要说明的健康情况（可选）<textarea name="notes" rows="2" maxlength="300" placeholder="有伤病或健康顾虑时，请在这里说明">${esc(p.notes)}</textarea></label><label class="check"><input type="checkbox" name="confirm" ${p.confirm?'checked':''} required>我已阅读适用范围，理解本工具提供运动入门模板，不能代替医疗评估。</label><div id="form-error" class="error" role="alert"></div><div class="actions"><button class="primary" type="submit">保存并生成本周计划 <span>↗</span></button></div><p class="note">重新生成会替换当前计划，历史训练记录保留。</p></form><aside><div class="card"><div class="eyebrow">MADE FOR YOUR REAL LIFE</div><h2>让计划适应生活。</h2><p class="note">训练频率来自你能投入的天数；单次时长来自可用时间；场景和目标决定活动组合。</p><div class="insight section-gap"><b>新手从小步开始</b><p>本地模板把新手单次时长上限设为 30 分钟，方便开始。这是产品规则，不是个体化医学判断。</p></div><div class="insight"><b>反馈真的会生效</b><p>最近三条训练有“吃力”反馈时，重新生成会减少 5 分钟，最低 10 分钟。</p></div><a class="source" href="${SOURCE}" target="_blank" rel="noopener">阅读 WHO 活动建议 ↗</a></div></aside></div>`;}
function plan(){if(!state.plan)return head('我的一周计划','留出运动时间，也留出恢复空间。')+`<section class="card">${empty('从你的生活出发','告诉我们你的目标和可用时间，生成自己的第一周安排。')}</section>`;const p=state.plan,s=stats(state.logs,p);return head('我的一周计划',`${p.start} 起 · ${esc(p.profile.name)}的运动安排`,button('调整偏好 / 重新生成','profile',true))+`<div class="notice">${esc(p.explanation)}</div><div class="plan-meta"><span class="badge">${p.profile.days} 天训练</span><span class="badge">${s.percent}% 已完成</span><span class="badge">本地模板 starter-v1</span></div><div class="columns"><section class="plan-list">${p.items.map((i,index)=>{const done=state.logs.some(l=>l.date===i.date);return `<article class="plan-row ${i.rest?'rest':''}"><div class="plan-date">${weekdays[index]}<strong>${i.date.slice(5).replace('-','/')}</strong></div><div><h3>${esc(i.title)} ${done?'<span class="badge">已记录 ✓</span>':''}</h3><p>${i.rest?'恢复日':`${i.type} · ${i.minutes} 分钟 · 舒适节奏`}</p>${!i.rest?`<details><summary>查看活动步骤</summary><ol>${i.steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ol><p>总时长包含开始与结束活动，可按体感分段完成；不适时停止。</p></details>`:''}</div>${!i.rest&&i.date<=dayKey()&&!done?`<button class="secondary" data-log-date="${i.date}">记录训练 ↗</button>`:''}</article>`;}).join('')}</section><aside class="card" style="align-self:start"><h2>计划是起点，感受是反馈。</h2><p class="note">不按体重预测热量消耗，不承诺减重速度。先关注规律、实际活动分钟数和训练后的感受。</p><div class="insight section-gap"><b>关于这个安排</b><p>WHO 支持从少量活动逐步增加。具体日程、动作组合与反馈规则由本项目提供，尚未经过临床验证。</p></div><a class="source" href="${SOURCE}" target="_blank" rel="noopener">通用活动原则 ↗</a><p class="note">当周计划不会跨周自动延续。新的一周请重新确认档案并生成。</p></aside></div>`;}
function chart(){const weights=state.logs.filter(l=>l.weight!==null).sort((a,b)=>a.date.localeCompare(b.date)).slice(-10);if(weights.length<2)return empty('记录变化，不急着下结论',weights.length?'已有 1 个体重点，再记录一次即可显示趋势。':'至少记录 2 次体重后显示趋势。','');const vals=weights.map(l=>l.weight),min=Math.min(...vals)-1,max=Math.max(...vals)+1;const pts=weights.map((l,i)=>`${45+i*500/(weights.length-1)},${145-(l.weight-min)/(max-min)*110}`).join(' ');return `<svg class="chart" viewBox="0 0 600 180" role="img" aria-label="最近 ${weights.length} 次体重趋势"><path d="M40 35H570M40 90H570M40 145H570" stroke="#edf0e7" fill="none"/><text x="4" y="39">${max.toFixed(1)}</text><text x="4" y="149">${min.toFixed(1)}</text><polyline points="${pts}" fill="none" stroke="#8da95d" stroke-width="3"/>${weights.map((l,i)=>`<circle cx="${45+i*500/(weights.length-1)}" cy="${145-(l.weight-min)/(max-min)*110}" r="4" fill="#244a3b"><title>${l.date}: ${l.weight} kg</title></circle>`).join('')}<text x="40" y="175">${weights[0].date.slice(5)}</text><text x="510" y="175">${weights.at(-1).date.slice(5)}</text></svg>`;}
let logDate='';
function record(){const available=state.plan?.items.filter(i=>!i.rest&&i.date<=dayKey()&&!state.logs.some(l=>l.date===i.date))||[];return head('每一次行动，都算数。','记录训练，也记录身体给你的反馈。')+`<div class="columns"><form id="log-form" class="card"><div class="card-head"><h2>记下这次训练</h2><span class="badge">每天一条</span></div>${available.length?`<div class="form-grid"><label class="field span2">训练日<select name="date" id="log-date">${available.map(i=>`<option value="${i.date}" ${i.date===logDate?'selected':''}>${i.date} · ${esc(i.title)}</option>`).join('')}</select></label><label class="field">实际活动 · 分钟<input name="minutes" type="number" required min="1" max="180" value="${available.find(i=>i.date===logDate)?.minutes||available[0].minutes}"></label><label class="field">今日体重 · kg（可选）<input name="weight" type="number" min="30" max="250" step="0.1" placeholder="留空也可以"></label><label class="field span2">练完感觉如何<select name="feeling"><option value="good">刚刚好，节奏合适</option><option value="easy">比较轻松</option><option value="hard">有些吃力，希望下次轻一点</option></select></label><label class="field span2">想记住的事<textarea name="note" rows="2" maxlength="300" placeholder="比如：今天出门走了一圈，心情很好。"></textarea></label></div><div class="error" id="log-error" role="alert"></div><button class="primary section-gap" type="submit">保存这次训练 ✓</button>`:empty('暂时没有待记录的训练日',state.plan?'本计划中截至今天的训练已记录，或训练安排在未来。':'先创建计划，再记录自己的训练。',button(state.plan?'查看计划':'创建计划',state.plan?'plan':'profile'))}</form><section class="card"><div class="card-head"><h2>体重变化</h2><span class="badge">最近 10 次记录 · kg</span></div>${chart()}<p class="note">体重会自然波动。这里呈现真实记录，不预测减重效果。</p></section></div><section class="card section-gap"><div class="card-head"><h2>我的训练足迹</h2><span class="sub">共 ${state.logs.length} 条记录</span></div>${state.logs.length?`<div class="records"><table><thead><tr><th>日期</th><th>活动</th><th>时长</th><th>体重</th><th>感受</th><th>备注</th></tr></thead><tbody>${[...state.logs].sort((a,b)=>b.date.localeCompare(a.date)).map(l=>`<tr><td>${l.date}</td><td>${esc(l.title)}</td><td>${l.minutes} 分钟</td><td>${l.weight??'—'}</td><td>${{good:'刚刚好',easy:'比较轻松',hard:'有些吃力'}[l.feeling]}</td><td style="white-space:normal;max-width:220px;overflow-wrap:anywhere">${esc(l.note)||'—'}</td></tr>`).join('')}</tbody></table></div>`:empty('下一条足迹，由你留下','完成训练后，给自己的努力一个记录。','')}</section>`;}
function chat(){return head('计划有疑问，就在这里聊。','围绕你当前的安排，解释计划与训练反馈。')+`<div class="columns"><section class="card chat-wrap"><div class="card-head"><h2>MoveMate 计划助手</h2><span class="badge">AI 计划助手</span></div><div class="messages" aria-live="polite"><div class="message"><small>MOVEMATE</small>你好！我可以解释当前计划、说明反馈如何改变训练时长，以及帮助你记录训练。想先了解哪一部分？</div>${state.messages.map(m=>`<div class="message ${m.role==='user'?'user':''}">${m.role==='assistant'?'<small>MOVEMATE · AI</small>':''}${esc(m.text)}</div>`).join('')}</div><div class="quick">${['为什么这样安排？','练得很累怎么调整？','怎么记录训练？'].map(q=>`<button data-question="${q}">${q}</button>`).join('')}</div><form class="chat-input" id="chat-form"><input id="question" name="question" aria-label="向计划助手提问" placeholder="问问关于计划的事…" maxlength="500" required><button class="primary">发送 ↗</button></form></section><aside class="card" style="align-self:start"><div class="eyebrow">A PLAN YOU UNDERSTAND</div><h2>了解安排，才能更好坚持。</h2><p class="note">${state.plan?esc(state.plan.explanation):'完成档案并生成计划后，助手会根据你的实际日程回答。'}</p><div class="insight section-gap"><b>回答从哪里来？</b><p>请求由本机后端发送给已配置的模型服务。回答由你配置的模型生成，结合当前训练安排与最近反馈。模型可能出错，请结合自身感受核对。</p></div><a class="source" href="${SOURCE}" target="_blank" rel="noopener">通用原则参考：WHO ↗</a></aside></div>`;}
function manage(){return head('数据由你掌握。','查看本机数据库中的真实数据，导出备份或清空记录。')+`<div class="notice">本地单用户体验版。此页管理本机数据库中的数据；多人账号、角色权限和云端知识检索属于后续服务端方案。</div><div class="admin-grid">${metric('档案',state.profile?1:0,'份','本机数据库中的个人档案','◎')}${metric('训练记录',state.logs.length,'条','所有已保存的训练','↗')}${metric('助手对话',state.messages.filter(m=>m.role==='user').length,'次','真实发送的提问','☏')}</div><div class="columns section-gap"><section class="card"><div class="card-head"><h2>我的运动笔记</h2><span class="badge">${state.knowledge.length} 条</span></div><p class="sub">手动管理备忘内容，笔记不会作为助手知识来源。</p><form id="knowledge-form" class="section-gap"><label class="field">笔记标题<input name="title" required maxlength="60" placeholder="比如：下次训练前记得热身"></label><label class="field section-gap">内容<textarea name="content" required maxlength="1000" rows="2"></textarea></label><button class="secondary section-gap">添加笔记 +</button></form>${state.knowledge.map(k=>`<div class="row-item"><div style="min-width:0;overflow-wrap:anywhere"><b>${esc(k.title)}</b><p>${esc(k.content)}</p></div><button data-delete-note="${k.id}" aria-label="删除笔记 ${esc(k.title)}">删除</button></div>`).join('')}</section><section class="card" style="align-self:start"><h2>备份与存储</h2><p class="note">训练数据与 API 配置保存在本机 SQLite 数据库。JSON 备份只导出训练资料，不包含 API Key。卸载程序文件不会自动删除数据库。</p><div class="actions section-gap"><button class="secondary" id="export">导出 JSON 备份 ↗</button><button class="secondary" id="clear">清空本地数据</button></div><h2 class="form-section">当前实现</h2><p class="note">✓ 档案校验与风险拦截<br>✓ 规则计划与反馈调整<br>✓ 真实打卡、统计与趋势<br>✓ 真实 AI 对话与笔记管理<br>✓ 数据导出与清空</p><p class="note">计划引擎：starter-v1<br>应用版本：3.2.0 · 无外部运行依赖</p></section></div>`;}
function render(){const page=location.hash.slice(1) in titles?location.hash.slice(1):'home';$('#crumb').textContent=titles[page];document.title=`${titles[page]} · MoveMate 跃动`;document.querySelectorAll('[data-page]').forEach(a=>a.classList.toggle('active',a.dataset.page===page));$('#date').textContent=new Date().toLocaleDateString('zh-CN',{month:'long',day:'numeric',weekday:'long'});$('#avatar').textContent=state.profile?.name?.slice(0,1)||'M';$('#main').innerHTML=(storageError?`<div class="error">${esc(storageError)}</div>`:'')+({home,profile,plan,record,chat,manage}[page])();bind();}
async function ask(q){
  if(!q.trim()||busy)return;
  if(!apiStatus.configured){pendingQuestion=q.trim();await openConfig('配置 API 后会自动发送刚才的问题。');return;}
  busy=true;const form=$('#chat-form');form.querySelector('button').disabled=true;form.querySelector('button').textContent='正在回答…';
  const pending=document.createElement('div');pending.className='message user';pending.textContent=q;$('.messages').append(pending);
  try{const result=await request('/api/chat',{question:q,revision});state=result.state;revision=result.revision;if(location.hash==='#chat'){render();const box=$('.messages');if(box)box.scrollTop=box.scrollHeight;$('#question')?.focus();}}
  catch(e){pending.remove();toast(e.message);}
  finally{busy=false;const btn=$('#chat-form button');if(btn){btn.disabled=false;btn.textContent='发送 ↗';}}
}
function bind(){
  $('#profile-form')?.addEventListener('submit',async e=>{e.preventDefault();const fd=new FormData(e.target);const p={name:String(fd.get('name')).trim(),notes:String(fd.get('notes')).trim(),goal:fd.get('goal'),place:fd.get('place'),level:fd.get('level'),risks:[0,1,2].map(i=>fd.has('risk'+i)),confirm:fd.has('confirm')};for(const k of ['age','height','weight','days','minutes'])p[k]=Number(fd.get(k));const result=generatePlan(p,[...state.logs].sort((a,b)=>a.date.localeCompare(b.date)));if(!result.ok){if(result.blocked)await save({...state,profile:p,plan:null});$('#form-error').textContent=result.errors.join(' ');$('#form-error').scrollIntoView({block:'center',behavior:'smooth'});return;}if(await save({...state,profile:p,plan:result.plan})){toast('你的本周计划已生成');go('plan');}});
  document.querySelectorAll('[data-log-date]').forEach(b=>b.onclick=()=>{logDate=b.dataset.logDate;go('record');});
  $('#log-date')?.addEventListener('change',e=>{$('[name=minutes]').value=state.plan.items.find(i=>i.date===e.target.value).minutes;});
  $('#log-form')?.addEventListener('submit',async e=>{e.preventDefault();if(!$('#log-date'))return;const fd=new FormData(e.target);const log={date:fd.get('date'),minutes:Number(fd.get('minutes')),weight:fd.get('weight')===''?null:Number(fd.get('weight')),feeling:fd.get('feeling'),note:String(fd.get('note')).trim(),planId:state.plan?.id};const error=validateLog(log,state.plan,state.logs);if(error){$('#log-error').textContent=error;return;}log.title=state.plan.items.find(i=>i.date===log.date).title;if(await save({...state,logs:[...state.logs,log]})){toast('训练已记录，每一步都算数');render();}});
  $('#chat-form')?.addEventListener('submit',async e=>{e.preventDefault();ask($('#question').value);});document.querySelectorAll('[data-question]').forEach(b=>b.onclick=()=>ask(b.dataset.question));
  $('#knowledge-form')?.addEventListener('submit',async e=>{e.preventDefault();const fd=new FormData(e.target),title=String(fd.get('title')).trim(),content=String(fd.get('content')).trim();if(!title||!content){toast('请填写标题和内容');return;}if(await save({...state,knowledge:[...state.knowledge,{id:crypto.randomUUID(),title,content}]})){render();toast('笔记已保存');}});
  document.querySelectorAll('[data-delete-note]').forEach(b=>b.onclick=async()=>{if(await save({...state,knowledge:state.knowledge.filter(k=>k.id!==b.dataset.deleteNote)})){render();toast('笔记已删除');}});
  $('#export')?.addEventListener('click',()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`movemate-${dayKey()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);});$('#clear')?.addEventListener('click',()=>$('#clear-dialog').showModal());
}
$('#cancel-clear').onclick=()=>$('#clear-dialog').close();$('#confirm-clear').onclick=async()=>{storageError='';if(await save(fresh())){$('#clear-dialog').close();render();toast('本地数据已清空');}};
window.addEventListener('hashchange',()=>{render();window.scrollTo(0,0);$('#main').focus();});


async function initialize(){
  $('#main').innerHTML='<section class="card"><h1>正在检查本机环境…</h1><p class="note">连接服务 · 检查数据库 · 检查 API 配置</p></section>';
  try{
    token=(await (await fetch('/api/bootstrap')).json()).token;
    apiStatus=await request('/api/health');
    if(!apiStatus.ok)throw new Error('数据库检查未通过');
    const snapshot=await request('/api/state');state=snapshot.state;revision=snapshot.revision;backendReady=true;
    render();updateStatus();
    if(!apiStatus.configured)await openConfig('本机服务与数据库正常。配置 API 后即可使用 AI 助手。');
    else {
      $('#service-status').textContent='正在检查模型连接…';
      const config=(await request('/api/config')).config;
      try{await request('/api/config/test',{...config,api_key:''});$('#service-status').textContent='服务正常 · AI 已连接';}
      catch(e){$('#service-status').textContent='服务正常 · API 连接异常';await openConfig(e.message);}
    }
    // Preserve existing browser data without silently copying health records.
    if(!state.profile&&state.logs.length===0&&(()=>{try{return !!localStorage.getItem(KEY);}catch{return false;}})()){
      $('#migration-banner').hidden=false;
    }
  }catch(e){storageError=e.message;render();$('#service-status').textContent='本机服务异常';}
}
function updateStatus(){ $('#service-status').textContent=apiStatus.configured?`本机服务正常 · ${apiStatus.model}`:'本机服务正常 · 待配置 API'; }
let configData={},configFormats={},pendingQuestion='';
function keyPlaceholder(format){
  if(format==='ollama')return '本机 Ollama 无需密钥';
  if(format==='deepseek')return 'sk-…（在 DeepSeek 开放平台创建）';
  return '填写服务商提供的 API Key';
}
function formatMeta(format){
  const meta=configFormats[format]||{};
  $('#model-options').innerHTML=(meta.models||[]).map(m=>`<option value="${esc(m)}"></option>`).join('');
  $('#api-key').placeholder=keyPlaceholder(format);
  const hint=$('#provider-hint');
  if(format==='deepseek'){
    hint.innerHTML=`DeepSeek 官方 API：地址已预填，模型可选 <b>deepseek-chat</b>（通用）或 <b>deepseek-reasoner</b>（推理更慢）。<a class="source" href="${esc(meta.key_url||'https://platform.deepseek.com/api_keys')}" target="_blank" rel="noopener">获取 API Key ↗</a>`;
  }else if(format==='ollama'){
    hint.textContent='Ollama 在本机运行，不需要 API Key；请先启动 Ollama 并准备模型。';
  }else{
    hint.textContent='模型 ID 与 API Key 由所选服务商提供；第三方中转需选择它实际支持的请求格式。';
  }
}
function applyFormat(format){
  const meta=configFormats[format]||{};
  $('#api-base').value=meta.base_url||'';
  $('#api-model').value=meta.default_model||'';
  $('#api-key').value='';
  $('#api-key').required=format!=='ollama';
  formatMeta(format);
}
async function openConfig(message=''){
  try{
    const result=await request('/api/config');configData=result.config;configFormats=result.formats;
    const select=$('#api-format');select.innerHTML=Object.entries(configFormats).map(([value,v])=>`<option value="${value}">${esc(v.name)}</option>`).join('');
    const selected=configFormats[configData.format]?configData.format:'deepseek';
    select.value=selected;
    const meta=configFormats[selected]||{};
    $('#api-base').value=configData.base_url||meta.base_url||'';
    $('#api-model').value=configData.model||meta.default_model||'';
    $('#api-key').value='';
    $('#api-key').required=selected!=='ollama'&&!result.has_key;
    $('#config-status').textContent=message;$('#config-status').className='notice';
    formatMeta(selected);
    $('#api-key').placeholder=result.has_key?'已保存密钥；留空保留（地址不变时）':keyPlaceholder(selected);
    select.onchange=()=>{applyFormat(select.value);$('#config-status').textContent='已切换格式，请确认模型并填写密钥。';};
    if(!$('#api-dialog').open)$('#api-dialog').showModal();
  }catch(e){toast(e.message);}
}
function configValues(){return {format:$('#api-format').value,base_url:$('#api-base').value.trim(),model:$('#api-model').value.trim(),api_key:$('#api-key').value.trim()};}
async function checkConfig(saveIt){
  const form=$('#api-form');if(!form.reportValidity())return;
  const buttons=[...form.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);$('#config-status').textContent='正在连接模型，请稍候…';
  try{
    const values=configValues();const result=await request('/api/config/test',values);
    $('#config-status').textContent='连接成功：'+result.reply;
    if(saveIt){await request('/api/config/save',values);apiStatus=await request('/api/health');updateStatus();$('#api-key').value='';$('#api-dialog').close();toast('API 配置已保存，AI 助手可以使用了');render();const queued=pendingQuestion;pendingQuestion='';if(queued)ask(queued);}
  }catch(e){$('#config-status').textContent=e.message;$('#config-status').className='error';}
  finally{buttons.forEach(b=>b.disabled=false);}
}
$('#api-settings').onclick=()=>openConfig();$('#config-close').onclick=()=>{$('#api-key').value='';pendingQuestion='';$('#api-dialog').close();};
$('#api-test').onclick=()=>checkConfig(false);$('#api-form').onsubmit=e=>{e.preventDefault();checkConfig(true);};
$('#config-import').onclick=()=>{
  try{const c=JSON.parse($('#config-json').value);if(!configFormats[c.format])throw Error();$('#api-format').value=c.format;$('#api-base').value=c.base_url||configFormats[c.format].base_url||'';$('#api-model').value=c.model||configFormats[c.format].default_model||'';$('#api-key').value=c.api_key||'';$('#api-key').required=c.format!=='ollama';formatMeta(c.format);$('#config-json').value='';$('#config-status').textContent='配置已填入，点击“测试并启用”。';}
  catch{$('#config-status').textContent='JSON 格式无效，需要有效的 format、base_url、model 和 api_key 字段。';}
};
$('#migrate-data').onclick=async()=>{try{const old=JSON.parse(localStorage.getItem(KEY));if(await save(old)){$('#migration-banner').hidden=true;render();toast('旧版数据已迁入本机数据库，浏览器原数据保留');}}catch{toast('旧版数据格式异常，无法迁入。');}};

await initialize();
