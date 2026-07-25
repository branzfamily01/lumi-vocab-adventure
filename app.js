'use strict';
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const STORAGE_KEY='lumiVocabAdventureStateV2', OLD_STORAGE_KEY='lumiVocabAdventureStateV1', DAY=86400000;
const LEVELS=[
  {key:'grade3',label:'英検3級',audience:'kids',audienceLabel:'子ども用',count:900,icon:'🌱',color:'#63b88e',description:'身近な話題と基本表現'},
  {key:'pre2',label:'英検準2級',audience:'kids',audienceLabel:'子ども用',count:1100,icon:'🚲',color:'#5fa8dc',description:'学校・社会の話題へ拡張'},
  {key:'grade2',label:'英検2級',audience:'kids',audienceLabel:'子ども用',count:1300,icon:'🚀',color:'#7b83e8',description:'論理的な長文に必要な語彙'},
  {key:'pre1',label:'英検準1級',audience:'adult',audienceLabel:'大人用',count:1600,icon:'🧭',color:'#a76fda',description:'社会・学術テーマの抽象語'},
  {key:'grade1',label:'英検1級',audience:'adult',audienceLabel:'大人用',count:2100,icon:'🏛️',color:'#d6748f',description:'高度で精密な語彙表現'}
];
const packs=window.LUMI_WORD_PACKS||{};
let words=[],currentQuiz=null,battle=null,bookLimit=120;
let state=loadState();

function defaultState(){return{xp:0,leaves:0,streak:0,lastStudy:'',profileName:'ことば冒険者',selectedLevel:'grade3',selectedAudience:'kids',stats:{},daily:{date:todayKey(),questions:0,correct:0,audio:0,reviews:0},history:{}}}
function loadState(){try{const raw=localStorage.getItem(STORAGE_KEY)||localStorage.getItem(OLD_STORAGE_KEY)||'{}';const parsed=JSON.parse(raw);return{...defaultState(),...parsed,stats:parsed.stats||{},daily:{...defaultState().daily,...(parsed.daily||{})},history:parsed.history||{}}}catch{return defaultState()}}
function saveState(render=true){localStorage.setItem(STORAGE_KEY,JSON.stringify(state));if(render)renderAll()}
function todayKey(d=new Date()){return d.toISOString().slice(0,10)}
function ensureDaily(){if(state.daily?.date!==todayKey())state.daily={date:todayKey(),questions:0,correct:0,audio:0,reviews:0}}
function wordStat(id){return state.stats[id]||(state.stats[id]={seen:0,correct:0,wrong:0,streak:0,box:0,nextReview:0,lastSeen:0})}
function shuffle(a){const x=[...a];for(let i=x.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[x[i],x[j]]=[x[j],x[i]]}return x}
function sample(a,n=1){return shuffle(a).slice(0,n)}
function fmt(n){return Number(n||0).toLocaleString('ja-JP')}
function esc(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function levelMeta(key=state.selectedLevel){return LEVELS.find(x=>x.key===key)||LEVELS[0]}
function activeWords(key=state.selectedLevel){return words.filter(w=>w.levelKey===key)}
function toast(msg){const t=$('#toast');if(!t)return;t.textContent=msg;t.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove('show'),2200)}
function speak(text,rate=.82){if(!('speechSynthesis'in window)){toast('この端末は音声再生に対応していません');return}speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang='en-US';u.rate=rate;speechSynthesis.speak(u);ensureDaily();state.daily.audio++;saveState(false);renderHeaderStats()}
function updateStreak(){const today=todayKey();if(state.lastStudy===today)return;const y=new Date();y.setDate(y.getDate()-1);state.streak=state.lastStudy===todayKey(y)?state.streak+1:1;state.lastStudy=today}
function addHistory(correct){const k=todayKey();state.history[k]=state.history[k]||{questions:0,correct:0};state.history[k].questions++;if(correct)state.history[k].correct++}

