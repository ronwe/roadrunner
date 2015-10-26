var fs = require('fs')
	, util = require('util') 
	, http = require('http')
	, url = require('url')
	, path = require('path')
	, querystring = require('querystring')
	, extend = util._extend

var beautify =  require('js-beautify')

var version_file = path.resolve('./config/version')
var config = require('./config/service.json')
	,rrVersion = fs.existsSync(version_file) ? fs.readFileSync(version_file).toString().trim() : '0'
	, tools = require(config.libPath + 'tools.js')
	, args = [];

var codeBox,RR


function localServer(){
	//http://127.0.0.1:3000/pins/run@lc::10s::snake::/goods/attribute_poster::_::::word_name=hot
	tools.createServer(function(req , res){
		if ('.ico' == req.url.slice(-4)) return res.end()
		console.log(req.url)
		var req_path = req.url.split('@' , 1)[0]
		var di = req.url.slice(req_path.length + 1)
		di = di.split('?')[0]
		req.url = req_path
		var params = tools.parseUrl(req  )

		var organ = params.shift()
			, action = params.shift()
			, tpl = params.shift() || null
			, prop = params.shift() || '_prop'
			, di = di || 'test::'

		if (!organ || ['undefined'].indexOf(organ)  > -1) return res.end('which organ do u want to load')

		function echoHtml(err , html){
			if (err)  return res.end(err.toString())
			res.writeHead(200 , {'content-type': 'text/html;charset=utf-8' , 'cache-control': 'no-cache,no-store'})
			///if (html ) html = beautify.html(html)
			res.write(html || (false === html ? 'error raised' : 'nope'))
			res.end()
		}

		var prop_conf = path.resolve(codeBox , 'conf' , organ , prop + '.json')
		if (!fs.existsSync(prop_conf)){
			console.log(prop_conf , ' not configed')
			prop = {} //null
		}else{
			prop = extend({} ,require(prop_conf))
		}
		prop._tpl = tpl || prop._tpl

		var organHtml = RR.load(organ , true)(di , 'this.bind(widget)' , prop , 'test' == action ).html
		if (prop._wrapper){
			var html = ''	
			prop._wrapper.forEach(function(code){
				if ('$' === code) {
					html += organHtml
				}else {
					html += code
				}	
			})
			delete prop._wrapper	
		} else {
			var html = '<!doctype html><html><head><style></style><meta name="viewport" content="width=device-width, height=device-height, initial-scale=1.0, user-scalable=no, minimum-scale=1.0, maximum-scale=1.0"/><title>' + organ + ' is running</title></head><body>' + organHtml
		}

		echoHtml( null , html +
			'<script src="' + tools.libJS(config) + '"></script>' +
			'</body></html>')

	},config.portLocal , config.backlog)
}


function staticServer(){
	/*static server */
	tools.createServer(function(req , res){
		//TODO 304

		var params = tools.parseUrl(req , 2)
			, type = params.shift()
			, filetype = params.shift()
			, params = params.shift()


		if (!params) return res.end('sth mistake')
		params = params.split(':')

		var contentType = 'text/plain'

		if ('less' == filetype || 'css' == filetype) contentType = 'text/css';
		else if ('js' == filetype ) contentType = 'application/javascript';

		var lastModified = new Date().toUTCString();
		var expires = new Date;
		res.writeHeader(200 ,{
			'Content-Type' :  contentType +';charset=utf-8',
			"Last-Modified" : lastModified
		});

		config.staticTTL && setTimeout(function(){
            res.end('/*request timeout*/')
        } , config.staticTTL)

		loadParrel(filetype ,type , params , res ,function(){
			//TODO some cache
		});
	} , config.portStaic , config.backlog)
}

function backServer(){
	/*data-source backend*/
	tools.createServer(function(req , res){
		var params = tools.parseUrl(req)
		var nPipe = pipeRes(res)
		function outPut(cbkId , data ,err){
			process.nextTick(function(){
				res.writeHead(200 , {'content-type': 'application/javascript;charset=utf-8'})
				if (cbkId) nPipe.write(';window.' + cbkId + ' && ' + cbkId)
				nPipe.write( '(' 
					+ JSON.stringify(data)
					)
				if (cbkId)	nPipe.write( ',' + (err ?'"' + err + '"' : 'null') ) 
				nPipe.write( ')')
				nPipe.end()
			});
		}
		params.forEach(function(dr){
			dr = dr.split('::')
			var type = dr[0] 
				, ttl = dr[1]
				, source = dr[2]
				, cbkId = dr[4]
			nPipe.count++
			switch (dr[0]){
				case "test" :
					//load source config data
					if (!ttl){
						var collects = fs.readdirSync(path.resolve(config.modPath ,source , 'data'));
						collects = collects.filter(function(f){
							return ('.' != f[0])
						});
						ttl = collects[ Math.floor(Math.random() * collects.length) ];
					}else {
						ttl += '.json';
					}
					var data = path.resolve(config.modPath , source , 'data' , ttl)
					//TODO check path is legal
					fs.exists(data , function(exists){
						outPut(cbkId , (exists ? require(data) : {}) , !exists && ( ttl + ' load fail') )
						delete require.cache[data]

					});
					break;
				case "none" :
					return outPut(cbkId , {});
				default:
					break;
			}
		});
	}, config.portDS ,config.backlog)
}


