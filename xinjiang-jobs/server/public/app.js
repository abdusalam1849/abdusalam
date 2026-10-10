// server/public/app.js
// 多视图 SPA 渲染逻辑：岗位 / 筛选 / 看板 / 资讯 / 我的

// ============ 工具函数 ============
function esc(s){if(s==null)return'';return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function fmtTime(ts){if(!ts)return'未知';const d=new Date(ts);const p=n=>String(n).padStart(2,'0');return`${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`}
function ago(ts){if(!ts)return'';const diff=Date.now()-ts;const m=Math.floor(diff/60000);if(m<1)return'刚刚';if(m<60)return m+' 分钟前';const h=Math.floor(m/60);if(h<24)return h+' 小时前';const d=Math.floor(h/24);if(d<30)return d+' 天前';return new Date(ts).toLocaleDateString('zh-CN')}
function $(id){return document.getElementById(id)}
function saveLS(k,v){try{localStorage.setItem('xj_'+k,JSON.stringify(v))}catch(e){}}
function loadLS(k){try{return JSON.parse(localStorage.getItem('xj_'+k)||'null')}catch(e){return null}}

// ============ 数据请求 ============
async function fetchJSON(path){
  const res=await fetch(API+path);
  const j=await res.json();
  if(j.code!==0)throw new Error(j.msg||'请求失败');
  return j.data;
}
async function fetchJobs(params){
  const q=new URLSearchParams();
  Object.keys(params).forEach(k=>{if(params[k]!==''&&params[k]!=null)q.set(k,params[k])});
  q.set('pageSize','100');
  return fetchJSON('/api/jobs/list?'+q.toString());
}
async function fetchStats(){return fetchJSON('/api/stats/overview')}
async function fetchCities(){return fetchJSON('/api/jobs/cities/list')}
async function fetchStatus(){return fetchJSON('/api/system/status')}
async function fetchNews(params){const q=new URLSearchParams({pageSize:'50'});Object.keys(params||{}).forEach(k=>{if(params[k]!==''&&params[k]!=null)q.set(k,params[k])});return fetchJSON('/api/news/list?'+q.toString())}
async function fetchNewsCats(){return fetchJSON('/api/news/categories')}
async function fetchNewsDetail(id){return fetchJSON('/api/news/'+id)}
async function fetchJobDetail(id){return fetchJSON('/api/jobs/'+id)}
async function postSubscribe(data){
  const res=await fetch(API+'/api/subscribe',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)});
  return res.json();
}

// ============ 视图切换 ============
function switchView(v){
  store.view=v;
  document.querySelectorAll('.tabbar .tab').forEach(t=>t.classList.toggle('active',t.dataset.v===v));
  render();
  window.scrollTo(0,0);
  $('floatBtn').classList.remove('show');
}

// ============ 主渲染 ============
function render(){
  const c=$('content');
  if(store.view==='jobs')c.innerHTML=viewJobs();
  else if(store.view==='filter')c.innerHTML=viewFilter();
  else if(store.view==='board')c.innerHTML=viewBoard();
  else if(store.view==='news')c.innerHTML=viewNews();
  else if(store.view==='me')c.innerHTML=viewMe();

  // 异步数据填充
  if(store.view==='jobs')loadJobsView();
  else if(store.view==='filter')loadFilterView();
  else if(store.view==='board')loadBoardView();
  else if(store.view==='news')loadNewsView();
  else if(store.view==='me')loadMeView();

  // 顶部副标题随视图变化
  const subs={jobs:'疆内岗位每日实时更新',filter:'多维度筛选精准匹配',board:'数据看板 · 岗位全景',news:'招聘资讯 · 政策指南',me:'个人中心'};
  $('topSub').textContent=subs[store.view]||'';
}

