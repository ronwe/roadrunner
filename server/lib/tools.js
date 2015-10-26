var	 http = require('http')
	,url = require('url')

exports.libJS = function(config){
	return config.staticEnd[config.namespace] + '/com/js/.config:pollfill:rr-load?v=' + config.version 
}

exports.parseUrl = function(req , dig){
	var pUrl = url.parse(req.url , true).pathname.replace(/\/+/g , '/')
	if (dig) dig++
	var params = pUrl.split('/' , dig)
	if (dig) params.push ( pUrl.slice(params.join('/').length + 1) )
	params.shift()
	params = params.map(function(p){
		return p.trim()
	});
	return params
}

exports.upConfig = function(config){
	config.DSEnd = config.DSEnd || {}
	config.version = config.version || +new Date
	config.DSEnd.test = '//' + config.HostIP + ':' + config.portDS
	//config.DSEnd.lc = '//' + config.HostIP + ':' + config.portDS
	if (!config.staticEnd) {
		config.staticEnd = {}
		config.staticEnd[config.namespace] = '//' + config.HostIP + ':' + config.portStaic  
	}
}

exports.createServer = function (cbk , port , backlog){
	http.createServer(function(req , res){
		var reqIn = url.parse(req.url , url);
		reqIn.host = req.headers.host;
		req.__get = reqIn.query;
		if ('POST' == req.method){
			var data = '';
			req.addListener('data' , function(chunk){
				data += chunk
				if (data.length > 1e6) req.connection.destroy()
			}).addListener('end' ,function(){
				data = querystring.parse(data);
				req.__post = data;
				cbk(req , res);
			});
		} else {
			cbk(req , res);
		}
	}).listen(port , backlog)
}

