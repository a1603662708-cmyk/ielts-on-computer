import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve('out');const port=Number(process.env.PORT||4173);
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.m4a':'audio/mp4','.mp3':'audio/mpeg','.wav':'audio/wav','.txt':'text/plain','.woff2':'font/woff2'};
http.createServer(async(req,res)=>{
 try{const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);let file=path.resolve(root,'.'+pathname);if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403).end();return;}
  if((await stat(file)).isDirectory())file=path.join(file,'index.html');const data=await readFile(file);const type=mime[path.extname(file)]||'application/octet-stream';
  const range=req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);if(range){const start=Number(range[1]);const end=range[2]?Math.min(Number(range[2]),data.length-1):data.length-1;if(start> end){res.writeHead(416).end();return;}res.writeHead(206,{'Content-Type':type,'Content-Range':`bytes ${start}-${end}/${data.length}`,'Accept-Ranges':'bytes','Content-Length':end-start+1});res.end(data.subarray(start,end+1));return;}
  res.writeHead(200,{'Content-Type':type,'Content-Length':data.length,'Accept-Ranges':'bytes','Cache-Control':'no-cache'});res.end(data);
 }catch{res.writeHead(404).end('Not found. Run npm run build before starting the local simulator.');}
}).listen(port,'127.0.0.1',()=>console.log(`IELTS Simulator: http://127.0.0.1:${port}`));