// ============ 岗位视图 ============
function viewJobs(){
  const cats=CATS.map(c=>`<div class="ct ${store.cat===c.k?'active':''}" onclick="setCat('${c.k}')">${c.n}</div>`).join('');
  return `
    <div class="searchbar">
      <input id="kwInput" type="text" placeholder="搜索职位/公司/关键词" onkeydown="if(event.key==='Enter')doSearch()">
      <button onclick="doSearch()">搜索</button>
    </div>
    <div class="tabs">${cats}</div>
    <div class="statusbar">
      <span id="lastUpdate">加载中...</span>
      <span class="refresh-tip" onclick="loadJobsView(true)">↓ 刷新</span>
    </div>
    <div class="job-list" id="jobList"><div class="loading">加载中...</div></div>
    <div class="muted" id="jobsFooter" style="text-align:center;padding:14px 0;display:none"></div>
  `;
}
function setCat(k){store.cat=k;render()}
function doSearch(){
  const kw=$('kwInput').value.trim();
  store._searchKw=kw;
  loadJobsView(false,kw);
}
async function loadJobsView(refresh,kw){
  const listEl=$('jobList');
  if(!listEl)return;
  listEl.innerHTML='<div class="loading">加载中...</div>';
  try{
    const kw2=kw!==undefined?kw:store._searchKw;
    const data=await fetchJobs({keyword:kw2||''});
    store.jobs=data.list;store.total=data.total;store.lastUpdateAt=data.lastUpdateAt;
    $('lastUpdate').textContent='更新于 '+fmtTime(data.lastUpdateAt);
    renderJobList(filterByCat(data.list));
  }catch(e){
    listEl.innerHTML='<div class="empty">加载失败：'+esc(e.message)+'<br><br>请确认后端服务已启动</div>';
  }
}
function filterByCat(list){
  const now=Date.now()-7*86400000;
  switch(store.cat){
    case 'new':return list.filter(j=>(j.created_at||0)>=now).sort((a,b)=>(b.created_at||0)-(a.created_at||0));
    case 'hot':return list.slice().sort((a,b)=>(b.welfare?b.welfare.length:0)-(a.welfare?a.welfare.length:0));
    case 'fulltime':return list.filter(j=>(j.job_type||'')==='全职');
    case 'parttime':return list.filter(j=>(j.job_type||'')==='兼职');
    case 'intern':return list.filter(j=>(j.job_type||'')==='实习');
    default:return list;
  }
}
function renderJobList(list){
  const listEl=$('jobList');
  const footEl=$('jobsFooter');
  if(!list.length){listEl.innerHTML='<div class="empty">暂无匹配岗位，下拉刷新试试</div>';footEl.style.display='none';return}
  listEl.innerHTML=list.map(j=>`
    <div class="card" onclick="openDetail(${j.id})">
      <div class="jh"><div class="t">${esc(j.title)}</div><div class="s">${esc(j.salary||'面议')}</div></div>
      <div class="jc">${esc(j.company)}</div>
      <div class="jm">${esc(j.city)}${j.district?' · '+esc(j.district):''} · ${esc(j.experience||'不限')} · ${esc(j.education||'不限')}</div>
      <div class="tags">${(j.welfare||[]).map(w=>`<span class="tag">${esc(w)}</span>`).join('')}</div>
      <div class="jf"><span class="muted">${ago(j.created_at)}</span><span class="badge">${esc(j.source)}</span></div>
    </div>
  `).join('');
  footEl.style.display='block';
  footEl.textContent='共 '+list.length+' 条岗位（实时数据来自后端 API）';
}

