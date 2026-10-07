// Local fixtures only. API requests are intercepted; external Firebase traffic is blocked.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const BASE=`http://localhost:${process.env.UI_TEST_PORT || '3000'}`;
const widths=[360,390,430,568,640,768,820,1024,1180,1280,1440];
const routes=['/conversations','/friends','/subjects','/preferences','/settings','/ranking','/global-chat','/friends/chat/1000000002','/conversations/group/test-group','/profile/1000000002'];
const output=path.resolve('artifacts/ui');fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce',serviceWorkers:'block'});
const errors=[];const calls=[];let pairingFails=true;
await context.addCookies([{name:'authjs.session-token',value:'local-ui-fixture',url:BASE}]);
await context.routeWebSocket('**/*',(ws)=>{if(new URL(ws.url()).hostname==='localhost')ws.connectToServer();else ws.close();});
await context.route('**/*',async(route)=>{
 const req=route.request(),url=new URL(req.url());if(url.origin!==BASE)return route.abort();
 if(!url.pathname.startsWith('/api/'))return route.continue();
 calls.push({path:url.pathname,method:req.method(),body:req.postData()});
 let body={},status=200;
 if(url.pathname==='/api/account/pairing-code'&&req.method()==='POST'){status=pairingFails?500:200;body=pairingFails?{error:'fixture failure'}:{ok:true,code:'AB12CD34',expiresAtMs:Date.now()+600000};}
 else if(url.pathname==='/api/subjects')body={subjects:[{id:'english',name:'英語',color:'#3b82f6'}]};
 await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
});
await context.addInitScript(()=>{
 const saved=JSON.parse(localStorage.getItem('study-timer-storage')||'{"state":{},"version":0}');
 saved.state={theme:'white',customBgColor:'#6366f1',soundEnabled:false,...saved.state,userProfile:{uid:'1000000001',name:'テストユーザー',avatar:'🎓',dailyGoal:10800,totalPoints:350,badges:[],equippedBadges:[]},subjects:[{id:'english',name:'英語',color:'#3b82f6',icon:'book-open'}],friends:[{uid:'1000000002',name:'学習仲間のとても長い表示名 / StudyFlow',avatar:'📘',addedAt:'2026-10-01T00:00:00.000Z'},{uid:'1000000003',name:'花子',avatar:'🌸',addedAt:'2026-10-01T00:00:00.000Z'}]};
 localStorage.setItem('study-timer-storage',JSON.stringify(saved));
});
const page=await context.newPage();page.on('pageerror',error=>errors.push({route:page.url(),message:error.message}));
const settle=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
const visit=async(route)=>{await page.goto(BASE+route,{waitUntil:'domcontentloaded',timeout:120000});await page.locator('.app-header').waitFor({timeout:120000});await page.waitForFunction(()=>document.documentElement.className.includes('theme-'));await page.addStyleTag({content:'nextjs-portal{display:none}'});await page.waitForFunction(()=>Array.from(document.querySelectorAll('main .glass-card')).every(el=>Number(getComputedStyle(el).opacity)>.95));await settle();};
const noOverflow=async(label)=>{const result=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));if(result.scroll>result.width+1)fs.writeFileSync(path.join(output,'secondary-overflow.json'),JSON.stringify(await page.evaluate(()=>Array.from(document.querySelectorAll('body *')).filter(el=>el.getBoundingClientRect().right>innerWidth+1).map(el=>({tag:el.tagName,class:el.className,text:el.textContent.slice(0,60),rect:el.getBoundingClientRect().toJSON()}))),null,2));assert(result.scroll<=result.width+1,`${label}: ${result.scroll} > ${result.width}`);};
try {
 for(const route of routes){await visit(route);for(const width of widths){await page.setViewportSize({width,height:width<768?844:1024});await settle();await noOverflow(`${route} ${width}`);if([390,820,1440].includes(width)&&routes.indexOf(route)<6){await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(output,route.slice(1).replaceAll('/','-')+'-'+width+'.png'),fullPage:true});}}}
 console.log('PASS: 10 secondary routes × 11 widths without document overflow (external-data detail pages checked in loading/error state)');
 await page.setViewportSize({width:390,height:844});await visit('/conversations');const main=page.locator('main');
 await main.getByRole('link',{name:/学習仲間のとても長い表示名/}).waitFor();
 await page.getByLabel('会話を検索').fill('花子');assert.equal(await main.getByRole('link',{name:/学習仲間のとても長い表示名/}).count(),0);await main.getByRole('link',{name:/花子/}).waitFor();
 await page.getByLabel('会話を検索').fill('存在しない');await main.getByRole('heading',{name:'条件に合う会話がありません'}).waitFor();await page.getByLabel('会話を検索').fill('');
 await main.getByRole('button',{name:'グループ',exact:true}).click();assert.equal(await main.getByRole('button',{name:'グループ',exact:true}).getAttribute('aria-pressed'),'true');await main.getByRole('button',{name:'DM',exact:true}).click();
 const groupButton=main.getByRole('button',{name:'グループ作成',exact:true});await groupButton.click();const group=page.getByRole('dialog',{name:'グループ作成',exact:true});await group.getByLabel('グループ名').fill('新しい学習チーム');const member=group.getByRole('button',{name:'花子をメンバーに選択',exact:true});await member.focus();await page.keyboard.press('Space');assert.equal(await member.getAttribute('aria-pressed'),'true');await page.keyboard.press('Escape');assert(await groupButton.evaluate(el=>document.activeElement===el));await groupButton.click();assert.equal(await group.getByLabel('グループ名').inputValue(),'新しい学習チーム');await noOverflow('group create phone');await page.keyboard.press('Escape');
 await main.getByRole('button',{name:'花子のプロフィール',exact:true}).click();await page.getByRole('dialog',{name:'プロフィール',exact:true}).waitFor();await page.keyboard.press('Escape');
 console.log('PASS: message search/tab, keyboard group selection/draft retention, quick profile dialog');
 await visit('/friends');await page.getByRole('button',{name:'花子とのフレンドを解除',exact:true}).click();const remove=page.getByRole('dialog',{name:'フレンドを解除',exact:true});await remove.getByRole('button',{name:'キャンセル'}).click();assert.equal(await page.getByRole('button',{name:'花子とのフレンドを解除',exact:true}).count(),1);
 await visit('/subjects');await page.getByRole('button',{name:'英語を編集'}).click();const subject=page.getByRole('dialog',{name:'教科を編集'});await subject.getByLabel('教科名').fill('非常に長い教科名を表示するための入力テスト'.repeat(3));const color=subject.getByRole('button',{name:/^教科カラー /}).first();await color.click();assert.equal(await color.getAttribute('aria-pressed'),'true');await noOverflow('subject dialog long name');assert(await subject.evaluate(el=>el.scrollWidth<=el.clientWidth+1),'Subject dialog overflow');await page.keyboard.press('Escape');await page.getByRole('button',{name:'英語を削除'}).click();await page.getByRole('dialog',{name:'教科を削除'}).getByRole('button',{name:'キャンセル'}).click();await page.getByRole('button',{name:'英語を編集'}).waitFor();
 console.log('PASS: friend/subject deletion cancellation; subject editing/color and long-name layout');
 await visit('/preferences');const work=page.getByLabel('集中時間（分）');await work.fill('45');await work.blur();assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('study-timer-storage')).state.pomodoroConfig.workDuration),2700);await work.fill('0');await work.blur();assert.equal(await work.getAttribute('aria-invalid'),'true');assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('study-timer-storage')).state.pomodoroConfig.workDuration),2700);await work.fill('45');await work.blur();await page.getByRole('switch',{name:'タイマーの通知音'}).click();assert.equal(await page.getByRole('switch',{name:'タイマーの通知音'}).getAttribute('aria-checked'),'true');await visit('/preferences');await work.waitFor();assert.equal(await work.inputValue(),'45');
 console.log('PASS: settings persist valid numbers, reject invalid numbers without replacing config, sound switch');
 await visit('/settings');await page.getByLabel('表示名',{exact:true}).fill('');await page.getByRole('button',{name:'アカウント情報を保存'}).click();await page.getByRole('alert').filter({hasText:'表示名は必須です'}).waitFor();assert.equal(await page.getByLabel('表示名',{exact:true}).getAttribute('aria-invalid'),'true');await page.getByRole('button',{name:'コードを発行'}).click();await page.getByText('fixture failure',{exact:true}).waitFor();pairingFails=false;await page.getByRole('button',{name:'コードを発行'}).click();await page.getByText('AB12CD34',{exact:true}).waitFor();await page.getByRole('button',{name:'再発行',exact:true}).waitFor();
 console.log('PASS: required account name and pairing API failure/retry');
 await visit('/ranking');await page.locator('main').getByRole('alert').filter({hasText:'ランキングを読み込めませんでした'}).waitFor();await page.getByRole('button',{name:'ランキングを再読み込み'}).click();await page.getByText('ランキングを読み込み中...',{exact:true}).waitFor();await page.locator('main').getByRole('button',{name:'今週',exact:true}).click();assert.equal(await page.locator('main').getByRole('button',{name:'今週',exact:true}).getAttribute('aria-pressed'),'true');await page.getByLabel('ランキングの教科').selectOption('英語');assert.equal(await page.getByLabel('ランキングの教科').inputValue(),'英語');
 await visit('/profile/1000000002');await page.locator('main').getByRole('alert').filter({hasText:'プロフィールを読み込めませんでした'}).waitFor();await page.getByRole('button',{name:'プロフィールを再読み込み'}).click();await page.locator('main').getByRole('alert').filter({hasText:'プロフィールを読み込めませんでした'}).waitFor();await page.getByRole('button',{name:'プロフィールを再読み込み'}).waitFor();
 console.log('PASS: ranking period/subject control and ranking/profile network-error retry');
 fs.writeFileSync(path.join(output,'secondary-errors.json'),JSON.stringify(errors,null,2));assert.equal(errors.length,0,`Unhandled browser errors: ${errors.map(row=>row.route+' '+row.message.slice(0,300)).join('; ')}`);assert.equal(calls.filter(row=>row.path==='/api/account/delete').length,0);assert.equal(calls.filter(row=>row.path==='/api/account/pairing-code'&&row.method==='POST').length,2);
 fs.writeFileSync(path.join(output,'secondary-verification.json'),JSON.stringify({passed:true,widths,routes,errors,apiCalls:calls,externalDataDetails:'loading/error only'},null,2));console.log('PASS: no unhandled browser errors; Firebase writes blocked; account deletion never invoked');
} catch(error){await page.screenshot({path:path.join(output,'secondary-failure.png'),fullPage:true});throw error;} finally {await browser.close();}
