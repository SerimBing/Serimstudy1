(() => {
 let current=1;const $=s=>document.querySelector(s);
 function show(){current=Math.max(1,Math.min(50,Number(location.hash.match(/p=(\d+)/)?.[1])||1));$('#page').value=current;$('#scan').src=`assets/pages/${String(current).padStart(2,'0')}.webp`;$('#scan').alt=`강의록 PDF ${current}쪽`;$('#text').textContent=window.SOURCE_PAGES[current-1].text;$('#prev').disabled=current===1;$('#next').disabled=current===50;document.title=`PDF ${current}쪽 · 인사행정론`;}
 function go(n){location.hash=`p=${Math.max(1,Math.min(50,Number(n)||1))}`;window.scrollTo(0,0);}
 $('#prev').onclick=()=>go(current-1);$('#next').onclick=()=>go(current+1);$('#page').onchange=e=>go(e.target.value);$('#page').onkeydown=e=>{if(e.key==='Enter')go(e.target.value)};
 function search(){const term=$('#reader-search').value.trim();$('#hits').replaceChildren();if(!term)return;const matches=window.SOURCE_PAGES.filter(p=>p.text.includes(term));$('#hits').append(document.createTextNode(`${matches.length}개 페이지: `));for(const p of matches){let a=document.createElement('a');a.href=`#p=${p.page}`;a.textContent=`${p.page}쪽`;$('#hits').append(a);}}
 $('#search').onclick=search;$('#reader-search').onkeydown=e=>{if(e.key==='Enter')search()};window.addEventListener('hashchange',show);show();
})();