// ============ 筛选视图 ============
function viewFilter(){
  const cities=store.cities.map(c=>`<div class="chip" data-city="${esc(c.city)}" onclick="toggleCity(this)">${esc(c.city)} <span class="muted">(${c.c})</span></div>`).join('');
  return `
    <div class="section">
      <div class="h">城市 <span class="more">单选</span></div>
      <div class="chips" id="cityChips">${cities||'<div class="muted">加载中...</div>'}</div>
    </div>
    <div class="section">
      <div class="h">岗位类型</div>
      <div class="chips">
        <div class="chip" data-type="全职" onclick="toggleFilter(this,'job_type')">全职</div>
        <div class="chip" data-type="兼职" onclick="toggleFilter(this,'job_type')">兼职</div>
        <div class="chip" data-type="实习" onclick="toggleFilter(this,'job_type')">实习</div>
      </div>
    </div>
    <div class="section">
      <div class="h">学历要求</div>
      <div class="chips" id="eduChips"></div>
    </div>
    <div class="section">
      <div class="h">经验要求</div>
      <div class="chips" id="expChips"></div>
    </div>
    <div class="section">
      <div class="h">薪资区间（K）</div>
      <div class="filter-grid">
        <div class="f"><div class="lbl">下限</div><input id="salMin" type="number" placeholder="0" style="width:100%;border:1px solid var(--line);border-radius:8px;padding:8px;font-size:14px"></div>
        <div class="f"><div class="lbl">上限</div><input id="salMax" type="number" placeholder="50" style="width:100%;border:1px solid var(--line);border-radius:8px;padding:8px;font-size:14px"></div>
      </div>
    </div>
    <div style="padding:14px 12px;display:flex;gap:10px">
      <button class="btn outline" style="flex:1;background:#fff;color:var(--primary);border:1px solid var(--primary);border-radius:24px;padding:12px;font-size:14px;cursor:pointer" onclick="resetFilter()">重置</button>
      <button class="btn" style="flex:1;border:none;border-radius:24px;padding:12px;font-size:14px;cursor:pointer;background:var(--primary);color:#fff" onclick="applyFilter()">应用筛选</button>
    </div>
    <div class="section" id="filterResult" style="display:none"><div class="h">筛选结果</div><div class="job-list" id="filterList"></div></div>
  `;
}
let filterState={city:'',job_type:'',education:'',experience:''};
async function loadFilterView(){
  if(!store.cities.length){try{store.cities=await fetchCities();render()}catch(e){}}
  const s=store.stats||await fetchStats().catch(()=>null);
  if(s){
    const eduChips=$('eduChips');if(eduChips)eduChips.innerHTML=s.educations.map(e=>`<div class="chip" data-edu="${esc(e.label)}" onclick="toggleFilter(this,'education')">${esc(e.label)} <span class="muted">(${e.count})</span></div>`).join('')||'<div class="muted">无</div>';
    const expChips=$('expChips');if(expChips)expChips.innerHTML=s.experiences.map(e=>`<div class="chip" data-exp="${esc(e.label)}" onclick="toggleFilter(this,'experience')">${esc(e.label)} <span class="muted">(${e.count})</span></div>`).join('')||'<div class="muted">无</div>';
  }
}
function toggleCity(el){
  el.parentNode.querySelectorAll('.chip').forEach(c=>c.classList.remove('active'));
  el.classList.add('active');
  filterState.city=el.dataset.city;
}
function toggleFilter(el,key){
  const wasActive=el.classList.contains('active');
  el.parentNode.querySelectorAll('.chip').forEach(c=>c.classList.remove('active'));
  if(wasActive){filterState[key]='';return}
  el.classList.add('active');
  filterState[key]=el.dataset[key];
}
function resetFilter(){
  filterState={city:'',job_type:'',education:'',experience:''};
  document.querySelectorAll('.chips .chip').forEach(c=>c.classList.remove('active'));
  $('salMin').value='';$('salMax').value='';
  const r=$('filterResult');if(r)r.style.display='none';
}
async function applyFilter(){
  const min=$('salMin').value;const max=$('salMax').value;
  const r=$('filterResult');r.style.display='block';
  const listEl=$('filterList');
  listEl.innerHTML='<div class="loading">查询中...</div>';
  try{
    const data=await fetchJobs({keyword:'',city:filterState.city,job_type:filterState.job_type});
    let list=data.list;
    if(filterState.education)list=list.filter(j=>j.education===filterState.education);
    if(filterState.experience)list=list.filter(j=>j.experience===filterState.experience);
    const lo=parseFloat(min)||0;const hi=parseFloat(max)||Infinity;
    list=list.filter(j=>{const v=parseSal(j.salary);return v>=lo&&v<=hi});
    if(!list.length){listEl.innerHTML='<div class="empty">无匹配岗位</div>';return}
    listEl.innerHTML=list.map(j=>`<div class="card" onclick="openDetail(${j.id})" style="margin:8px 0"><div class="jh"><div class="t">${esc(j.title)}</div><div class="s">${esc(j.salary||'面议')}</div></div><div class="jc">${esc(j.company)}</div><div class="jm">${esc(j.city)}${j.district?' · '+esc(j.district):''}</div></div>`).join('');
  }catch(e){listEl.innerHTML='<div class="empty">查询失败</div>'}
}
function parseSal(s){if(!s)return 0;const m=String(s).match(/(\d+(?:\.\d+)?)/);return m?parseFloat(m[1]):0}