function resPipe(ext){
	for (var act in ext) this[act] = ext[act];
} 
resPipe.prototype =  {
	emit : function(){},
	once : function(){},
	on : function(){},
	write : function(){},
	end : function(){}
}

function pipeRes(res ,ext){
	ext = ext || {}
	ext.count  = 0
	ext.cache = []
	ext.write =  ext.write || function(data){
		res.write(data)
		if (this.onEnd && this.cache) 	this.cache.push(data)
	};
	ext.end = ext.end || function(){
		if (-- this.count > 0) return;
		res.end();
		if (this.onEnd) this.onEnd(this.cache);
		this.cache  = null;
	};
	return new resPipe(ext);
}

var less ,uglifyjs , lessParser 
function minJsCode(data){
	//return data
	return uglifyjs.minify(data.toString('utf8') , {fromString: true}).code
}

function loadParrel(filetype , type , params , res , onEnd){
	var ext = { onEnd : onEnd };
	if (config.bemin && 'js' == filetype && 'com' == type){
		ext.write = function(data){
			res.write(
				minJsCode(data)
			)
		}
	}
	function outCss(err , output) {
	}

	if ( 'mod' == type){
		switch  (filetype){
			case 'less' :
				ext.write = function(data){
					data = data.toString('utf8')
					onEnd && this.cache.push(data)
					less.render(data , {  paths: [path.resolve(codeBox , 'less')] }  , function (err , output){
							if (!err){
								res.write(undefined != output.css ? output.css :  output.toString())
							}else{
								console.log(err)
								res.write('/*' + err.message + '*/')
							}
							if (-- this.count <= 0)  {
								res.end()
								onEnd && onEnd(this.cache) && (this.cache = null)
							}
						}.bind(this))
				}
				ext.end = function(){}
				break
		}
	}

	var nPipe = pipeRes(res , ext)


	var addedMods = []
		,addedJS = []

	function getDepencies(mod){
		if (addedJS.indexOf(mod) != -1) return
		var ret = []

		function addDep(p){
			p = p.split('/')[0]
			///if (addedMods.indexOf(p) != -1) return
			var depends = path.resolve(codeBox , 'conf' , p , 'depency.json')
			//模块不存在
			if (!fs.existsSync(depends)) return
			require(depends).js.forEach(function(d){
				//不是第一个模块的依赖且加载过的跳过
				if (addedJS.length > ret.length && addedJS.indexOf(d) != -1) return

				//依赖应该在上面
				var t = ret.indexOf(d)
				if (t > -1) ret.splice(t , 1)
				ret.unshift(d)

				//之前加载过的跳过
				if (addedJS.indexOf(d) != -1) return
				addedJS.push(d)
				addDep(d)
			})
		}
		addDep(mod)
		addedJS.push(mod)
		ret.push(mod)
		return ret
	}

	params.forEach(function(mod){
		loadFitem(nPipe , type ,filetype , getDepencies ,mod)
	})
	nPipe.count++
	var headOutput = ['/*sky lab*/']
	if ('mod' == type && 'js' == filetype) headOutput.push( '(define && (define.ns = "' + config.namespace+ '"));' )
	nPipe.write(headOutput.join('\n') + '\n')
	nPipe.end()
}