function init(){
  const base=Object.values(packs).flat();
  const custom=JSON.parse(localStorage.getItem('lumiCustomWordsV2')||'[]');
  words=[...base,...custom.filter(x=>x?.id&&!base.some(w=>w.id===x.id))];
  if(!packs[state.selectedLevel])state.selectedLevel='grade3';
  state.selectedAudience=levelMeta().audience;
  ensureDaily();bind();renderAll();
  if('serviceWorker'in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('sw.js').catch(()=>{});
}
function bind(){
  $$('.nav-btn').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.view)));
  $('#startQuestBtn').onclick=()=>startQuiz({count:10,title:`${levelMeta().label} 今日のクエスト`});
  $('#reviewQuestBtn').onclick=()=>startQuiz({count:10,mode:'review',title:`${levelMeta().label} 復習クエスト`});
  $$('.map-node').forEach(b=>b.onclick=()=>startQuiz({count:10,stage:+b.dataset.stage,title:`${levelMeta().label} ${b.querySelector('small').textContent}`}));
  $('#closeQuizBtn').onclick=closeQuiz;
  $('#startBattleBtn').onclick=startBattle;
  $$('.filter-tab').forEach(b=>b.onclick=()=>{$$('.filter-tab').forEach(x=>x.classList.remove('active'));b.classList.add('active');bookLimit=120;renderWordList()});
  $('#wordSearch').oninput=()=>{bookLimit=120;renderWordList()};
  $('#autoPlayBtn').onclick=autoPlayWords;
  $('#loadMoreWords').onclick=()=>{bookLimit+=120;renderWordList()};
  $('#exportBtn').onclick=exportWords;
  $('#importInput').onchange=importWords;
  $('#resetBtn').onclick=()=>{if(confirm('学習記録をすべて消去しますか？')){localStorage.removeItem(STORAGE_KEY);state=defaultState();saveState();toast('記録をリセットしました')}};
  window.addEventListener('keydown',e=>{if(e.key==='Escape'&&currentQuiz)closeQuiz()});
}
function showView(name){
  $$('.view').forEach(v=>v.classList.toggle('active',v.id===name+'View'));
  $$('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.view===name));
  window.scrollTo({top:0,behavior:'smooth'});
  if(name==='book')renderWordList();if(name==='profile')renderProfile();
}
function selectLevel(key,{view=null}={}){
  const m=levelMeta(key);state.selectedLevel=m.key;state.selectedAudience=m.audience;bookLimit=120;saveState(false);renderAll();toast(`${m.label}に切り替えました`);if(view)showView(view);
}

function renderAll(){ensureDaily();renderHeaderStats();renderCourses();renderCourseLabels();if($('#bookView')?.classList.contains('active'))renderWordList();if($('#profileView')?.classList.contains('active'))renderProfile()}
function renderHeaderStats(){
  $('#streakCount').textContent=state.streak;$('#leafCount').textContent=state.leaves;
  $('#missionSummary').textContent=`${Math.min(state.daily.questions,10)} / 10問`;
  $('#questionProgress').style.width=`${Math.min(100,state.daily.questions*10)}%`;
  $('#audioProgress').style.width=`${Math.min(100,state.daily.audio*20)}%`;
  $('#reviewProgress').style.width=`${Math.min(100,state.daily.reviews/3*100)}%`;
  $('#todayCorrect').textContent=state.daily.correct;
  $('#todayAccuracy').textContent=state.daily.questions?Math.round(state.daily.correct/state.daily.questions*100)+'%':'—';
  $('#masteredCount').textContent=activeWords().filter(w=>wordStat(w.id).box>=4).length;
}
function renderCourses(){
  $$('.audience-btn').forEach(b=>b.classList.toggle('active',b.dataset.audience===state.selectedAudience));
  $$('.audience-btn').forEach(b=>b.onclick=()=>{state.selectedAudience=b.dataset.audience;saveState(false);renderCourses()});
  const list=LEVELS.filter(x=>x.audience===state.selectedAudience),wrap=$('#levelCards');
  wrap.innerHTML=list.map(m=>{const pool=activeWords(m.key),studied=pool.filter(w=>wordStat(w.id).seen>0).length,mastered=pool.filter(w=>wordStat(w.id).box>=4).length,p=Math.round(mastered/Math.max(1,pool.length)*100);return `<button class="level-card ${m.key===state.selectedLevel?'selected':''}" data-level="${m.key}" style="--course:${m.color}"><span class="level-icon">${m.icon}</span><span class="level-card-main"><small>${m.audienceLabel}</small><strong>${m.label}</strong><em>${m.description}</em><span class="level-card-progress"><i style="width:${p}%"></i></span><small>${fmt(pool.length)}語・学習 ${fmt(studied)}・習得 ${fmt(mastered)}</small></span><span class="level-arrow">›</span></button>`}).join('');
  $$('.level-card',wrap).forEach(b=>b.onclick=()=>selectLevel(b.dataset.level));
  $('#selectedWordCount').textContent=`${fmt(activeWords().length)}語`;
}
function renderCourseLabels(){
  const m=levelMeta();
  ['heroCourseBadge','mapCourseBadge','battleCourseBadge'].forEach(id=>{const el=$('#'+id);if(el){el.textContent=m.label;el.style.setProperty('--course',m.color)}});
  $('#heroCourseText').textContent=`${m.description}。全${fmt(activeWords().length)}語をイラスト・音声・復習で定着させます。`;
  const tabs=$('#bookLevelTabs');if(tabs){tabs.innerHTML=LEVELS.map(x=>`<button class="level-tab ${x.key===m.key?'active':''}" data-level="${x.key}" style="--course:${x.color}">${x.icon} ${x.label}<small>${fmt(activeWords(x.key).length)}</small></button>`).join('');$$('.level-tab',tabs).forEach(b=>b.onclick=()=>selectLevel(b.dataset.level));}
}

function getPool(opts={}){
  let pool=activeWords(opts.levelKey||state.selectedLevel);
  if(Number.isInteger(opts.stage))pool=pool.filter(w=>w.stage===opts.stage);
  if(opts.mode==='review'){
    const now=Date.now(),rev=pool.filter(w=>{const s=wordStat(w.id);return s.wrong>0||(s.seen>0&&s.nextReview<=now)});
    if(rev.length>=4)pool=rev;
  }
  return pool.length?pool:activeWords();
}
function startQuiz(opts={}){
  const pool=getPool(opts),count=Math.min(opts.count||10,Math.max(1,pool.length));
  let items=sample(pool,count);while(items.length<count)items.push(sample(pool)[0]);
  currentQuiz={title:opts.title||'クエスト',items,index:0,correct:0,answered:false,mode:opts.mode||'normal'};
  $('#quizOverlay').classList.remove('hidden');document.body.style.overflow='hidden';renderQuestion();
}
function closeQuiz(){if(!currentQuiz)return;$('#quizOverlay').classList.add('hidden');document.body.style.overflow='';currentQuiz=null;$('#feedbackPanel').className='feedback-panel hidden'}
function distractorsFor(w){
  const pool=activeWords(w.levelKey),same=pool.filter(x=>x.id!==w.id&&x.pos===w.pos&&Math.abs(x.stage-w.stage)<=2),rest=pool.filter(x=>x.id!==w.id&&!same.some(s=>s.id===x.id));
  return [...sample(same,3),...sample(rest,3)].filter((x,i,a)=>a.findIndex(y=>y.id===x.id)===i).slice(0,3);
}
function renderQuestion(){
  const q=currentQuiz;if(!q)return;if(q.index>=q.items.length)return finishQuiz();
  q.answered=false;const w=q.items[q.index],types=['image','word','meaning','sentence'],type=types[q.index%types.length],d=distractorsFor(w);q.type=type;
  $('#quizCounter').textContent=`${q.index+1} / ${q.items.length}`;$('#quizProgress').style.width=`${q.index/q.items.length*100}%`;
  const f=$('#feedbackPanel');f.className='feedback-panel hidden';f.innerHTML='';
  let prompt='',choices=[];
  if(type==='image'){prompt=`<div class="question-type">イラストに合う英単語は？</div><div class="question-illustration">${illustration(w)}</div>`;choices=shuffle([w,...d]).map(x=>({label:x.word,id:x.id}));}
  if(type==='word'){prompt=`<div class="question-type">英単語の意味は？</div><h2 class="question-word">${esc(w.word)}</h2><button class="audio-btn" data-speak="${esc(w.word)}" aria-label="発音を聞く">🔊</button>`;choices=shuffle([w,...d]).map(x=>({label:x.meaning,id:x.id}));}
  if(type==='meaning'){prompt=`<div class="question-type">日本語に合う英単語は？</div><h2 class="question-meaning">${esc(w.meaning)}</h2>`;choices=shuffle([w,...d]).map(x=>({label:x.word,id:x.id}));}
  if(type==='sentence'){const blank=w.example.replace(new RegExp(w.word,'i'),'_____');prompt=`<div class="question-type">例文の空所に入る語は？</div><div class="mini-illustration">${illustration(w)}</div><h2 class="sentence-prompt">${esc(blank)}</h2>`;choices=shuffle([w,...d]).map(x=>({label:x.word,id:x.id}));}
  $('#quizContent').innerHTML=`<div class="quiz-prompt">${prompt}</div><div class="choices">${choices.map(c=>`<button class="choice-btn" data-id="${c.id}">${esc(c.label)}</button>`).join('')}</div>`;
  $('#quizContent').scrollTop=0;
  $$('[data-speak]',$('#quizContent')).forEach(b=>b.onclick=()=>speak(b.dataset.speak));
  $$('.choice-btn',$('#quizContent')).forEach(b=>b.onclick=()=>answerQuestion(b,w));
}
function answerQuestion(btn,w){
  if(currentQuiz.answered)return;currentQuiz.answered=true;const ok=btn.dataset.id===w.id;
  $$('.choice-btn',$('#quizContent')).forEach(b=>{b.disabled=true;if(b.dataset.id===w.id)b.classList.add('correct')});if(!ok)btn.classList.add('wrong');
  recordAnswer(w,ok,currentQuiz.mode==='review');
  const f=$('#feedbackPanel');f.className='feedback-panel '+(ok?'good':'bad');
  f.innerHTML=`<div class="feedback-summary"><span class="feedback-mark">${ok?'✨':'🌱'}</span><div><strong>${ok?'正解！':'ここで覚えよう'}</strong><p><b>${esc(w.word)}</b>　${esc(w.meaning)}</p></div><button class="mini-btn" id="feedbackSpeak" aria-label="発音">🔊</button></div><details class="example-details"><summary>例文を見る</summary><p>${esc(w.example)}<br><small>${esc(w.exampleJa)}</small></p></details><button class="primary-btn next-btn" id="nextQuestionBtn">${currentQuiz.index+1===currentQuiz.items.length?'結果を見る':'次の問題へ'}</button>`;
  $('#feedbackSpeak').onclick=()=>speak(`${w.word}. ${w.example}`);
  $('#nextQuestionBtn').onclick=()=>{currentQuiz.index++;renderQuestion()};
}
function recordAnswer(w,ok,isReview=false){
  ensureDaily();updateStreak();const s=wordStat(w.id);s.seen++;s.lastSeen=Date.now();state.daily.questions++;if(isReview)state.daily.reviews++;
  if(ok){s.correct++;s.streak++;s.box=Math.min(5,s.box+1);const intervals=[0,1,3,7,14,30];s.nextReview=Date.now()+intervals[s.box]*DAY;state.daily.correct++;currentQuiz.correct++;state.xp+=10;state.leaves+=2}
  else{s.wrong++;s.streak=0;s.box=Math.max(0,s.box-1);s.nextReview=Date.now()+10*60*1000;state.xp+=2}
  addHistory(ok);saveState(false);renderHeaderStats();
}
function finishQuiz(){
  const q=currentQuiz,rate=Math.round(q.correct/q.items.length*100);$('#quizProgress').style.width='100%';
  $('#quizContent').innerHTML=`<div class="quiz-result"><img src="mascot.svg" alt="ルミン"><p class="eyebrow">QUEST COMPLETE</p><h2>${q.correct} / ${q.items.length}</h2><p>正答率 ${rate}%　・　+${q.correct*10+(q.items.length-q.correct)*2} XP</p><div class="stat-grid"><article class="stat-card"><span>正解</span><strong>${q.correct}</strong></article><article class="stat-card"><span>復習候補</span><strong>${q.items.length-q.correct}</strong></article><article class="stat-card"><span>ルミリーフ</span><strong>+${q.correct*2}</strong></article></div><button class="primary-btn" id="finishBtn">冒険を続ける</button></div>`;
  $('#feedbackPanel').className='feedback-panel hidden';$('#finishBtn').onclick=()=>{closeQuiz();showView('map');renderAll()};
}

function statusOf(w){const s=wordStat(w.id),now=Date.now();if(s.box>=4)return'mastered';if(s.wrong>=2&&s.correct/Math.max(1,s.seen)<.6)return'weak';if(s.seen>0&&s.nextReview<=now)return'due';if(s.seen>0&&s.box<3)return'fuzzy';return'new'}
function renderWordList(){
  const wrap=$('#wordList');if(!wrap||!words.length)return;const filter=$('.filter-tab.active')?.dataset.filter||'all',q=($('#wordSearch')?.value||'').trim().toLowerCase();
  const all=activeWords().filter(w=>(filter==='all'||statusOf(w)===filter)&&(!q||w.word.toLowerCase().includes(q)||w.meaning.includes(q))),list=all.slice(0,bookLimit);
  $('#wordListCount').textContent=`${fmt(all.length)}語`;
  wrap.innerHTML=list.length?list.map(w=>{const s=wordStat(w.id),st=statusOf(w),labels={new:'未学習',weak:'苦手',fuzzy:'うろ覚え',due:'復習待ち',mastered:'習得'};return `<article class="word-card"><div class="word-thumb">${illustration(w)}</div><div class="word-main"><strong>${esc(w.word)}</strong><p>${esc(w.meaning)}</p><small>${esc(w.level)} ・ 重要度${esc(w.priority||'—')} ・ ${labels[st]} ・ 正解 ${s.correct}/${s.seen}</small></div><div class="word-actions"><button class="mini-btn word-speak" data-word="${esc(w.word)}" aria-label="発音">🔊</button><button class="mini-btn word-practice" data-id="${w.id}" aria-label="この単語を練習">▶</button></div></article>`}).join(''):'<div class="data-tools"><strong>該当する単語はありません</strong><p>条件を変えるか、学習を進めてください。</p></div>';
  const more=$('#loadMoreWords');more.classList.toggle('hidden',list.length>=all.length);more.textContent=`さらに表示（残り${fmt(Math.max(0,all.length-list.length))}語）`;
  $$('.word-speak',wrap).forEach(b=>b.onclick=()=>speak(b.dataset.word));
  $$('.word-practice',wrap).forEach(b=>b.onclick=()=>{const w=words.find(x=>x.id===b.dataset.id);currentQuiz={title:'単語練習',items:[w,w,w,w],index:0,correct:0,answered:false,mode:'review'};$('#quizOverlay').classList.remove('hidden');document.body.style.overflow='hidden';renderQuestion()});
}
async function autoPlayWords(){
  const filter=$('.filter-tab.active')?.dataset.filter||'all',list=activeWords().filter(w=>filter==='all'||statusOf(w)===filter).slice(0,30);if(!list.length)return toast('再生する単語がありません');
  toast(`${levelMeta().label}の${list.length}語を順に再生します`);speechSynthesis.cancel();
  for(const w of list){await new Promise(resolve=>{const u=new SpeechSynthesisUtterance(`${w.word}. ${w.example}`);u.lang='en-US';u.rate=.8;u.onend=resolve;u.onerror=resolve;speechSynthesis.speak(u)});state.daily.audio++}saveState();
}
function renderProfile(){
  if(!$('#levelScore')||!words.length)return;const level=Math.floor(state.xp/100)+1,rem=state.xp%100;$('#levelScore').textContent=level;$('#levelProgress').style.width=rem+'%';$('#xpLabel').textContent=`${rem} / 100 XP`;
  const pool=activeWords(),studied=pool.filter(w=>wordStat(w.id).seen>0),mastered=pool.filter(w=>wordStat(w.id).box>=4),p=studied.length?Math.round(mastered.length/studied.length*100):0;
  $('#memoryPercent').textContent=p+'%';$('#memoryDonut').style.background=`conic-gradient(${levelMeta().color} ${p*3.6}deg,#eef0f7 0)`;$('#memoryCaption').textContent=`${levelMeta().label}・学習済み${studied.length}語の定着率`;
  const ranks=['ルーキー冒険者','森のことば使い','光の語彙ハンター','天空の言語賢者'];$('#rankBadge').textContent=ranks[Math.min(ranks.length-1,Math.floor(level/5))];
  $('#levelProgressList').innerHTML=LEVELS.map(m=>{const x=activeWords(m.key),seen=x.filter(w=>wordStat(w.id).seen>0).length,master=x.filter(w=>wordStat(w.id).box>=4).length,rate=Math.round(master/Math.max(1,x.length)*100);return `<button class="level-progress-row" data-level="${m.key}"><span>${m.icon}</span><div><strong>${m.label}</strong><small>学習 ${fmt(seen)}/${fmt(x.length)}・習得 ${fmt(master)}</small><i><b style="width:${rate}%;background:${m.color}"></b></i></div><em>${rate}%</em></button>`}).join('');
  $$('.level-progress-row').forEach(b=>b.onclick=()=>selectLevel(b.dataset.level,{view:'book'}));
  const days=['日','月','火','水','木','金','土'],chart=[];for(let i=6;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);const k=todayKey(d),v=state.history[k]?.questions||0;chart.push(`<div class="bar-col"><div class="bar" style="height:${Math.max(4,Math.min(145,v*11))}px"></div><small>${days[d.getDay()]}</small></div>`)}$('#weeklyChart').innerHTML=chart.join('');
}