// ============ 数据看板视图 ============
function viewBoard(){
  return `
    <div id="boardStats" class="loading">加载中...</div>
  `;
}
async function loadBoardView(){
  const el=$('boardStats');if(!el)return;
  el.innerHTML='<div class="loading">统计中...</div>';
  try{
    const s=await fetchStats();store.stats=s;
    el.innerHTML=renderBoard(s);
  }catch(e){el.innerHTML='<div class="empty">加载失败：'+esc(e.message)+'</div>'}
}
function renderBoard(s){
  const todayCount=s.trend[s.trend.length-1].count;
  const weekCount=s.trend.slice(-7).reduce((a,b)=>a+b.count,0);
  let html=`
    <div class="stat-grid" style="margin:10px 12px">
      <div class="sc"><div class="n">${s.total}</div><div class="l">在库岗位</div></div>
      <div class="sc alt"><div class="n">${todayCount}</div><div class="l">今日新增</div></div>
      <div class="sc alt2"><div class="n">${weekCount}</div><div class="l">本周新增</div></div>
    </div>`;
  // 趋势柱状图
  const maxT=Math.max(1,...s.trend.map(t=>t.count));
  html+=`<div class="section"><div class="h">近 14 天新增趋势</div>
    <div class="bar-chart">${s.trend.map(t=>`<div class="bar" style="height:${t.count/maxT*100}%" title="${t.date}: ${t.count}">${t.count?`<div class="v">${t.count}</div>`:''}</div>`).join('')}</div>
    <div style="display:flex;gap:4px;margin-top:6px">${s.trend.filter((_,i)=>i%2===0).map(t=>`<div style="flex:1;text-align:center;font-size:9px;color:var(--muted)">${t.date.slice(5)}</div>`).join('')}</div>
  </div>`;
  // 城市分布
  if(s.cities.length){
    const maxC=s.cities[0].count;
    html+=`<div class="section"><div class="h">城市分布 <span class="more">Top ${Math.min(10,s.cities.length)}</span></div>
      ${s.cities.slice(0,10).map(c=>`<div class="hbar"><div class="name">${esc(c.label)}</div><div class="track"><div class="fill" style="width:${c.count/maxC*100}%"></div></div><div class="val">${c.count}</div></div>`).join('')}
    </div>`;
  }
  // 薪资分布
  if(s.salaryBuckets.some(b=>b.count)){
    const maxB=Math.max(...s.salaryBuckets.map(b=>b.count),1);
    html+=`<div class="section"><div class="h">薪资区间分布</div>
      <div class="bar-chart">${s.salaryBuckets.map(b=>`<div class="bar" style="height:${b.count/maxB*100}%;background:linear-gradient(180deg,#ff9800,#ffb74d)">${b.count?`<div class="v">${b.count}</div>`:''}</div>`).join('')}</div>
      <div style="display:flex;gap:4px;margin-top:6px">${s.salaryBuckets.map(b=>`<div style="flex:1;text-align:center;font-size:9px;color:var(--muted)">${b.label}</div>`).join('')}</div>
    </div>`;
  }
  // 类型 + 学历 双列
  html+=`<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:0 12px">`;
  html+=`<div class="section"><div class="h">岗位类型</div>${pieAndLegend(s.jobTypes,['#1e90ff','#43c59d','#ff9800','#9c27b0','#607d8b'])}</div>`;
  html+=`<div class="section"><div class="h">学历要求</div>${pieAndLegend(s.educations,['#1e90ff','#43c59d','#ff9800','#9c27b0','#607d8b','#e91e63'])}</div>`;
  html+=`</div>`;
  // 经验
  if(s.experiences.length){
    const maxE=Math.max(...s.experiences.map(e=>e.count),1);
    html+=`<div class="section"><div class="h">经验要求</div>
      ${s.experiences.map(e=>`<div class="hbar"><div class="name" style="width:70px">${esc(e.label)}</div><div class="track"><div class="fill" style="width:${e.count/maxE*100}%;background:linear-gradient(90deg,#43c59d,#7fc4ff)"></div></div><div class="val">${e.count}</div></div>`).join('')}
    </div>`;
  }
  // 来源
  if(s.sources.length){
    html+=`<div class="section"><div class="h">数据来源</div>
      ${s.sources.map(src=>`<div class="hbar"><div class="name">${esc(src.label)}</div><div class="track"><div class="fill" style="width:${src.count/Math.max(...s.sources.map(x=>x.count),1)*100}%;background:linear-gradient(90deg,#9c27b0,#ba68c8)"></div></div><div class="val">${src.count}</div></div>`).join('')}
    </div>`;
  }
  // 热门关键词
  if(s.hotKeywords.length){
    html+=`<div class="section"><div class="h">热门关键词</div><div class="tags" style="margin-top:4px">
      ${s.hotKeywords.map(k=>`<span class="tag" style="font-size:${10+Math.min(k.count,8)}px;padding:3px 10px">${esc(k.word)}</span>`).join('')}
    </div></div>`;
  }
  html+=`<div class="muted" style="text-align:center;padding:14px 0">数据更新于 ${fmtTime(s.lastUpdateAt)}</div>`;
  return html;
}
// 简易环形图 + 图例
function pieAndLegend(items,colors){
  if(!items.length)return'<div class="muted">无数据</div>';
  const total=items.reduce((a,b)=>a+b.count,0)||1;
  let acc=0;const r=40;const cx=50;const cy=50;
  let arcs='';
  items.forEach((it,i)=>{
    const frac=it.count/total;
    if(frac<=0)return;
    const a0=acc*Math.PI*2;acc+=frac;const a1=acc*Math.PI*2;
    const x0=cx+r*Math.sin(a0),y0=cy-r*Math.cos(a0);
    const x1=cx+r*Math.sin(a1),y1=cy-r*Math.cos(a1);
    const large=frac>0.5?1:0;
    const c=colors[i%colors.length];
    arcs+=`<path d="M${cx},${cy} L${x0},${y0} A${r},${r} 0 ${large} 1 ${x1},${y1} Z" fill="${c}"/>`;
  });
  const legend=items.map((it,i)=>`<div class="li"><span class="dot" style="background:${colors[i%colors.length]}"></span>${esc(it.label)} <span class="muted">${it.count}</span></div>`).join('');
  return `<div class="donut-wrap"><svg width="100" height="100" viewBox="0 0 100 100">${arcs}<circle cx="50" cy="50" r="22" fill="#fff"/><text x="50" y="48" text-anchor="middle" font-size="14" font-weight="600">${total}</text><text x="50" y="62" text-anchor="middle" font-size="8" fill="#8a8f99">总计</text></svg><div class="legend">${legend}</div></div>`;
}

