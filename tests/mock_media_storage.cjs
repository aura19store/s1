const http=require('node:http');const objects=new Set();let fail=false;let failAfter=false;let deletes=0;
http.createServer(async(req,res)=>{let chunks=[];for await(const c of req)chunks.push(c);let body={};try{body=JSON.parse(Buffer.concat(chunks).toString()||'{}')}catch{}
 const send=(code,data)=>{res.writeHead(code,{'content-type':'application/json'});res.end(JSON.stringify(data))};
 if(req.url==='/control'){if(body.reset){objects.clear();deletes=0;fail=false;failAfter=false}if(body.add)objects.add(body.add);if(typeof body.fail==='boolean')fail=body.fail;if(typeof body.failAfter==='boolean')failAfter=body.failAfter;return send(200,{objects:[...objects],deletes})}
 const info='/storage/v1/object/info/aura-media/';if(req.method==='GET'&&req.url.startsWith(info)){let p=decodeURIComponent(req.url.slice(info.length));return objects.has(p)?send(200,{name:p}):send(404,{statusCode:'404',error:'not_found',message:'not found'})}
 if(req.method==='DELETE'&&req.url==='/storage/v1/object/aura-media'){deletes++;if(fail)return send(500,{statusCode:'500',message:'simulated error'});for(const p of body.prefixes||[])objects.delete(p);if(failAfter)return send(500,{statusCode:'500',message:'simulated lost result'});return send(200,[])}
 send(404,{message:'not found'});
}).listen(35417,'127.0.0.1');
