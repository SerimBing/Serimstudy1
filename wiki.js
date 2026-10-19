/* Small, escaped Wiki renderer. Content never executes as HTML or JavaScript. */
(() => {
  'use strict';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const key = s => String(s).replace(/'''|""|~~~/g,'').trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'-').replace(/^-|-$/g,'');
  const courses = () => window.STUDY_COURSES || [];
  const questions = () => window.JBL_DATA?.questions || [];
  const source = id => window.LECTURE_NOTE_SOURCES?.[id] || '';
  const headings = text => [...String(text).matchAll(/^(={2,4})\s+(.+?)\s+\1\s*$/gm)].map(m=>({level:m[1].length,title:m[2],slug:key(m[2]),index:m.index}));
  let serial=0;
  function imagePath(value){
    const p=String(value||'').trim().replace(/^\.\//,'');
    return /^(assets|J)\//.test(p)&&!p.split('/').includes('..')&&!/[\\:"<>]/.test(p)?p:'';
  }
  function inline(text,cid,fn,depth=0){
    if(depth>8)return esc(text);
    const re=/'''([\s\S]*?)'''|""([\s\S]*?)""|\[\[((?:[^\]]|\](?!\]))+)\]\]|\{\{(\d+)\}\}|\[\*([^\]]+)\]|~~([^~]+)~~~/g;
    let out='',last=0;
    for(const m of String(text).matchAll(re)){
      out+=esc(String(text).slice(last,m.index));
      if(m[1]!=null)out+='<strong>'+inline(m[1],cid,fn,depth+1)+'</strong>';
      else if(m[2]!=null)out+='<strong class="wiki-highlight">'+inline(m[2],cid,fn,depth+1)+'</strong>';
      else if(m[3]!=null){
        const [target,...labels]=m[3].split('|'),label=labels.join('|')||target;
        if(/^원문:([1-9]|[1-4][0-9]|50)$/.test(target))out+=`<a class="wiki-link source-link" href="reader.html#p=${Number(target.split(':')[1])}" target="_blank" rel="noopener">${esc(label)} ↗</a>`;
        else if(/^https?:\/\//i.test(target))out+=`<a class="wiki-link" href="${esc(target)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`;
        else{
          const split=target.indexOf('#'),doc=(split<0?target:target.slice(0,split)).trim(),section=split<0?'':target.slice(split+1).trim();
          const course=!doc?courses().find(c=>c.id===cid):courses().find(c=>doc===`${c.id}강`||doc===c.title);
          const heading=section&&course?headings(source(course.id)).find(h=>h.title===section||h.slug===section):null;
          out+=course&&(!section||heading)?`<a class="wiki-link" href="#lecture-${course.id}" data-doc="${course.id}" data-section="${esc(heading?.slug||'')}">${esc(label)}</a>`:`<span class="missing-link" title="연결 대상 확인 필요">${esc(label)}</span>`;
        }
      }else if(m[4]!=null){
        const n=Number(m[4]);out+=questions().some(q=>q.globalNumber===n)?`<a class="j-link" href="#q-${n}" data-q="${n}">${n}번 문항</a>`:`<span class="missing-link">${n}번 문항</span>`;
      }else if(m[5]!=null){
        const body=m[5],named=!/^\s/.test(body),parts=body.trim().split(/\s+/),name=named?parts.shift():'';
        let item=name?fn.items.find(i=>i.name===name):null;
        if(!item){item={name,text:named?(parts.join(' ')||'각주 내용 확인 필요'):body.trim(),number:fn.items.length+1};fn.items.push(item);}
        out+=`<sup><a class="footnote-link" href="#${fn.prefix}-${item.number}" data-footnote="${fn.prefix}-${item.number}" title="${esc(item.text)}">[${item.number}]</a></sup>`;
      }else out+='<span class="wiki-muted">'+inline(m[6],cid,fn,depth+1)+'</span>';
      last=m.index+m[0].length;
    }
    return out+esc(String(text).slice(last));
  }
  function render(text,cid,{fragment=false}={}){
    const fn={prefix:'fn-'+(++serial),items:[]},lines=String(text).replace(/\r\n?/g,'\n').split('\n'),out=[];
    let section=false,sub=false,paragraph=[];
    const flush=()=>{if(paragraph.length){out.push('<p>'+inline(paragraph.join(' '),cid,fn)+'</p>');paragraph=[];}};
    const closeSub=()=>{if(sub){out.push('</div>');sub=false;}};
    const closeSection=()=>{closeSub();if(section){out.push('</div></section>');section=false;}};
    for(let i=0;i<lines.length;i++){
      const line=lines[i].trim();
      if(!line){flush();continue;}
      const title=line.match(/^= (.+) =$/),heading=line.match(/^(={2,4})\s+(.+?)\s+\1$/);
      if(title){flush();if(!fragment)out.push('<h2>'+inline(title[1],cid,fn)+'</h2>');continue;}
      if(line.startsWith('@summary ')){flush();out.push('<div class="wiki-summary">'+inline(line.slice(9),cid,fn)+'</div>');continue;}
      if(line.startsWith('@tag '))continue;
      if(heading){
        flush();closeSub();const level=heading[1].length,h=heading[2],slug=key(h);
        if(level===2){closeSection();out.push(`<section class="wiki-section" data-heading="${esc(slug)}"><div class="section-head"><h3>${inline(h,cid,fn)}</h3>${fragment?'':`<div class="section-actions"><button data-fold aria-label="${esc(h)} 접기" aria-expanded="true">−</button><button data-bookmark="w:${cid}:${esc(slug)}" aria-label="${esc(h)} 즐겨찾기" aria-pressed="false">☆</button></div>`}</div><div class="section-content">`);section=true;}
        else if(level===3)out.push(`<h4 data-heading="${esc(slug)}">${inline(h,cid,fn)}</h4>`);
        else{out.push(`<div class="wiki-subsection"><h5 data-heading="${esc(slug)}">${inline(h,cid,fn)}</h5>`);sub=true;}
        continue;
      }
      if(line.startsWith('@formula ')){
        flush();const [label,equation,...note]=line.slice(9).split('|');
        if(!equation){out.push('<p class="missing-link">공식 문법 확인 필요</p>');continue;}
        const math=esc(equation.trim()).replace(/_\{([^{}]+)\}/g,'<sub>$1</sub>').replace(/\^\{([^{}]+)\}/g,'<sup>$1</sup>');
        out.push(`<div class="wiki-formula"><div class="formula-label">${esc(label.trim())}</div><div class="formula-equation">${math}</div><div class="formula-note">${inline(note.join('|').trim(),cid,fn)}</div></div>`);continue;
      }
      if(line.startsWith('||')&&line.endsWith('||')){
        flush();const rows=[];while(i<lines.length&&lines[i].trim().startsWith('||')&&lines[i].trim().endsWith('||'))rows.push(lines[i++].trim().slice(2,-2).split('||').map(s=>s.trim()));i--;
        const header=rows[0].every(s=>s.startsWith('=')),renderRow=(r,head)=>'<tr>'+r.map(cell=>`<${head?'th scope="col"':'td'}>${inline(head?cell.replace(/^=\s*/,''):cell,cid,fn)}</${head?'th':'td'}>`).join('')+'</tr>';
        out.push(`<div class="wiki-table-wrap" tabindex="0" role="region" aria-label="비교표"><table class="wiki-table">${header?'<thead>'+renderRow(rows.shift(),true)+'</thead>':''}<tbody>${rows.map(r=>renderRow(r,false)).join('')}</tbody></table></div>`);continue;
      }
      const fig=line.match(/^\[\[파일:([^|\]]+)(?:\|([^\]]*))?\]\]$/);
      if(fig){flush();const src=imagePath(fig[1]),caption=fig[2]||'';out.push(src?`<figure class="wiki-figure"><img src="${esc(src)}" alt="${esc(caption)}" data-zoom loading="lazy"><figcaption>${inline(caption,cid,fn)}</figcaption></figure>`:'<p class="missing-link">허용되지 않는 이미지 경로</p>');continue;}
      if(line.startsWith('* ')||line.startsWith('# ')){
        flush();const marker=line.slice(0,2),tag=marker==='* '?'ul':'ol',items=[];
        while(i<lines.length&&lines[i].trim().startsWith(marker))items.push(inline(lines[i++].trim().slice(2),cid,fn));i--;
        out.push(`<${tag}>${items.map(s=>'<li>'+s+'</li>').join('')}</${tag}>`);continue;
      }
      if(line.startsWith('> ')){
        flush();const parts=[line.slice(2)];
        while(i+1<lines.length&&lines[i+1].trim()&&!/^(?:={1,4} |@|\|\||\[\[파일:|[*#] )/.test(lines[i+1].trim()))parts.push(lines[++i].trim().replace(/^> /,''));
        out.push('<blockquote class="wiki-callout">'+inline(parts.join(' '),cid,fn)+'</blockquote>');continue;
      }
      paragraph.push(line);
    }
    flush();closeSection();
    if(fn.items.length)out.push('<section class="footnotes"><strong>각주</strong><ol>'+fn.items.map(f=>`<li id="${fn.prefix}-${f.number}">${esc(f.text)}</li>`).join('')+'</ol></section>');
    return `<article class="${fragment?'fragment':'wiki-note'}" data-document="${cid}">${out.join('')}</article>`;
  }
  function entries(cid){
    const text=source(cid),hs=headings(text).filter(h=>h.level===2||h.level===3),assigned=questions().filter(q=>q.lectureIds.includes(cid)),seen=new Set(),items=[];
    function addConcept(id,title,content){
      if(!content.trim())return;
      items.push({kind:'wiki',id:`concept:${cid}:${id}`,title,source:content,cid});
      const numbers=[...content.matchAll(/\{\{(\d+)\}\}/g)].map(m=>+m[1]);
      for(const n of numbers){const q=assigned.find(q=>q.globalNumber===n);if(q&&!seen.has(q.id)){items.push({kind:'question',id:q.id,q});seen.add(q.id);}}
    }
    addConcept('intro','강의 한눈에 보기',hs.length?text.slice(0,hs[0].index):text);
    let prefix='';
    for(let i=0;i<hs.length;i++){
      const h=hs[i],content=text.slice(h.index,hs[i+1]?.index??text.length);
      // Keep section introductions too. A bare section heading travels with its next card.
      if(h.level===2&&!content.replace(/^.*(?:\r?\n|$)/,'').trim()){prefix+=content;continue;}
      addConcept(h.slug,h.title,prefix+content);prefix='';
    }
    if(prefix.trim())addConcept('closing','마무리',prefix);
    const remaining=assigned.filter(q=>!seen.has(q.id));
    if(remaining.length){
      items.push({kind:'wiki',id:`concept:${cid}:unlinked`,title:'종합·추가 문항',source:'=== 종합·추가 문항 ===\n앞선 개념 카드에 직접 배속되지 않은 문항이다. 여러 개념을 함께 적용하거나, 원자료의 추가 확인이 필요한 경우다. 각 문항의 해설에서 필요한 범위와 확인할 자료를 살펴보자.',cid});
      remaining.forEach(q=>items.push({kind:'question',id:q.id,q}));
    }
    return items;
  }
  window.StudyWiki={esc,key,imagePath,headings,render,entries,inline:(text,cid)=>inline(text,cid,{prefix:'inline-'+(++serial),items:[]})};
})();
