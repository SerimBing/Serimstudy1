(() => {
  'use strict';
  const W=window.StudyWiki,$=s=>document.querySelector(s),courses=window.STUDY_COURSES||[],questions=window.JBL_DATA?.questions||[];
  const config=window.STUDY_CONFIG||{},storageKey=config.storageKey||'shared-study-site-v1';
  const fresh=()=>({theme:'light',scale:100,gestures:true,records:{},bookmarks:{},answers:{},written:{}});
  let saved=fresh(),storageFailed=false;
  try{saved={...saved,...JSON.parse(localStorage.getItem(storageKey)||'{}')};}catch{storageFailed=true;}
  for(const name of ['records','bookmarks','answers','written'])if(!saved[name]||typeof saved[name]!=='object')saved[name]={};
  const state={cid:null,mode:'wiki',index:0,panel:[],reveal:{},hideEffects:{},positions:{},courseModes:{},closing:null};
  let observer=null,anchor=null,panelOpener=null,lastStamp=0,noticeTimer;
  function notice(text){$('#notice').textContent=text;$('#notice').classList.add('visible');clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('#notice').classList.remove('visible'),2600);}
  function save(){try{localStorage.setItem(storageKey,JSON.stringify(saved));}catch{if(!storageFailed)notice('이 브라우저에서는 기록을 저장할 수 없어 이번 화면에서만 유지돼요.');storageFailed=true;}}
  function record(id,status,origin){lastStamp=Math.max(Date.now(),lastStamp+1);saved.records[id]={status,at:lastStamp,origin};save();syncControls();}
  function applyPreferences(){
    document.documentElement.dataset.theme=saved.theme==='dark'?'dark':'light';
    document.documentElement.dataset.gestures=saved.gestures?'on':'off';
    saved.scale=Math.max(50,Math.min(150,Number(saved.scale)||100));
    document.documentElement.style.setProperty('--scale',saved.scale/100);
    $('#font-scale').value=saved.scale;$('#scale-label').textContent=saved.scale+'%';
    $('#theme-toggle').innerHTML=`<span aria-hidden="true">${saved.theme==='dark'?'☀':'☾'}</span> ${saved.theme==='dark'?'라이트모드':'다크모드'}`;
    $('#theme-toggle').setAttribute('aria-pressed',String(saved.theme==='dark'));
    $('#gesture-toggle').innerHTML=`<span aria-hidden="true">↔</span> 제스처 ${saved.gestures?'끄기':'켜기'}`;
    $('#gesture-toggle').setAttribute('aria-pressed',String(!saved.gestures));
  }
  function settings(open){$('#settings').hidden=!open;$('#settings-backdrop').hidden=!open;$('#settings-button').setAttribute('aria-expanded',String(open));if(!open)$('#settings-button').focus({preventScroll:true});}
  const course=id=>courses.find(c=>c.id===Number(id));
  const question=n=>questions.find(q=>q.globalNumber===Number(n));
  const title=String(config.title||'STUDY NOTE').toUpperCase();$('.site-logo').textContent=title;document.title=title;
  function entries(){
    if(!state.cid)return [];
    return state.mode==='jbl'?W.entries(state.cid):questions.filter(q=>q.lectureIds.includes(state.cid)).sort((a,b)=>a.globalNumber-b.globalNumber).map(q=>({kind:'question',id:q.id,q}));
  }
  function statusBox(id){return `<select class="status-select" data-status-id="${W.esc(id)}" aria-label="풀이 상태"><option value="">　</option><option value="o">○</option><option value="triangle">△</option><option value="x">×</option></select>`;}
  function star(id){return `<button class="star-button" data-bookmark="${W.esc(id)}" aria-label="즐겨찾기" aria-pressed="false">☆</button>`;}
  function syncControls(){
    document.querySelectorAll('[data-bookmark]').forEach(b=>{const on=!!saved.bookmarks[b.dataset.bookmark];b.textContent=on?'★':'☆';b.setAttribute('aria-pressed',String(on));});
    document.querySelectorAll('[data-status-id]').forEach(s=>{const status=saved.records[s.dataset.statusId]?.status||'';s.value=status;s.dataset.status=status;});
  }
  function answers(q){return Array.isArray(q.answerIndices)?q.answerIndices:[];}
  function grade(q){
    const correct=answers(q),selected=saved.answers[q.id]||[];
    if(!selected.length){record(q.id,'','unselected');return;}
    if(!correct.length){record(q.id,'triangle','answer-unconfirmed');return;}
    record(q.id,selected.length===correct.length&&selected.every(n=>correct.includes(n))?'o':'x','attempt');
  }
  function questionMarkup(q){
    const selected=saved.answers[q.id]||[],shown=!!state.reveal[q.id],correct=answers(q),cid=q.lectureIds[0];
    const options=q.choices.length?`<div class="j-choices">${q.choices.map((c,i)=>{
      const n=i+1;let cl='';if(!state.hideEffects[q.id]){if(shown&&correct.includes(n))cl='correct';else if(shown&&correct.length&&selected.includes(n))cl='wrong';else if(selected.includes(n))cl='selected';}
      return `<button class="j-choice ${cl}" data-choice="${n}" aria-pressed="${selected.includes(n)}"><span class="choice-number">${n}</span><span>${W.inline(c,cid)}</span></button>`;
    }).join('')}</div>${q.multiple||correct.length>1?'<button class="small-action" data-check>선택 완료 · 채점</button>':''}`:`<label class="j-note" for="written-${q.id}">나의 답안</label><textarea id="written-${q.id}" class="short-answer" data-written="${W.esc(q.id)}" placeholder="답안을 적은 뒤 모범답안과 비교해 보세요.">${W.esc(saved.written[q.id]||'')}</textarea><p class="j-note">서술형은 모범답안과 비교하고 ○·△·×로 기록해 주세요.</p>`;
    return `<article class="j-card" data-question="${q.globalNumber}"><header class="j-head"><div class="j-meta"><span>${W.esc(q.source||'출처 미확인')}</span><div class="j-controls">${statusBox(q.id)}<input class="question-number" data-number value="${q.globalNumber}번" inputmode="numeric" aria-label="고유번호 입력 후 이동">${star(q.id)}</div></div><h2 class="j-stem">${W.inline(q.question,cid)}</h2></header><div class="j-content">${q.passage?`<div class="j-passage">${W.render(q.passage,cid,{fragment:true})}</div>`:''}${(q.images||[]).map(src=>W.imagePath(src)?`<div class="photo-row"><img src="${W.esc(src)}" data-zoom alt="${q.globalNumber}번 문항 그림"></div>`:'').join('')}${options}${shown?`<div class="answer-box" style="margin-top:18px">정답: ${W.esc(q.answerLabel||'미확인')}</div>`:''}</div></article>`;
  }
  function conceptMarkup(e){return `<article class="j-card j-concept" data-concept="${W.esc(e.id)}"><header class="j-head"><div class="j-meta"><span class="concept-label">개념 카드</span><div class="j-controls">${statusBox(e.id)}${star(e.id)}</div></div><h2 class="concept-title">${W.esc(e.title)}</h2></header>${W.render(e.source,e.cid,{fragment:true})}</article>`;}
  function navMarkup(index,count,kind,q){return `<div class="nav-actions">${kind==='wiki'?'':`<button data-explain>${state.panel.at(-1)?.kind==='answer'&&state.panel.at(-1)?.q===q?.globalNumber?'해설 닫기':'해설 보기'}</button><button data-answer>${state.reveal[q?.id]?'정답 숨김':'정답 보기'}</button>`}</div><div class="nav-pages"><button data-prev aria-disabled="${index<=0}">← 이전<span class="page-word"> 문제</span></button><span class="counter">${count?index+1:0} / ${count}</span><button data-next aria-disabled="${index>=count-1}">다음<span class="page-word"> 문제</span> →</button></div>`;}
  function mainItem(){const list=entries();state.index=Math.max(0,Math.min(state.index,list.length-1));return list[state.index];}
  function renderStudy(){
    const c=course(state.cid),host=$('#study-view');if(!c||!host)return;
    host.className=state.mode==='wiki'?'':'question-view';
    if(state.mode==='wiki')host.innerHTML=W.render(window.LECTURE_NOTE_SOURCES?.[c.id]||'= '+c.title+' =\n아직 작성된 Wiki가 없습니다.',c.id);
    else{const list=entries(),e=mainItem();host.innerHTML=e?(e.kind==='wiki'?conceptMarkup(e):questionMarkup(e.q))+`<nav class="question-nav main-nav" aria-label="학습 카드 이동">${navMarkup(state.index,list.length,e.kind,e.q)}</nav>`:'<p class="empty">아직 연결된 문항이 없습니다.</p>';}
    syncControls();$('#fold-all').hidden=state.mode!=='wiki';$('#fold-all').innerHTML='<span aria-hidden="true">−</span> 모든 문단 접기';
    document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.mode===state.mode)));
  }
  function renderCourse(cid,mode='wiki',n=null){
    closePanel(true);state.cid=cid;state.mode=mode;state.index=state.positions[`${cid}:${mode}`]||0;
    if(n!=null){const at=entries().findIndex(e=>e.q?.globalNumber===n);if(at>=0)state.index=at;}
    const c=course(cid),ci=courses.indexOf(c);if(!c)return home();
    $('#app').innerHTML=`<section class="lecture-bar" id="lecture-bar"><h1>${W.esc(c.title)}</h1><div class="lecture-tools"><div class="tabs" role="tablist" aria-label="학습 모드">${['wiki','j','jbl'].map(m=>`<button role="tab" data-mode="${m}" aria-selected="${m===mode}">${m==='wiki'?'Wiki':m.toUpperCase()}</button>`).join('')}</div><button class="icon-button" data-course-prev aria-label="이전 강의" aria-disabled="${ci<=0}">←</button><button class="icon-button" data-course-next aria-label="다음 강의" aria-disabled="${ci>=courses.length-1}">→</button><input class="lecture-number" data-course-number inputmode="numeric" value="${cid}" aria-label="강의번호 입력 후 이동"></div></section><section id="study-view"></section>`;
    renderStudy();window.scrollTo(0,0);observer?.disconnect();
    observer=new IntersectionObserver(([e])=>{$('#recall-bar').hidden=e.isIntersecting;},{rootMargin:'-48px 0px 0px 0px'});observer.observe($('#lecture-bar'));
  }
  function home(){closePanel(true);observer?.disconnect();state.cid=null;$('#recall-bar').hidden=true;$('#fold-all').hidden=true;$('#app').innerHTML=`<section class="home"><div class="study-intro"><span class="eyebrow">PERSONNEL ADMINISTRATION · 2026</span><h1>이해하고, 풀고,<br>다시 연결하는 인사행정.</h1><p>강의록의 흐름을 따라 개념을 읽고 문제로 확인하세요.<br>오늘의 학습 범위는 PDF 1–50쪽입니다.</p><div class="study-stats"><span><b>06</b>학습 단원</span><span><b>18</b>수록 문항</span><span><b>50</b>원문 페이지</span></div><a class="start-study" href="#lecture-1">첫 단원부터 시작 →</a><a class="source-home" href="reader.html#p=1" target="_blank" rel="noopener">강의록 원문 보기 ↗</a></div><div class="mode-guide"><span><b>Wiki</b> 개념과 비교표</span><span><b>J</b> 문제와 해설</span><span><b>JBL</b> 개념 → 연결 문제</span></div><h2 class="list-heading">학습 목차 <small>PDF 순서대로</small></h2><div class="course-list">${courses.map(c=>`<a class="course-link" href="#lecture-${c.id}"><span class="course-index">${String(c.id).padStart(2,'0')}</span><span class="course-name">${W.esc(c.title)}<small>PDF ${c.pages[0]}–${c.pages[1]}쪽 · ${questions.filter(q=>q.lectureIds.includes(c.id)).length}문항</small></span><span aria-hidden="true">→</span></a>`).join('')||'<p class="empty">강의자료를 추가하면 이곳에 강의 목록이 생깁니다.</p>'}</div><div class="study-footnote"><p>강의록 수록 예제·유제입니다. 원출처 시험명은 자료의 표기를 따르며 공식 정답표는 제공되지 않았습니다. 16문항은 강의록 근거 추정답, 1·15번은 정답 미확인으로 자동채점에서 제외했습니다.</p><p>제도·수치는 강의록 기준이며 과거 명칭이 포함되어 있습니다. 풀이 기록·별표·설정은 이 브라우저에 저장됩니다.</p></div></section>`;window.scrollTo(0,0);}
  function route(){settings(false);const hash=location.hash,m=hash.match(/^#lecture-(\d+)$/),q=hash.match(/^#q-(\d+)$/);if(m&&course(+m[1]))renderCourse(+m[1],state.courseModes[+m[1]]||'wiki');else if(q&&question(+q[1]))renderCourse(question(+q[1]).lectureIds[0],'j',+q[1]);else home();}
  function switchMode(mode){if(!state.cid||mode===state.mode)return;state.positions[`${state.cid}:${state.mode}`]=state.index;closePanel(true);state.mode=mode;state.courseModes[state.cid]=mode;state.index=state.positions[`${state.cid}:${mode}`]||0;renderStudy();}
  function captureAnchor(opener){
    if(state.panel.length)return;
    const element=opener?.closest?.('p,li,h4,figure,.j-card')||[...$('#app').querySelectorAll('p,h4,.j-card')].find(el=>{const r=el.getBoundingClientRect();return r.top>=48&&r.top<innerHeight;});
    anchor=element?{element,top:element.getBoundingClientRect().top}:null;
  }
  function keepAnchor(){if(anchor?.element.isConnected)window.scrollBy(0,anchor.element.getBoundingClientRect().top-anchor.top);}
  function openPanel(entry,opener){
    clearTimeout(state.closing);$('#linked-panel').classList.remove('closing');
    if(!state.panel.length){captureAnchor(opener);panelOpener=opener||document.activeElement;document.body.classList.add('panel-open');$('#linked-panel').hidden=false;keepAnchor();}
    if(state.panel.length)state.panel.at(-1).scroll=$('#panel-body').scrollTop;
    state.panel.push(entry);renderPanel();
  }
  function renderPanel(){
    const entry=state.panel.at(-1);if(!entry)return;
    const body=$('#panel-body'),nav=$('#panel-nav');nav.hidden=true;nav.innerHTML='';
    if(entry.kind==='question'){
      const q=question(entry.q);$('#panel-title').textContent=`연결된 내용 · ${q.globalNumber}번`;
      body.innerHTML=questionMarkup(q);const seq=entry.sequence||[q.globalNumber],i=seq.indexOf(q.globalNumber);nav.hidden=false;nav.innerHTML=navMarkup(i,seq.length,'question',q);
    }else if(entry.kind==='answer'){
      const q=question(entry.q);$('#panel-title').textContent=`${q.globalNumber}번 해설`;
      body.innerHTML=`<div class="answer-box">${W.esc(q.answerLabel||'정답 미확인')}</div>${W.render(q.explanation||'아직 해설이 없습니다.',q.lectureIds[0],{fragment:true})}`;
    }else{
      const c=course(entry.cid);$('#panel-title').textContent='연결된 내용 · '+c.title;body.innerHTML=W.render(window.LECTURE_NOTE_SOURCES?.[c.id]||'',c.id);
    }
    $('#panel-back').disabled=state.panel.length<2;syncControls();body.scrollTop=entry.scroll||0;
    if(entry.section&&!entry.scroll){const target=[...body.querySelectorAll('[data-heading]')].find(e=>e.dataset.heading===entry.section);if(target)body.scrollTop=target.getBoundingClientRect().top-body.getBoundingClientRect().top+body.scrollTop-8;}
  }
  function closePanel(immediate=false){
    clearTimeout(state.closing);if($('#linked-panel').hidden){state.panel=[];return;}
    const finish=()=>{
      captureCloseAnchor();document.body.classList.remove('panel-open');$('#linked-panel').hidden=true;$('#linked-panel').classList.remove('closing','full');$('#panel-expand').setAttribute('aria-pressed','false');keepAnchor();
      state.panel=[];$('#panel-body').innerHTML='';$('#panel-nav').innerHTML='';$('#panel-nav').hidden=true;
      if(panelOpener?.isConnected)panelOpener.focus({preventScroll:true});
      document.querySelectorAll('#app [data-explain]').forEach(b=>b.textContent='해설 보기');
    };
    if(immediate)finish();else{$('#linked-panel').classList.add('closing');state.closing=setTimeout(finish,180);}
  }
  function captureCloseAnchor(){if(anchor?.element.isConnected)anchor.top=anchor.element.getBoundingClientRect().top;}
  function toggleExpand(){const full=$('#linked-panel').classList.toggle('full');$('#panel-expand').setAttribute('aria-pressed',String(full));$('#panel-expand').setAttribute('aria-label',full?'연결된 내용 분할화면으로 복귀':'연결된 내용 전체화면');}
  function activeQuestion(scope){return scope==='panel'?question(state.panel.at(-1)?.q):mainItem()?.q;}
  function explain(scope,opener){
    const q=activeQuestion(scope);if(!q)return;
    if(state.panel.at(-1)?.kind==='answer'&&state.panel.at(-1)?.q===q.globalNumber){closePanel();return;}
    state.reveal[q.id]=true;state.hideEffects[q.id]=false;
    if(scope==='main'){const y=scrollY;renderStudy();scrollTo(0,y);}else renderPanel();
    openPanel({kind:'answer',q:q.globalNumber},opener);document.querySelectorAll('#app [data-explain]').forEach(b=>b.textContent='해설 닫기');
  }
  function redraw(scope){if(scope==='panel'){const y=$('#panel-body').scrollTop;renderPanel();$('#panel-body').scrollTop=y;}else{const y=scrollY;renderStudy();scrollTo(0,y);}}
  function move(direction,scope='main'){
    if(scope==='panel'){
      const e=state.panel.at(-1);if(e?.kind!=='question')return;const i=e.sequence.indexOf(e.q)+direction;if(i<0||i>=e.sequence.length)return;e.q=e.sequence[i];e.scroll=0;renderPanel();return;
    }
    const list=entries(),i=state.index+direction;if(i<0||i>=list.length)return;closePanel(true);state.index=i;state.positions[`${state.cid}:${state.mode}`]=i;renderStudy();$('#study-view').scrollIntoView({block:'start'});window.scrollBy(0,-58);
  }
  function jumpQuestion(input){
    const n=Number(input.value.replace(/\D/g,'')),q=question(n);input.value=input.closest('[data-question]')?.dataset.question+'번';
    if(!q){notice('해당 고유번호의 문항이 없어요.');return;}
    if(input.closest('#linked-panel')){const entry=state.panel.at(-1);entry.q=n;entry.sequence=questions.map(q=>q.globalNumber).sort((a,b)=>a-b);entry.scroll=0;renderPanel();return;}
    const at=entries().findIndex(e=>e.q?.globalNumber===n);if(at>=0){closePanel(true);state.index=at;renderStudy();}else{location.hash='#q-'+n;}
  }
  function jumpCourse(input){const n=Number(input.value);if(!course(n)){input.value=state.cid;notice('해당 강의번호가 없어요.');return;}if(n!==state.cid)location.hash='#lecture-'+n;}
  document.addEventListener('click',e=>{
    const t=e.target.closest('button,a,img');if(!t)return;
    const scope=t.closest('#linked-panel')?'panel':'main';
    if(t.hasAttribute('aria-disabled')&&t.getAttribute('aria-disabled')==='true'){e.preventDefault();return;}
    if(t.dataset.mode){switchMode(t.dataset.mode);return;}
    if(t.hasAttribute('data-course-prev')||t.hasAttribute('data-course-next')){const i=courses.findIndex(c=>c.id===state.cid)+(t.hasAttribute('data-course-next')?1:-1);if(courses[i])location.hash='#lecture-'+courses[i].id;return;}
    if(t.dataset.q){
      e.preventDefault();const root=t.closest('[data-document]')||$('#study-view');
      const sequence=[...new Set([...root.querySelectorAll('[data-q]')].map(a=>+a.dataset.q))];
      openPanel({kind:'question',q:+t.dataset.q,sequence:sequence.length?sequence:[+t.dataset.q]},t);return;
    }
    if(t.dataset.doc){e.preventDefault();openPanel({kind:'wiki',cid:+t.dataset.doc,section:t.dataset.section},t);return;}
    if(t.dataset.footnote){e.preventDefault();const target=document.getElementById(t.dataset.footnote);target?.scrollIntoView({block:'center'});return;}
    if(t.dataset.bookmark){saved.bookmarks[t.dataset.bookmark]=!saved.bookmarks[t.dataset.bookmark];save();syncControls();return;}
    if(t.hasAttribute('data-fold')){const content=t.closest('.wiki-section').querySelector('.section-content');content.hidden=!content.hidden;t.textContent=content.hidden?'+':'−';t.setAttribute('aria-expanded',String(!content.hidden));return;}
    if(t.dataset.choice){
      const q=question(t.closest('[data-question]').dataset.question),n=+t.dataset.choice,old=saved.answers[q.id]||[];
      const multi=q.multiple||answers(q).length>1;saved.answers[q.id]=multi?(old.includes(n)?old.filter(x=>x!==n):[...old,n]):old.includes(n)?[]:[n];
      state.hideEffects[q.id]=false;state.reveal[q.id]=false;if(multi)record(q.id,'','selection-in-progress');else grade(q);save();redraw(scope);return;
    }
    if(t.hasAttribute('data-check')){const q=activeQuestion(scope);grade(q);state.reveal[q.id]=true;state.hideEffects[q.id]=false;redraw(scope);return;}
    if(t.hasAttribute('data-explain')){explain(scope,t);return;}
    if(t.hasAttribute('data-answer')){const q=activeQuestion(scope);state.reveal[q.id]=!state.reveal[q.id];state.hideEffects[q.id]=false;redraw(scope);return;}
    if(t.hasAttribute('data-next')){move(1,scope);return;}if(t.hasAttribute('data-prev')){move(-1,scope);return;}
    if(t.hasAttribute('data-zoom')){$('#large-image').src=t.src;$('#large-image').alt=t.alt;$('#image-dialog').showModal();}
  });
  document.addEventListener('change',e=>{if(e.target.dataset.statusId)record(e.target.dataset.statusId,e.target.value,'manual');});
  document.addEventListener('input',e=>{if(e.target.dataset.written){saved.written[e.target.dataset.written]=e.target.value;save();}});
  document.addEventListener('focusout',e=>{if(e.target.matches('[data-number]'))jumpQuestion(e.target);if(e.target.matches('[data-course-number]'))jumpCourse(e.target);});
  document.addEventListener('focusin',e=>{if(e.target.matches('[data-number],[data-course-number]'))e.target.select();});
  document.addEventListener('keydown',e=>{
    if(e.key==='Enter'&&e.target.matches('[data-number],[data-course-number]')){e.preventDefault();e.target.blur();}
    if(e.key==='Escape'){if(!$('#image-dialog').open){if(!$('#settings').hidden)settings(false);else closePanel();}}
  });
  document.addEventListener('click',e=>{
    if(e.target.closest('a,button,input,textarea,select,img,.question-nav'))return;
    const card=e.target.closest('[data-question]');if(card){state.hideEffects[question(card.dataset.question).id]=true;card.querySelectorAll('.j-choice').forEach(b=>b.classList.remove('selected','correct','wrong'));}
  });
  const blankTarget=t=>!t.closest('a,button,input,textarea,select,img,.wiki-table-wrap,.formula-equation,.question-nav,.panel-head');
  let lastTap=null;
  document.addEventListener('dblclick',e=>{
    if(!saved.gestures||Date.now()<suppressClickUntil||e.target.closest('input,textarea,select'))return;
    if(e.target.closest('.panel-head')&&!e.target.closest('button')){toggleExpand();return;}
    if(blankTarget(e.target)&&e.target.closest('[data-question]')){e.preventDefault();explain(e.target.closest('#linked-panel')?'panel':'main',e.target);}
  });
  let gesture=null,suppressClickUntil=0;
  document.addEventListener('click',e=>{if(Date.now()<suppressClickUntil){e.preventDefault();e.stopImmediatePropagation();}},true);
  document.addEventListener('pointerdown',e=>{
    if(!saved.gestures||e.isPrimary===false||e.pointerType==='mouse')return;
    const area=e.target.closest('.masthead,.lecture-bar,.question-view,#panel-body,.panel-head');
    if(!area||e.target.closest('input,textarea,select,.wiki-table-wrap,.formula-equation,img'))return;
    gesture={x:e.clientX,y:e.clientY,time:performance.now(),area,target:e.target};
  },{passive:true});
  document.addEventListener('pointerup',e=>{
    if(!gesture||!saved.gestures)return;const g=gesture;gesture=null;
    const dx=e.clientX-g.x,dy=e.clientY-g.y,dt=performance.now()-g.time;
    if(dt<1200&&dy>48&&Math.abs(dy)>Math.abs(dx)*1.5&&g.area.matches('.masthead')){settings(true);suppressClickUntil=Date.now()+350;return;}
    if(dt<1500&&Math.abs(dx)>55&&Math.abs(dx)>Math.abs(dy)*1.5){
      if(g.area.matches('.lecture-bar')){const modes=['wiki','j','jbl'],i=modes.indexOf(state.mode)+(dx<0?1:-1);if(modes[i])switchMode(modes[i]);}
      else if(blankTarget(g.target)&&g.target.closest('[data-question],.j-concept'))move(dx<0?1:-1,g.area.id==='panel-body'?'panel':'main');
      suppressClickUntil=Date.now()+350;return;
    }
    const tapKind=g.area.matches('.panel-head')&&!g.target.closest('button')?'panel-header':blankTarget(g.target)&&g.target.closest('[data-question]')?'question':null;
    if(Math.abs(dx)<12&&Math.abs(dy)<12&&dt<350&&tapKind){
      if(lastTap&&lastTap.kind===tapKind&&Date.now()-lastTap.time<330&&Math.hypot(e.clientX-lastTap.x,e.clientY-lastTap.y)<28){
        if(tapKind==='panel-header')toggleExpand();else explain(g.area.id==='panel-body'?'panel':'main',g.target);
        lastTap=null;suppressClickUntil=Date.now()+350;
      }else lastTap={time:Date.now(),x:e.clientX,y:e.clientY,kind:tapKind};
    }
  },{passive:true});
  document.addEventListener('pointercancel',()=>{gesture=null;},{passive:true});
  // Allow native vertical scrolling and pinch zoom; horizontal gestures are only recognized, never globally cancelled.
  $('#settings-button').onclick=()=>settings($('#settings').hidden);$('#settings-backdrop').onclick=()=>settings(false);
  $('#theme-toggle').onclick=()=>{saved.theme=saved.theme==='dark'?'light':'dark';applyPreferences();save();};
  $('#gesture-toggle').onclick=()=>{saved.gestures=!saved.gestures;gesture=null;lastTap=null;applyPreferences();save();};
  $('#font-scale').oninput=e=>{saved.scale=+e.target.value;applyPreferences();save();};
  $('#fold-all').onclick=()=>{
    const nodes=[...$('#study-view').querySelectorAll('.section-content')],fold=nodes.some(n=>!n.hidden);
    nodes.forEach(n=>{n.hidden=fold;const b=n.closest('.wiki-section').querySelector('[data-fold]');b.textContent=fold?'+':'−';b.setAttribute('aria-expanded',String(!fold));});
    $('#fold-all').innerHTML=`<span aria-hidden="true">${fold?'+':'−'}</span> 모든 문단 ${fold?'펴기':'접기'}`;
  };
  $('#recall-bar').onclick=()=>$('#lecture-bar')?.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth'});
  $('#panel-close').onclick=()=>closePanel();$('#panel-expand').onclick=toggleExpand;
  $('#panel-back').onclick=()=>{if(state.panel.length>1){state.panel.pop();renderPanel();}};
  $('#image-close').onclick=()=>$('#image-dialog').close();$('#image-dialog').onclick=e=>{if(e.target===$('#image-dialog'))$('#image-dialog').close();};
  window.addEventListener('hashchange',route);
  window.addEventListener('storage',e=>{if(e.key!==storageKey)return;try{saved={...fresh(),...JSON.parse(e.newValue||'{}')};applyPreferences();syncControls();}catch{}});
  applyPreferences();route();
  if(storageFailed)notice('기록 저장을 사용할 수 없어요. 사이트 학습 기능은 계속 사용할 수 있어요.');
  window.StudyApp={entries:()=>entries().map(e=>({id:e.id,kind:e.kind,number:e.q?.globalNumber,title:e.title})),getState:()=>({cid:state.cid,mode:state.mode,index:state.index}),version:'1.0.0'};
})();