// ============ 资讯视图 ============
function viewNews(){
  // 分类首项固定「全部」，其余从抓取数据动态生成；首次进入未加载时显示全部
  const cats=['全部','招考','政策','活动','攻略'];
  return `
    <div class="tabs">${cats.map(c=>`<div class="ct ${store._newsCat===c||(!store._newsCat&&c==='全部')?'active':''}" onclick="setNewsCat('${c}')">${c}</div>`).join('')}</div>
    <div class="section" id="newsList"><div class="loading">加载中...</div></div>
  `;
}
function setNewsCat(c){store._newsCat=c;render()}
async function loadNewsView(){
  const listEl=$('newsList');if(!listEl)return;
  listEl.innerHTML='<div class="loading">加载中...</div>';
  try{
    const data=await fetchNews({cat:store._newsCat||''});
    listEl.innerHTML=renderNewsItems(data.list);
  }catch(e){listEl.innerHTML='<div class="empty">加载失败：'+esc(e.message)+'</div>'}
}
function renderNewsItems(list){
  if(!list.length)return'<div class="empty">暂无此类资讯</div>';
  return list.map(n=>`
    <div class="news-item" onclick="openNews(${n.id})">
      <div class="nt"><span class="tag" style="background:#fff3e0;color:#ff9800;margin-right:6px">${esc(n.cat)}</span>${esc(n.title)}</div>
      <div class="nm"><span>${esc(n.src)}</span><span>${n.date}</span></div>
    </div>
  `).join('');
}
async function openNews(id){
  const body=$('modalBody');
  body.innerHTML='<div style="text-align:center;padding:40px">加载中...</div>';
  $('modal').classList.add('show');
  try{
    const n=await fetchNewsDetail(id);
    body.innerHTML=`<span class="close" onclick="closeModal()">×</span>
      <h2>${esc(n.title)}</h2>
      <div class="meta">${esc(n.src)} · ${n.date} · ${esc(n.cat)}</div>
      <div class="st">摘要</div>
      <div class="desc">${esc(n.summary)}</div>
      ${n.content?`<div class="st">正文</div><div class="desc">${esc(n.content)}</div>`:''}
      <div class="desc" style="margin-top:10px;color:var(--muted);font-size:13px">${n.url?'原文链接：'+esc(n.url):'（资讯来自公共就业服务抓取，更多内容请关注来源平台）'}</div>
      <div class="actions"><button class="btn outline" onclick="closeModal()">关闭</button>${n.url?`<button class="btn" onclick="copyText('${esc(n.url)}')">复制链接</button>`:''}</div>`;
  }catch(e){body.innerHTML='<div class="empty">加载失败</div>'}
}

