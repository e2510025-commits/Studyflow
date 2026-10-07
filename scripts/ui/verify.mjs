/* Run only against the isolated local UI server. All API calls are mocked and
 * external HTTP/WebSocket traffic is blocked before application code runs. */
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const BASE = 'http://localhost:3000';
const widths = [360,390,430,768,820,1024,1180,1280,1440];
const output = path.resolve('artifacts/ui');
fs.mkdirSync(output, { recursive: true });
const deck = { id:'test-deck', name:'英検2級の単語', description:'長い説明も読みやすく表示します。', color:'#7c83ff', cardCount:12, dueCount:4, masteredCount:8, subjectId:'english', createdAt:new Date().toISOString() };

(async () => {
 const browser = await chromium.launch({ headless:true });
 const context = await browser.newContext({ viewport:{width:390,height:844}, reducedMotion:'reduce',serviceWorkers:'block' });
 const errors=[]; const calls=[]; let decksMode='success'; let mutationFails=true;
 await context.addCookies([{name:'authjs.session-token', value:'local-ui-fixture',url:BASE}]);
 await context.routeWebSocket('**/*', async (ws) => {
   if (new URL(ws.url()).hostname === 'localhost') ws.connectToServer(); else ws.close();
 });
 await context.route('**/*', async (route) => {
   const request=route.request(), url=new URL(request.url());
   if(url.origin!==BASE) return route.abort();
   if (!url.pathname.startsWith('/api/')) return route.continue();
   calls.push({path:url.pathname,method:request.method(),body:request.postData()});
   let body={},status=200;
   if(url.pathname==='/api/auth/session') body={};
   else if(url.pathname==='/api/subjects') body={subjects:[{id:'english',name:'英語',color:'#3b82f6'}]};
   else if(url.pathname==='/api/memorize/decks' && request.method()==='GET') {
     body={decks:decksMode==='empty'?[]:[deck],totalDue:decksMode==='empty'?0:4};
     if(decksMode==='error'){status=500;body={error:'fixture error'};}
   } else if (url.pathname.startsWith('/api/memorize/decks') && request.method()!=='GET') {
     status=mutationFails?500:200;body=status===500?{error:'fixture error'}:{success:true,deckId:'test-deck'};
     if(status===200 && request.method()==='PATCH') deck.name=JSON.parse(request.postData()).name;
     if(status===200 && request.method()==='DELETE') decksMode='empty';
   } else if(url.pathname==='/api/memorize/decks/test-deck') body={deck,cards:[]};
   await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
 });
 await context.addInitScript(() => {
   if(!localStorage.getItem('study-timer-storage')) localStorage.setItem('study-timer-storage',JSON.stringify({state:{theme:'white',customBgColor:'#6366f1',soundEnabled:false,userProfile:{uid:'1000000001',name:'長い名前のテストユーザー / StudyFlow',avatar:'🎓',dailyGoal:7200,totalPoints:0,badges:[],equippedBadges:[]},subjects:[{id:'english',name:'英語',color:'#3b82f6',icon:'📘'}]},version:0}));
 });
 const page=await context.newPage(); page.on('pageerror',(e)=>errors.push(e.message));
 const visit=async(route)=>{await page.goto(BASE+route,{waitUntil:'domcontentloaded',timeout:120000});await page.locator('.app-header').waitFor({timeout:120000}); await page.waitForFunction(() => Array.from(document.documentElement.classList).some((name) => name.startsWith('theme-'))); await page.addStyleTag({content:'nextjs-portal { display: none; }'}); await page.waitForFunction(() => Array.from(document.querySelectorAll('main .glass-card, main .timer-mode-tabs')).every((el) => Number(getComputedStyle(el).opacity) > 0.95), {timeout:30000});};
 const noOverflow=async(label)=>{const size=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));if(size.scroll>size.width+1) {fs.writeFileSync(path.join(output,'overflow.json'),JSON.stringify(await page.evaluate(()=>Array.from(document.querySelectorAll('body *')).filter(el=>el.getBoundingClientRect().right>innerWidth+1).map(el=>({tag:el.tagName,class:el.className,text:el.textContent.slice(0,60),right:el.getBoundingClientRect().right,width:el.getBoundingClientRect().width}))),null,2));}assert(size.scroll<=size.width+1,`${label}: document width ${size.scroll} > ${size.width}`);};
 try {
  for(const route of ['/', '/timer', '/memorize', '/timeline']) {
   await visit(route);
   for(const width of widths){await page.setViewportSize({width,height:width<768?844:1024});await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));await noOverflow(`${route} ${width}`); if([390,820,1440].includes(width)) {await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:path.join(output,`${route==='/'?'home':route.slice(1)}-${width}.png`),fullPage:true});}}
  }
  console.log('PASS: 4 primary pages × 9 widths without document overflow');
  await page.setViewportSize({width:390,height:844}); await visit('/');
  const more=page.getByRole('button',{name:'その他',exact:true}).filter({visible:true});
  await more.click(); const menu=page.getByRole('dialog',{name:'その他',exact:true});await menu.waitFor();
  assert.equal(await menu.getByRole('link',{name:/実績|掲示板/}).count(),0);
  await page.keyboard.press('Shift+Tab');assert(await page.evaluate(()=>document.querySelector('dialog[open]').contains(document.activeElement)));
  await page.keyboard.press('Escape');assert.equal(await menu.isVisible(),false);assert(await more.evaluate((el)=>el===document.activeElement));
  assert.equal(await page.evaluate(()=>document.body.style.overflow),'');
  const account=page.getByRole('button',{name:'アカウントメニューを開く'});await account.click();
  const accountDialog=page.getByRole('dialog',{name:'アカウント',exact:true});await accountDialog.locator('summary').click();
  for(const name of ['グレー','ダーク','ホワイト']){await accountDialog.getByRole('button',{name,exact:true}).click();assert.equal(await accountDialog.getByRole('button',{name,exact:true}).getAttribute('aria-pressed'),'true');}
  await accountDialog.getByLabel('カラーコード').fill('#14b8a6');await accountDialog.getByRole('button',{name:'適用する'}).click();assert(await accountDialog.getByRole('status').isVisible());
  await accountDialog.getByRole('button',{name:'ホワイト',exact:true}).click();await page.keyboard.press('Escape');assert(await account.evaluate((el)=>el===document.activeElement));
  console.log('PASS: menu focus trap/return, Escape, scroll restoration and 4 themes');
  const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'画像を保存'}).click();const download=await downloadPromise;await download.saveAs(path.join(output,'weekly-share.png'));assert((await download.failure())===null);
  await visit('/memorize'); await page.getByRole('link',{name:deck.name,exact:true}).waitFor();
  await page.getByRole('button',{name:`${deck.name}をお気に入り`}).click();await page.getByRole('button',{name:'お気に入り',exact:true}).click();assert.equal(await page.locator('article').count(),1);
  await page.getByLabel('単語帳を検索').fill('存在しない');await page.getByRole('heading',{name:'条件に合う単語帳がありません'}).waitFor();await page.getByLabel('単語帳を検索').fill('');
  await page.getByRole('button',{name:`${deck.name}のメニュー`}).click();const edit=page.getByRole('dialog',{name:'単語帳の編集'});
  await edit.getByRole('textbox',{name:'名前',exact:true}).fill('変更後の名前');await edit.getByRole('button',{name:'名前を保存'}).click();await edit.getByRole('alert').waitFor();assert.equal(await edit.getByRole('textbox').inputValue(),'変更後の名前');
  mutationFails=false;await edit.getByRole('button',{name:'名前を保存'}).click();await edit.waitFor({state:'hidden'});await page.getByRole('link',{name:'変更後の名前',exact:true}).waitFor();
  await page.getByRole('button',{name:'新しい単語帳',exact:true}).click();const create=page.getByRole('dialog',{name:'新しい単語帳'});await create.getByRole('textbox').fill('新しいテスト単語帳');mutationFails=true;await create.getByRole('button',{name:'作成する'}).click();await create.getByRole('alert').waitFor();assert.equal(await create.getByRole('textbox').inputValue(),'新しいテスト単語帳');await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'変更後の名前のメニュー'}).click();await edit.getByRole('button',{name:'単語帳を削除'}).click();await edit.getByRole('button',{name:'削除を確定'}).click();await edit.getByRole('alert').waitFor();assert(await edit.isVisible());mutationFails=false;await edit.getByRole('button',{name:'削除を確定'}).click();await edit.waitFor({state:'hidden'});await page.getByRole('heading',{name:'最初の単語帳を作りましょう'}).waitFor();
  decksMode='error';await visit('/memorize');await page.locator('main').getByRole('alert').waitFor();assert.equal(await page.getByRole('heading',{name:'最初の単語帳を作りましょう'}).count(),0);decksMode='success';await page.getByRole('button',{name:'再読み込み'}).click();await page.locator('article').waitFor();
  const patch=calls.find((r)=>r.method==='PATCH');assert.equal(JSON.parse(patch.body).name,'変更後の名前');const post=calls.find((r)=>r.method==='POST'&&r.path==='/api/memorize/decks');assert.equal(JSON.parse(post.body).name,'新しいテスト単語帳');
  console.log('PASS: memorize search/favorites, error vs empty, POST/PATCH/DELETE contracts and retry/input retention');
  await visit('/timer');for(const mode of ['カウントダウン','ポモドーロ','ストップウォッチ']){await page.getByRole('button',{name:mode,exact:true}).click();}
  await page.getByRole('button',{name:'英語',exact:false}).first().click();await page.getByRole('button',{name:'学習を開始',exact:true}).click();await page.getByRole('button',{name:'一時停止',exact:true}).waitFor();
  await more.click();await page.keyboard.press('Escape');await page.getByRole('button',{name:'一時停止',exact:true}).waitFor();
  await page.getByRole('button',{name:'一時停止',exact:true}).click();await page.getByRole('button',{name:'学習を再開',exact:true}).waitFor();await page.getByRole('button',{name:'学習を再開',exact:true}).click();await page.getByRole('button',{name:'一時停止',exact:true}).waitFor();
  await page.getByRole('button',{name:'集中モードを開く',exact:true}).click();await page.getByRole('button',{name:'集中モードを終了',exact:true}).waitFor();await noOverflow('timer focus phone');await page.getByRole('button',{name:'集中モードを終了',exact:true}).click();
  await page.getByRole('navigation',{name:'モバイルナビゲーション'}).getByRole('link',{name:'ホーム',exact:true}).click();await page.getByText('学習を計測中',{exact:true}).waitFor();
  console.log('PASS: timer mode, start/pause/resume/focus, menu Escape and active timer on home');
  await visit('/timeline');await page.getByRole('button',{name:'投稿する',exact:true}).click();const composer=page.getByRole('dialog',{name:'新しい投稿'});await composer.waitFor();await composer.getByRole('textbox').fill('テスト投稿');await page.keyboard.press('Escape');assert.equal(await composer.isVisible(),false);
  console.log('PASS: timeline composer text entry and cancellation');
  for(const route of ['/achievements','/bulletin']){await visit(route);await page.getByRole('heading',{name:/提供を終了しました/}).waitFor();}
  await page.evaluate(() => {const saved=JSON.parse(localStorage.getItem('study-timer-storage'));saved.state.subjects=[{id:'english',name:'英語',color:'#3b82f6',icon:'book-open'}];saved.state.studyLogs=[{id:'local-log',subjectId:'english',duration:1500,memo:'学習記録のテスト',points:25,createdAt:new Date().toISOString()}];localStorage.setItem('study-timer-storage',JSON.stringify(saved));});
  await visit('/');await page.getByText('学習記録のテスト',{exact:true}).waitFor();await page.getByRole('button',{name:'月間',exact:true}).click();await page.getByRole('button',{name:'年間',exact:true}).click();await page.getByRole('button',{name:'全期間',exact:true}).click();await page.getByRole('button',{name:'週間',exact:true}).click();
  for(const width of [390,820,1440]){await page.setViewportSize({width,height:1024});await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await noOverflow('populated home '+width);await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:path.join(output,'home-populated-'+width+'.png'),fullPage:true});}
  await page.getByRole('button',{name:'縦長',exact:true}).click();const storyDownload=page.waitForEvent('download');await page.getByRole('button',{name:'画像を保存'}).click();await (await storyDownload).saveAs(path.join(output,'weekly-share-story.png'));const png=fs.readFileSync(path.join(output,'weekly-share-story.png'));assert.equal(png.readUInt32BE(16),1080);assert.equal(png.readUInt32BE(20),1920);
  console.log('PASS: home with study record, 4 chart periods and square/story image export');
  assert.deepEqual(errors,[],`Unhandled browser errors: ${errors.join('; ')}`);
  fs.writeFileSync(path.join(output,'verification.json'),JSON.stringify({widths,routes:['/','/timer','/memorize','/timeline'],apiCalls:calls,errors,passed:true},null,2));
  console.log('PASS: retired route notices; no unhandled browser errors. External services blocked.');
 } catch(error) { await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:path.join(output,'failure.png'),fullPage:true});fs.writeFileSync(path.join(output,'failure-calls.json'),JSON.stringify(calls,null,2));throw error; } finally {await browser.close();}
})().catch((error)=>{console.error(error);process.exitCode=1;});
