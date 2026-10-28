const { chromium } = require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES ? process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES + '/playwright' : 'playwright');
const { createServer } = require('node:http');
const { readFile, mkdir } = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
(async () => {
  const { makeHandler } = await import('../production/lib/waitlist.js');
  const records = new Map();
  const storage = { async create(k,v) { if(records.has(k))return false; records.set(k,v);return true; }, async read(k) { return records.get(k); } };
  const handler = makeHandler({ storage, secret:'local-testing-secret-'.repeat(3), local:true });
  const server = createServer(async(req,res)=>{
    if(req.url.startsWith('/api/waitlist')) {
      let body='';for await(const chunk of req)body+=chunk;
      try{req.body=body?JSON.parse(body):undefined;}catch{res.writeHead(400);res.end('{}');return;}
      res.status=n=>{res.statusCode=n;return res;};res.json=data=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));};
      return handler(req,res);
    }
    const pathname=new URL(req.url,'http://localhost').pathname;
    try {
      const file=path.resolve(__dirname,'../production',pathname==='/'?'index.html':'.'+pathname);
      if(!file.startsWith(path.resolve(__dirname,'../production')+'/'))throw new Error();
      const contents=await readFile(file);res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(contents);
    }catch{res.writeHead(404);res.end('Not found');}
  });
  await new Promise(resolve=>server.listen(4173,'0.0.0.0',resolve));
  const browser = await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox']});
  const results=[];
  try {
    for(const width of [320,390,768,1440]) {
      const page=await browser.newPage({viewport:{width,height:900},deviceScaleFactor:1});
      const logs=[];page.on('console',message=>logs.push(message.text()));
      await page.goto('http://localhost:4173/#waitlist');
      const metrics=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
      assert.ok(metrics.scroll<=metrics.width,`overflow at ${width}`);
      await page.locator('button[type="submit"]').click();
      assert.match(await page.locator('#form-status').innerText(),/required/);
      await page.locator('#first_name').fill('Synthetic');await page.locator('#last_name').fill('QA');
      await page.locator('#email').fill(`mobile-${width}@example.com`);await page.locator('#business_type').selectOption('grooming');
      await page.locator('#monthly_customers').selectOption('26–100');
      await page.locator('button[type="submit"]').click();assert.match(await page.locator('#form-status').innerText(),/agree/);
      await page.locator('#consent').check();
      // Prove a provider/server error cannot reset data or display success.
      await page.route('**/api/waitlist',async route=>route.request().method()==='POST'?route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({code:'temporarily_unavailable'})}):route.continue());
      await page.locator('button[type="submit"]').click();await page.waitForFunction(()=>document.getElementById('form-status').textContent.includes('could not confirm'));
      assert.equal(await page.locator('#email').inputValue(),`mobile-${width}@example.com`);
      assert.equal(await page.locator('button[type="submit"]').isEnabled(),true);
      await page.unroute('**/api/waitlist');
      await page.locator('button[type="submit"]').click();await page.waitForFunction(()=>document.getElementById('form-status').textContent.includes('Application received'));
      assert.equal(await page.locator('#email').inputValue(),'');
      assert.ok(!logs.some(s=>s.includes(`mobile-${width}@example.com`)));
      if(width===390){await mkdir(path.resolve(__dirname,'../test-results'),{recursive:true});await page.locator('#waitlist').screenshot({path:path.resolve(__dirname,'../test-results/mobile.png')});}
      results.push({width,overflow:false,validation:true,consent:true,errorRetainsData:true,successfulRetry:true});await page.close();
    }
    console.log(JSON.stringify({browser:'Chromium',results,storedApplications:[...records.keys()].filter(k=>k.startsWith('applications/')).length},null,2));
  } finally {await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