function resetBattleUI(){
  $('#battleArena').innerHTML='<div class="battle-hud"><div class="timer-ring"><strong id="battleTimer">50</strong><span>sec</span></div><div class="rank-list" id="rankList"></div></div><div id="battleQuestion"></div>';
}
function startBattle(){resetBattleUI();battle={time:50,me:0,bots:[0,0,0],timer:null,current:null,answered:false};$('#battleIntro').classList.add('hidden');$('#battleArena').classList.remove('hidden');renderBattleRanks();nextBattleQuestion();battle.timer=setInterval(()=>{battle.time--;$('#battleTimer').textContent=battle.time;for(let i=0;i<3;i++)if(Math.random()<.28+i*.02)battle.bots[i]++;renderBattleRanks();if(battle.time<=0)endBattle()},1000)}
function nextBattleQuestion(){if(!battle||battle.time<=0)return;const pool=activeWords(),w=sample(pool)[0],d=distractorsFor(w);battle.current=w;battle.answered=false;$('#battleQuestion').innerHTML=`<div class="question-type">意味を選べ</div><h2 class="question-word">${esc(w.word)}</h2><button class="audio-btn" id="battleSpeak">🔊</button><div class="choices">${shuffle([w,...d]).map(x=>`<button class="choice-btn" data-id="${x.id}">${esc(x.meaning)}</button>`).join('')}</div>`;$('#battleSpeak').onclick=()=>speak(w.word);$$('.choice-btn',$('#battleQuestion')).forEach(b=>b.onclick=()=>{if(battle.answered)return;battle.answered=true;const ok=b.dataset.id===w.id;if(ok){battle.me++;b.classList.add('correct');state.xp+=5;state.leaves++}else b.classList.add('wrong');renderBattleRanks();setTimeout(nextBattleQuestion,300)})}
function renderBattleRanks(){const arr=[{name:'あなた',score:battle.me,me:true},{name:'アオ',score:battle.bots[0]},{name:'モモ',score:battle.bots[1]},{name:'ソラ',score:battle.bots[2]}].sort((a,b)=>b.score-a.score);$('#rankList').innerHTML=arr.map((x,i)=>`<div class="rank-row ${x.me?'me':''}"><strong>${i+1}</strong><span>${x.name}</span><b>${x.score}</b></div>`).join('')}
function endBattle(){clearInterval(battle.timer);const scores=[battle.me,...battle.bots].sort((a,b)=>b-a),rank=scores.indexOf(battle.me)+1;saveState(false);$('#battleArena').innerHTML=`<div class="battle-result"><img src="mascot.svg" alt="ルミン"><p class="eyebrow">BATTLE FINISH</p><h2>${rank}位</h2><p>${battle.me}問正解！　+${battle.me*5} XP</p><button class="primary-btn" id="battleAgain">もう一度挑戦</button><button class="secondary-btn" id="battleBack">結果を閉じる</button></div>`;$('#battleAgain').onclick=startBattle;$('#battleBack').onclick=()=>{$('#battleArena').classList.add('hidden');$('#battleIntro').classList.remove('hidden');renderAll()}}