// ============ 我的视图 ============
function viewMe(){
  const hist=loadLS('history')||[];
  const favs=loadLS('favs')||[];
  const sub=loadLS('sub')||null;
  return `
    <div class="me-header">
      <div class="avatar">👤</div>
      <div style="font-size:16px;font-weight:600">${sub?'已订阅用户':'游客'}</div>
      <div class="muted" style="color:rgba(255,255,255,.8);margin-top:4px">${sub?esc(sub.keywords||'')+(sub.city?' · '+esc(sub.city):''):'未设置订阅偏好'}</div>
    </div>
    <div class="section">
      <div class="h">我的订阅</div>
      ${sub?`<div class="line" style="font-size:14px;padding:4px 0">关键词：${esc(sub.keywords||'未设置')}</div><div class="line" style="font-size:14px;padding:4px 0">城市：${esc(sub.city||'未设置')}</div><button class="btn outline" style="margin-top:10px;width:100%;border:1px solid var(--primary);background:#fff;color:var(--primary);border-radius:24px;padding:10px;font-size:14px;cursor:pointer" onclick="openSubscribe()">修改订阅</button>`:`<div class="muted" style="padding:8px 0">尚未订阅，订阅后每日推送匹配岗位</div><button class="btn" style="width:100%;border:none;border-radius:24px;padding:10px;font-size:14px;cursor:pointer;background:var(--primary);color:#fff" onclick="openSubscribe()">立即订阅</button>`}
    </div>
    <div class="section">
      <div class="h">我的收藏 <span class="more">${favs.length} 个</span></div>
      ${favs.length?favs.map(j=>`<div class="news-item" onclick="openDetail(${j.id})"><div class="nt">${esc(j.title)}</div><div class="nm"><span>${esc(j.company)}</span><span>${esc(j.salary)}</span></div></div>`).join(''):'<div class="muted" style="padding:8px 0">暂无收藏，详情页可收藏岗位</div>'}
    </div>
    <div class="section">
      <div class="h">浏览历史 <span class="more">${hist.length} 条</span></div>
      ${hist.length?hist.slice(-5).reverse().map(j=>`<div class="news-item" onclick="openDetail(${j.id})"><div class="nt">${esc(j.title)}</div><div class="nm"><span>${esc(j.company)}</span><span>${ago(j.ts)}</span></div></div>`).join(''):'<div class="muted" style="padding:8px 0">暂无浏览记录</div>'}
    </div>
    <div class="section">
      <div class="menu-item" onclick="switchView('board')"><div class="ml"><span class="ic">📊</span><span class="tx">数据看板</span></div><span class="ar">›</span></div>
      <div class="menu-item" onclick="loadJobsView(true);switchView('jobs')"><div class="ml"><span class="ic">🔄</span><span class="tx">手动刷新数据</span></div><span class="ar">›</span></div>
      <div class="menu-item" onclick="triggerCrawl()"><div class="ml"><span class="ic">⚡</span><span class="tx">触发后端抓取</span></div><span class="ar">›</span></div>
      <div class="menu-item" onclick="clearLocal()"><div class="ml"><span class="ic">🗑️</span><span class="tx">清空本地缓存</span></div><span class="ar">›</span></div>
      <div class="menu-item" onclick="aboutApp()"><div class="ml"><span class="ic">ℹ️</span><span class="tx">关于</span></div><span class="ar">›</span></div>
    </div>
  `;
}
function loadMeView(){}
function openSubscribe(){
  const sub=loadLS('sub')||{keywords:'',city:''};
  const body=$('modalBody');
  body.innerHTML=`<span class="close" onclick="closeModal()">×</span>
    <h2>订阅岗位推送</h2>
    <div class="meta">设置关键词与城市，每日 08:00 自动推送匹配岗位</div>
    <div class="st">关键词（逗号分隔）</div>
    <input id="subKw" type="text" value="${esc(sub.keywords||'')}" placeholder="如：会计,教师,前端" style="width:100%;border:1px solid var(--line);border-radius:8px;padding:10px;font-size:14px;margin-bottom:12px">
    <div class="st">城市</div>
    <input id="subCity" type="text" value="${esc(sub.city||'')}" placeholder="如：乌鲁木齐" style="width:100%;border:1px solid var(--line);border-radius:8px;padding:10px;font-size:14px;margin-bottom:12px">
    <div class="actions"><button class="btn outline" onclick="closeModal()">取消</button><button class="btn" onclick="saveSubscribe()">保存订阅</button></div>`;
  $('modal').classList.add('show');
}
async function saveSubscribe(){
  const kw=$('subKw').value.trim();const city=$('subCity').value.trim();
  if(!kw&&!city){alert('请填写关键词或城市');return}
  const oid=loadLS('openid')||('demo_'+Math.random().toString(36).slice(2,10));
  saveLS('openid',oid);
  try{
    await postSubscribe({openid:oid,keywords:kw,city});
    saveLS('sub',{keywords:kw,city});
    closeModal();render();
    alert('订阅成功');
  }catch(e){alert('保存失败：'+e.message)}
}
async function triggerCrawl(){
  if(!confirm('将立即触发后端抓取最新岗位，确认吗？'))return;
  try{
    await fetch(API+'/api/system/crawl',{method:'POST'});
    alert('已触发，请稍后下拉刷新查看新数据');
  }catch(e){alert('触发失败')}
}
function clearLocal(){if(!confirm('确认清空本地收藏与浏览历史？'))return;['history','favs','sub'].forEach(k=>localStorage.removeItem('xj_'+k));render()}