function loadFitem(nPipe, type ,filetype , getDepencies ,mod){
	mod = mod.trim().replace(/::/g,'/')
	
	if (!mod) return
	
	var toLoad
		,mversion
		,mname

	function echoNoFileMsg(file){
		nPipe.write('/*' + file + ' not existing*/')
		nPipe.end()
	}
	function getTplDepencies(mod){
		var tpl = mod.split('/')
		mname = tpl.shift()
		tpl = tpl.join('/') + '.html'
		var ret = [tpl]
		var depConfFile = path.resolve(codeBox , 'conf' , mname , 'depency.json')
		if (!fs.existsSync(depConfFile)) return ret
		var conf = require(depConfFile) 
		if (!conf.templates || !conf.templates[tpl]) return ret 
		//ret = ret.concat(conf.templates[tpl])
		ret = conf.templates[tpl].concat(ret)
		return ret
	}
	function loadModAndDepend(mod ,mversion){
		if ('html' === filetype){
			toLoad = getTplDepencies(mod)
		}else {
			toLoad = getDepencies( mod ) || []
		}

		var modBPiece = ''
			,modBLen = toLoad.length
			,modCache = {}

		function pieceOK(){
			toLoad.forEach(function(mod){
				nPipe.write(modCache[mod] +'\n')
			})
			nPipe.end()
		}
		if (!toLoad.length) return pieceOK()

		toLoad.forEach(function(mod){
			if ('html' === filetype){
				var modPath = resolveHtmlPath( mod ) 
			}else {
				var modPath = resolveJsPath(mod)
			}
			if (!modPath) {
				modCache[mod] = '/*' + mod + ' seek fail */'
				if (--modBLen <= 0) pieceOK()
				return
			}
			modCache[mod] = ''

			var  sPipe = new resPipe({
					write : function(script){
							modCache[mod] += script.toString('utf8')
							}
					,end : function(){
							if ('html' === filetype){
								var htmlId = mname + '_' + mod.slice(0 , -5).replace(/\//g,'_')
								modCache[mod] = 'etic("' + htmlId + '@' + config.namespace + '",null , {"byFunc":function(){ ' + modCache[mod] + '}})'
							}else if (config.bemin) {
								modCache[mod] = minJsCode(modCache[mod])
							}
						//	else if (!config.bemin && beautify) modCache[mod] = beautify.js(modCache[mod])
							if (--modBLen <= 0) pieceOK()
							}
					})
			fs.createReadStream(modPath).pipe(sPipe)
		})
	}

	function resolveHtmlPath(mod){
		var modPath = path.resolve(codeBox , 'html' , mname , mod ) 
		if (!modPath || !fs.existsSync(modPath)) return false
		return modPath
	}

	function resolveJsPath(mod){
		var modPath
		if (mod.indexOf('/') > 0 ) {
			if ('.js' != mod.slice(-3)) mod += '.js'
			modPath = path.resolve(codeBox , 'js' , mod )
		} else  {
			modPath = path.resolve(codeBox , 'js' , mod ,'index.js')
		}
		if (!modPath || !fs.existsSync(modPath)) return false
		return modPath
	}

	if ('com' == type) {
		//加载类库文件
		if ('.' == mod[0]){
			toLoad = mod
		} else {
			var suffix = '.' + filetype
			if (suffix != mod.slice(-suffix.length)) mod += suffix 
			toLoad = path.resolve(config.libPath , 'client' , mod)
		}
	}else if ('mod' == type){
		//加载模块文件
		mod = mod.split('@')
		mversion = mod[1]	
		mod = mod[0]


		switch (filetype){
			case 'less':
				var css = mod.split('_')	
				if (1 == css.length ){
					toLoad = path.resolve(codeBox , 'less' , mod ,'index.less')
				}else {
					toLoad = path.resolve(codeBox , 'less' , css[0], 'skins', css[1] + '.less')
				}
				break
			case 'js':
				//判断有没有
				nPipe.count++

				if (resolveJsPath(mod)) {
					loadModAndDepend(mod )
				}else {
					setImmediate(function(){
						echoNoFileMsg(mod)
					})
				}
				return
				break
			case 'html':
				//toLoad = path.resolve(codeBox , 'html' , mod.replace(/_/g , '/') + '.html')
				nPipe.count++

				loadModAndDepend(mod.replace(/_/g , '/')  , mversion)
				return
				break
				
		}
	}


	if (!toLoad || !toLoad.length) return
	nPipe.count++
	setImmediate(function(){
		if ('.config' == toLoad){
			//虚拟文件
			nPipe.write("if (!window.rrConfig) { window.rrConfig = {" +
					"DSEnd : " + JSON.stringify(config.DSEnd) +
					",staticServer : " + JSON.stringify(config.staticEnd)  +
				"}}")
			nPipe.end()
			return
		}

		if ('.version' == toLoad){
			nPipe.write("if (window.rrConfig) { window.rrConfig.rrVersion = '" + rrVersion + "' }")
			nPipe.end()
			return
		}
		fs.exists(toLoad , function(exists){
			if (!exists) return echoNoFileMsg(toLoad)
			var tCache = [] //new Buffer('') 
			var sPipe = new resPipe({
					write : function(data){
							//tCache = Buffer.concat([tCache , data])
							tCache.push(data)
							}
					,end : function(){
							if (mversion && 'html' == filetype ){
								nPipe.write('function ' + mversion + '(){ ' + Buffer.concat(tCache) + '}')
							}else {
								nPipe.write(Buffer.concat(tCache))
							}
							tCache = null
							nPipe.end()
							}
					})
			fs.createReadStream(toLoad).pipe(sPipe)
		})
	})

}





function main(){
	tools.upConfig(config)

	config.runPath = path.resolve(__dirname , config.runPath) + '/'
	config.modPath = path.resolve(__dirname , config.modPath) + '/'
	config.libPath = path.resolve(__dirname , config.libPath) + '/'
	config.node_modules = path.resolve(__dirname , config.node_modules) + '/'

	codeBox = config.runPath
	less = require(config.node_modules + 'less')
	uglifyjs = require(config.node_modules + 'uglify-js')

	/*
	lessParser = new(less.Parser)({
		paths: [path.resolve(codeBox , 'less' )]
	})
	*/

	RR = require(config.libPath + 'rr.js')
	RR._setOptions({'modPath' : config.modPath , 'runBox' : codeBox ,'namespace' : config.namespace})

	if (args.indexOf('local') > -1) {
		localServer()
		backServer()
	}
	staticServer()
}


if (require.main === module) {
	var parseArgs = require(config.libPath + 'parseArgs.js')
	parseArgs.parse(config, args)
	main()
}else {
	exports.bind = function(_config ,_args){
		config = extend( config , _config )
		args = extend( args , _args)
		main()
		return config
	}
}