function exportWords(){const data=activeWords(),blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`lumi-${state.selectedLevel}-words.json`;a.click();URL.revokeObjectURL(a.href)}
async function importWords(e){const f=e.target.files[0];if(!f)return;try{const arr=JSON.parse(await f.text());if(!Array.isArray(arr))throw new Error();const valid=arr.filter(w=>w.word&&w.meaning).map((w,i)=>({...w,id:w.id||`custom-${state.selectedLevel}-${Date.now()}-${i}`,levelKey:w.levelKey||state.selectedLevel,level:w.level||levelMeta().label,audience:w.audience||levelMeta().audience,stage:Number.isInteger(w.stage)?w.stage:i%6,example:w.example||`We learned the word “${w.word}” today.`,exampleJa:w.exampleJa||`今日は「${w.word}」という語を学びました。`,visual:w.visual||'✨',scene:w.scene||'abstract',color:w.color||levelMeta().color,pos:w.pos||'noun'}));const old=JSON.parse(localStorage.getItem('lumiCustomWordsV2')||'[]');const merged=[...old.filter(x=>!valid.some(v=>v.id===x.id)),...valid];localStorage.setItem('lumiCustomWordsV2',JSON.stringify(merged));const base=Object.values(packs).flat();words=[...base,...merged.filter(x=>!base.some(w=>w.id===x.id))];renderAll();toast(`${valid.length}語を${levelMeta().label}へ追加しました`)}catch{toast('JSON形式を確認してください')}e.target.value=''}

