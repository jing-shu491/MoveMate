/* Pure domain functions; usable in browsers and Node. */
export const SOURCE = 'https://www.who.int/news-room/fact-sheets/detail/physical-activity';
export function dayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
export function weekStart(date = new Date()) {
  const d = new Date(date); d.setHours(0,0,0,0); d.setDate(d.getDate() - (d.getDay()+6)%7); return d;
}
export function dateAt(start, offset) { const d = new Date(start); d.setDate(d.getDate()+offset); return dayKey(d); }
export function validateProfile(p) {
  const errors = [];
  if (!p.name?.trim() || p.name.length > 30) errors.push('请填写 1–30 字的称呼。');
  for (const [key,min,max,label] of [['age',18,64,'年龄'],['height',100,230,'身高'],['weight',30,250,'体重'],['minutes',10,60,'单次时长'],['days',2,5,'每周训练天数']]) {
    if (!Number.isFinite(p[key]) || p[key]<min || p[key]>max) errors.push(`${label}需在 ${min}–${max} 范围内。`);
  }
  if (!Number.isInteger(p.age) || !Number.isInteger(p.days)) errors.push('年龄和训练天数需为整数。');
  if (!['habit','fitness','strength'].includes(p.goal) || !['home','outdoor'].includes(p.place) || !['beginner','regular'].includes(p.level)) errors.push('请选择有效的训练偏好。');
  if (!Array.isArray(p.risks) || p.risks.length !== 3 || !p.risks.every(x=>typeof x==='boolean') || typeof p.confirm!=='boolean') errors.push('请完成风险确认。');
  return errors;
}
export function generatePlan(p, feedback = [], now = new Date()) {
  const errors = validateProfile(p); if (errors.length) return {ok:false, errors};
  if (!p.confirm) return {ok:false, errors:['请先确认已阅读适用范围。']};
  if (p.risks.some(Boolean) || p.notes?.trim()) return {ok:false, blocked:true, errors:['你的回答包含健康风险或伤病情况。已暂停自动生成，请先向合格的医疗或运动专业人员确认适合的活动。']};
  const recent = feedback.slice(-3);
  const lighter = recent.some(l=>l.feeling==='hard');
  const duration = Math.max(10, Math.min(p.minutes,p.level==='beginner'?30:60)-(lighter?5:0));
  const schedule = {2:[0,3],3:[0,2,4],4:[0,1,3,5],5:[0,1,3,4,5]}[p.days];
  const start = weekStart(now);
  const items = Array.from({length:7},(_,i)=>{
    const index = schedule.indexOf(i), rest = index<0;
    const strength = !rest && (p.goal==='strength' ? index%3!==2 : index%2===1);
    return {date:dateAt(start,i), rest, type:rest?'恢复':strength?'基础力量':'有氧活动', title:rest?'留一点时间，给恢复':strength?'全身基础力量':p.place==='outdoor'?'户外步行':'室内轻活动', minutes:rest?0:duration,
      steps:rest?['按自己的状态休息，保持日常活动。']:strength?['准备活动：原地慢走与关节活动','主训练：坐站、靠墙俯卧撑、站姿提踵；在舒适范围内交替练习，动作间休息','结束活动：逐步放慢，轻松走动']:['准备活动：轻松慢走','主训练：以能够交谈的节奏步行，可分段完成','结束活动：逐步放慢，轻松走动']};
  });
  return {ok:true, plan:{id:now.toISOString(),start:dayKey(start),createdAt:now.toISOString(), profile:{...p,risks:[...p.risks]}, items, lighter, rule:'starter-v1', explanation: `${p.days} 天训练 · 每次 ${duration} 分钟 · ${p.place==='home'?'居家':'户外'}。${p.level==='beginner'?'新手版单次最多 30 分钟。':''}${lighter?'最近记录了训练吃力，本次安排缩短 5 分钟。':'按当前可用时间安排，先建立规律。'}力量与有氧按目标交替，训练日之间安排恢复。具体动作和时长为项目入门模板。`}};
}
export function validateLog(log, plan, logs, today=dayKey()) {
  if (!plan || !plan.items.some(i=>i.date===log.date&&!i.rest)) return '请选择本计划中的训练日。';
  if (log.date>today) return '未来的训练还不能打卡。';
  if (logs.some(l=>l.date===log.date)) return '这一天已经记录过训练。';
  if (!Number.isFinite(log.minutes) || log.minutes<1 || log.minutes>180) return '实际训练时长需在 1–180 分钟之间。';
  if (log.weight!==null && (!Number.isFinite(log.weight)||log.weight<30||log.weight>250)) return '体重需在 30–250 kg 之间，或留空。';
  if (!['easy','good','hard'].includes(log.feeling)) return '请选择训练感受。';
  if (typeof log.note!=='string'||log.note.length>300) return '备注最多 300 字。';
  return '';
}
export function stats(logs, plan, now=new Date()) {
  const start=dayKey(weekStart(now)), end=dateAt(weekStart(now),6);
  const week=logs.filter(l=>l.date>=start&&l.date<=end);
  const total=week.reduce((s,l)=>s+l.minutes,0);
  const count=week.length, target=plan?.start===start?plan.items.filter(i=>!i.rest).length:0;
  let streak=0; const dates=new Set(logs.map(l=>l.date)), d=new Date(now);
  if(!dates.has(dayKey(d))) d.setDate(d.getDate()-1);
  while(dates.has(dayKey(d))) {streak++; d.setDate(d.getDate()-1);}
  return {count,total,target,streak,percent:target?Math.min(100,Math.round(count/target*100)):0};
}