// ============ 详情弹窗 ============
async function openDetail(id){
  // 记录浏览历史
  const j0=store.jobs.find(x=>x.id===id);
  if(j0){const hist=loadLS('history')||[];hist.push({id:j0.id,title:j0.title,company:j0.company,salary:j0.salary,ts:Date.now()});saveLS('history',hist.slice(-30))}
  const mask=$('modal');const body=$('modalBody');
  body.innerHTML='<div style="text-align:center;padding:40px">加载中...</div>';
  mask.classList.add('show');
  try{
    const j=await fetchJobDetail(id);
    const favs=loadLS('favs')||[];
    const isFav=favs.some(f=>f.id===j.id);
    body.innerHTML=`<span class="close" onclick="closeModal()">×</span>
      <h2>${esc(j.title)}</h2>
      <div class="s">${esc(j.salary||'面议')}</div>
      <div class="company">${esc(j.company)}</div>
      <div class="meta">${esc(j.city)}${j.district?' · '+esc(j.district):''}<br>经验：${esc(j.experience||'不限')} · 学历：${esc(j.education||'不限')}<br>类型：${esc(j.job_type||'全职')} · 发布：${esc(j.publish_time||'实时')}</div>
      <div class="st">福利待遇</div>
      <div class="tags">${(j.welfare||[]).map(w=>`<span class="tag">${esc(w)}</span>`).join('')||'<span class="muted">—</span>'}</div>
      <div class="st">职位描述</div>
      <div class="desc">${esc(j.description||'—')}</div>
      <div class="st">联系方式</div>
      ${j.contact?`<div class="line">联系人：${esc(j.contact)}</div>`:''}
      ${j.phone?`<div class="line">电话：${esc(j.phone)}</div>`:''}
      ${j.email?`<div class="line">邮箱：${esc(j.email)}</div>`:''}
      ${j.address?`<div class="line">地址：${esc(j.address)}</div>`:''}
      ${!j.contact&&!j.phone&&!j.email&&!j.address?'<div class="line" style="color:var(--muted)">未提供联系方式</div>':''}
      <div class="actions">
        <button class="btn outline" onclick="toggleFav(${j.id})">${isFav?'★ 已收藏':'☆ 收藏'}</button>
        <button class="btn" onclick="copyText('${esc(j.phone||'')}')">复制电话</button>
        <button class="btn outline" onclick="copyText('${esc(j.url||'')}')">原文链接</button>
      </div>`;
  }catch(e){body.innerHTML='<div class="empty">加载失败</div>'}
}
function toggleFav(id){
  const j=store.jobs.find(x=>x.id===id);if(!j)return;
  let favs=loadLS('favs')||[];
  const i=favs.findIndex(f=>f.id===id);
  if(i>=0)favs.splice(i,1);else favs.push({id:j.id,title:j.title,company:j.company,salary:j.salary});
  saveLS('favs',favs);
  openDetail(id);
}
function copyText(t){if(!t)return alert('无内容');navigator.clipboard.writeText(t).then(()=>alert('已复制'))}
function closeModal(){$('modal').classList.remove('show')}
function aboutApp(){
  const body=$('modalBody');
  body.innerHTML=`<span class="close" onclick="closeModal()">×</span>
    <h2>新疆求职通</h2>
    <div class="meta">聚合新疆疆内招聘信息，每日实时更新</div>
    <div class="st">功能</div>
    <div class="desc" style="font-size:13px">• 岗位列表：分类浏览 + 关键词搜索<br>• 多维筛选：城市/类型/学历/经验/薪资<br>• 数据看板：趋势/分布/热门词统计<br>• 招聘资讯：政策招考指南<br>• 个人中心：订阅/收藏/历史</div>
    <div class="st">实时更新</div>
    <div class="desc" style="font-size:13px">定时爬虫每日 08/12/18 点抓取，下拉刷新秒级获取最新数据。</div>
    <div class="actions"><button class="btn" onclick="closeModal()">知道了</button></div>`;
  $('modal').classList.add('show');
}

// ============ 滚动/初始化 ============
function scrollTop(){window.scrollTo({top:0,behavior:'smooth'});$('floatBtn').classList.remove('show')}
window.addEventListener('scroll',()=>{
  if(window.scrollY>600)$('floatBtn').classList.add('show');
  else $('floatBtn').classList.remove('show');
});
$('modal').addEventListener('click',e=>{if(e.target.id==='modal')closeModal()});

// 启动
render();