function illustration(w){
  const color=w.color||levelMeta(w.levelKey).color,emoji=esc(w.visual||'✨'),scene=w.scene||'abstract';
  const bg={nature:'#e7f8ef',study:'#eef0ff',communication:'#fff0f5',thinking:'#f4efff',work:'#fff4e5',society:'#edf4ff',time:'#f5f1ff',travel:'#e7f6ff',growth:'#e9f8ef',change:'#fff1ea',safety:'#edf2ff',emotion:'#fff0f4',people:'#eef9f5',choice:'#fff8dc',problem:'#f3f0ff',important:'#fff8db',technology:'#edf4f7',health:'#fff0f0',compare:'#f4f2ff',mystery:'#edf0f7',abstract:'#f2f3ff',food:'#fff5e8'}[scene]||'#f2f3ff';
  const decoration={nature:'<path d="M34 172c24-48 55-63 91-42 30 18 61 12 91-19 28 17 51 38 70 61H34Z" fill="#75c68f" opacity=".55"/><circle cx="58" cy="54" r="22" fill="#ffd86a"/>',study:'<path d="M34 144h252v36H34z" fill="#cad1ff"/><path d="M83 77h62v80H83zM175 77h62v80h-62z" fill="#fff" stroke="#7c88e8" stroke-width="5"/>',communication:'<path d="M45 50h104v72H45zM171 75h104v72H171z" rx="18" fill="#fff" opacity=".8"/><path d="m88 122-15 25 32-18m128 18 14 23-31-18" fill="#fff"/>',growth:'<path d="M45 157h230" stroke="#7a879f" stroke-width="8"/><path d="M66 137l58-42 45 21 74-65" fill="none" stroke="#56bd88" stroke-width="12" stroke-linecap="round"/><path d="m223 48 27-5-5 27" fill="none" stroke="#56bd88" stroke-width="10"/>',change:'<path d="M86 112a74 74 0 0 1 126-48" fill="none" stroke="#7b83e8" stroke-width="12"/><path d="m201 45 25 15-22 20" fill="none" stroke="#7b83e8" stroke-width="10"/><path d="M234 108a74 74 0 0 1-126 48" fill="none" stroke="#f08b73" stroke-width="12"/><path d="m118 175-25-15 22-20" fill="none" stroke="#f08b73" stroke-width="10"/>',abstract:'<circle cx="70" cy="54" r="18" fill="#fff" opacity=".75"/><circle cx="262" cy="144" r="28" fill="#fff" opacity=".55"/><path d="M35 160Q100 95 160 145T285 105V190H35Z" fill="#fff" opacity=".45"/>'}[scene]||'<circle cx="70" cy="54" r="18" fill="#fff" opacity=".75"/><circle cx="262" cy="144" r="28" fill="#fff" opacity=".55"/>';
  return `<svg viewBox="0 0 320 200" role="img" aria-label="${esc(w.meaning)}のイラスト" xmlns="http://www.w3.org/2000/svg"><rect width="320" height="200" rx="24" fill="${bg}"/><circle cx="278" cy="35" r="46" fill="${color}" opacity=".18"/>${decoration}<g transform="translate(160 105)"><circle r="62" fill="#fff" opacity=".92"/><circle r="61" fill="none" stroke="${color}" stroke-width="6" opacity=".7"/><text x="0" y="18" text-anchor="middle" font-size="72" font-family="Apple Color Emoji,Segoe UI Emoji,sans-serif">${emoji}</text></g><circle cx="54" cy="152" r="7" fill="${color}"/><circle cx="270" cy="69" r="6" fill="${color}"/><path d="m48 70 7 13 14 2-10 10 2 14-13-7-13 7 3-14-11-10 14-2Z" fill="#ffd76a"/></svg>`;
}

document.addEventListener('DOMContentLoaded',init);
