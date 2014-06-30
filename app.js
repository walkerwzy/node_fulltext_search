#!/usr/bin/env node

var	http = require('http'),
	url = require('url'),
	fs = require('fs'),
	path = require('path'),
	zlib = require('zlib'),
	exec = require('child_process').exec,
	program = require('commander'),
	timeout = 10000; // timeout in ms for a single search

require('buffertools').extend();

program
	.version('0.0.1')
	.option('-p, --port [9800]', 'listening on this port', 9800)
	.option('-d, --dir [cwd]', 'root directory', process.cwd())
	.option('-f, --filter [log]', 'file search key words', 'log')
	.parse(process.argv);

var PORT = program.port,
	root = program.dir,
	kws = program.filter;

var server = http.createServer(function (req, resp) {
  // the second param says that the query shall be evaluated
  var query = url.parse(req.url, true).query;
  // ensure both are != null or ''
  if (!query || !query.admin) resp.end('success');
  if (query.download){
  	var file = query.download,
  		stream = fs.createReadStream(file),
  		acceptEncoding = req.headers['accept-encoding'] || "";
  	if(/\bgzip\b/gi.test(acceptEncoding)){
  		resp.setHeader("Content-Encoding", "gzip");
  		stream = stream.pipe(zlib.createGzip());
  	}else if(/\bdeflate\b/gi.test(acceptEncoding)){
  		resp.setHeader("Content-Encoding", "deflate");
  		stream = stream.pipe(zlib.createDeflate());
  	}
  	resp.on('error', function(err) {
	  stream.end();
	});
  	resp.writeHead(200,{
  		"Server": "Node/walker",
  		"Content-Type": "text/plain",
  		// "Content-Length": stat.size,
  		"Content-disposition": "attachment; filename="+path.basename(file)
  	});
  	stream.pipe(resp);
  	resp.end();
  }
  else if (query.s) {
    // replace single with double quotes
    query.s = query.s.replace("'", '"');

    // use find cmd, or you can use readdir instead, but find with grep can filter files with keywords quickly
    var cmd = "find " + root + " -iname '*" + kws + "*' | xargs grep '" + query.s + "' -isl";
    console.log(cmd);
    exec(cmd,
		{
			// cwd: root,
			timeout: timeout
		},
		function (err, stdout, stderr) {
			resp.writeHead(200, {'Server': 'Node/walker', 'Content-Type': 'text/html; charset=utf-8' });
			if (err) {
				console.error(err);
			}
			console.log(stdout);
			var results = stdout.split('\n'),
				key = query.s,
				offset = parseInt(query.offset || 200, 10),
				pre = parseInt(query.pre || 200, 10);
			// remove last element (it’s an empty line)
			results.pop();

			resp.write('<style>.section{word-break:break-all;background-color:#efefef;padding:5px;margin-bottom:5px;}.high{background-color:#ffc;color:#c33; padding:0 3px;}</style>')
			resp.write('<form method="get">pre:<input style="width:30px;" name="pre" value="'+pre+'" />');
			resp.write('after:<input style="width:30px;" name="offset" value="'+offset+'" />key:<input name="s" value="'+key+'" style="width:500px;" />');
			resp.write('<input type="hidden" name="admin" value="1" /><button>submit</button></form>');
			for (var i = 0; i < results.length; i++) {
				try{
					var fpath = results[i],
						c = fs.readFileSync(fpath);
					resp.write('<a href="?admin=1&download='+fpath+'">'+fpath+'</a>');
					do{
						var idx = c.indexOf(key);
						if(idx == -1) break;
						var start = idx - pre,
							end = idx + offset,
							s = c.toString('utf-8', start, end);
						s = s.substr(2).slice(0,-2).replace(new RegExp('('+key+')','ig'),'<span class="high">$1</span>');
						resp.write('<div class="section">'+s+'</div>');
						if(end >= c.length) break;
						c = c.slice(end);
					}while(true);
				}catch(e){
					console.error("%s, error read file %s: \n%s", new Date().toISOString(), fpath, e);
				}
			}
			resp.end();
	    });
	  } else {
	    resp.writeHead(200, { 'Content-Type': 'text/html' });
	    return resp.end('<form method="get">pre:<input style="width:30px;" name="pre" value="200" />after:<input style="width:30px;" name="offset" value="200" />key:<input name="s" value="139" style="width:500px;" /><input type="hidden" name="admin" value="1" /><button>submit</button></form>');
	}
});

server.listen(PORT, function(){
	console.log("Server running at port: " + PORT + ".");
});