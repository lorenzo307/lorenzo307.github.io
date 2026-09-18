const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.woff2':'font/woff2','.woff':'font/woff','.ttf':'font/ttf','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.ico':'image/x-icon'};
function createServer(options={}){return http.createServer((req,res)=>{
 try{const url=new URL(req.url,'http://localhost');const name=decodeURIComponent(url.pathname);const file=path.resolve(root,'.'+(name==='/'?'/index.html':name));
  if(!file.startsWith(root+path.sep)||name.split('/').some(p=>p.startsWith('.')||p==='node_modules')){res.writeHead(403);res.end('Forbidden');return;}
  const type=types[path.extname(file)];if(!type){res.writeHead(404);res.end('Not found');return;}
  fs.stat(file,(err,stat)=>{if(err||!stat.isFile()){res.writeHead(404);res.end('Not found');return;}
   if(options.demo&&path.extname(file)==='.html'){
    let html=fs.readFileSync(file,'utf8').replace(/<script\b[^>]*src=["']https:\/\/www\.gstatic\.com\/firebasejs\/[^"']+["'][^>]*>\s*<\/script>/gi,'');
    html=html.replace('<head>','<head><script src="/tests/demo-fixture.js"></script>');
    html=html.replace('<body>','<body><div style="position:fixed;bottom:6px;left:6px;z-index:9999;background:#202020;color:#fff;padding:4px 7px;border-radius:4px;font:10px sans-serif;pointer-events:none;max-width:calc(100vw - 12px)">示例预览</div>');
    res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store','Content-Security-Policy':"connect-src 'self' data: blob:"});res.end(html);return;
   }
   res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store'});fs.createReadStream(file).pipe(res);
  });
 }catch{res.writeHead(400);res.end('Bad request');}
});}
if(require.main===module){const demo=process.argv.includes('--demo');const port=Number(process.env.PORT)||(demo?8766:8765);createServer({demo}).listen(port,'127.0.0.1',()=>console.log(`Research workspace${demo?' (sample data)':''}: http://127.0.0.1:${port}`));}
module.exports={createServer};
