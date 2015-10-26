var fs = require('fs')
	, util = require('util') 
	, http = require('http')
	, url = require('url')
	, path = require('path')
	, querystring = require('querystring')
	, extend = util._extend
	, crypto = require('crypto')
	, execSync = require('child_process').execSync
	//, exeCMD = require('./exec.js').exeCMD;



var config = require('./config/service.json')
	, tools = require(config.libPath + 'tools.js')
	, args = [];

var codeBox,RR
	,organBox
	,organBackPath

var apiCache = {}


const CRYSEED = config.token || 'rr'

function genAuthCode(des){
	var seed =  [ des ]
	var text = seed.join('|')
	var encrypt = crypto.createCipher('aes-256-cbc' , CRYSEED )
	var crypted = encrypt.update(text, 'utf8', 'base64')
	crypted += encrypt.final('base64')
	return crypted
}

function unAuthCode(token){
    if (!token || token.length<2) return false
	token = token.trim()
    if (!token || token.length<2) return false

    try{
        var decipher = crypto.createDecipher('aes-256-cbc',CRYSEED)
        var dec = decipher.update(token, 'base64', 'utf8')
        dec += decipher.final('utf8')

        dec = dec.split('|')

    }catch(err){
		console.log(err)
        dec = false
    }
    return dec	
}
function checkAuthCode(token , ttl){
	//默认3分钟有效期
	ttl = ttl || 60 * 3
	var ret = false
	var code = unAuthCode(token)
	if (code && code[0]) code = code[0] *1
	if (code) ret = (+new Date - code) < (ttl * 1000)
	return ret 
}

/*
Date.prototype.Format = function (fmt) { //author: meizz 
	var o = {
		"M+": this.getMonth() + 1, //月份 
		"d+": this.getDate(), //日 
		"h+": this.getHours(), //小时 
		"m+": this.getMinutes(), //分 
		"s+": this.getSeconds(), //秒 
		"q+": Math.floor((this.getMonth() + 3) / 3), //季度 
		"S": this.getMilliseconds() //毫秒 
	};
	if (/(y+)/.test(fmt)) fmt = fmt.replace(RegExp.$1, (this.getFullYear() + "").substr(4 - RegExp.$1.length));
	for (var k in o)
		if (new RegExp("(" + k + ")").test(fmt)) fmt = fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));
	return fmt;
}
*/

function getDateTime(){
	var now = new Date	
	return [now.getFullYear() , now.getMonth() + 1, now.getDate(), now.getHours() , now.getMinutes()].map(function(i){
			if (i < 10) i = '0' + i
			return i
			}).join('') 
}


function createServer(cbk , port){
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
	}).listen(port , config.backlog);
}

function apiServer(){
	tools.createServer(function(req , res){
		var params = tools.parseUrl(req)
			, action = params.shift()
			, organ = params.shift();

		function pubApiResponse(err , msg){
			res.write(JSON.stringify({'code' : err? 418 : 0 , 'err' : err || '' , 'msg':msg || ''}))
			res.end()
		}  
		switch (action){
			case "libjs":
				res.end('<script src="' + tools.libJS(config) + '"></script>')
				break
			case 'load':
				var data = req.__post || req.__get;
				if(data.ids){
					var ids = data.ids.split(',');
					var result = {};
					ids.forEach(function(id){
						result[id] = RR.load(id)(data.ds ,data.onReady , data.data && JSON.parse(data.data) , data.action);
					});
					res.write(JSON.stringify(result));
				}else{
					var mod =  RR.load(organ)(data.ds ,data.onReady , data.data && JSON.parse(data.data) , data.action);
					res.write(JSON.stringify(mod));
				}
				res.end();
				break;
            case 'latest':
                var result = {};
                fs.readdir(path.resolve(config.runPath,'conf'),function(err,list){
                    list.forEach(function(widget_folder){
                        result[widget_folder] = require(path.resolve(config.runPath,'conf',widget_folder,'uptime.json'));
                    });
                    res.end(JSON.stringify(result));
                });
                break;
			case 'list':
				//TODO read from database
				var cacheKey = req.url
				if (apiCache[cacheKey]) return res.end(apiCache[cacheKey])

				if (organ && '_all_' != organ) {
					var modsFile = path.resolve(codeBox , 'conf' , organ , 'prop.json' )	
				}else {
					var modsFile =  path.resolve(codeBox,  'modules.json');
				}
				fs.readFile(modsFile , function(err , data) {
					if (err) return res.end(JSON.stringify(err))
					if ('_all_' == organ) {
						data = JSON.parse(data.toString('utf8'))
						var ret = {}
						data.forEach(function(org , i){
							var p = path.resolve(codeBox , 'conf' , org , 'prop.json' )	
							if (fs.existsSync(p)) {
								ret[org] = require(p) 
							} else {
								ret[org] = {}
							}
						})
						data = JSON.stringify(ret)
					}
					apiCache[cacheKey] = data
					res.write(data)
					res.end()
				});
				break;
			case 'getAuthCode':
				pubApiResponse(null , genAuthCode(+new Date))
				break;
			case 'backup':
				// /backup/widget/abc/code
				// organ , backup tar name		

				var tar_name = params.shift()

				var authCode = req.__get.authCode
				if (!checkAuthCode(authCode)) return pubApiResponse('auth code illegal')

				if (!organ || !tar_name) return pubApiResponse('miss widget or tarName')

				//判断organ是否存在
				var organPath = path.resolve(organBox , organ) 
				fs.exists(organPath , function(exists){
					if (!exists) return pubApiResponse('widget not exist')
					tar_name = organ + '.' + tar_name + '.tar.gz' 
					try {
						var cmd = ['cd ' + organBox , 'tar zcf ' + tar_name + ' ' + organ, 'mv ' + tar_name + ' ' + organBackPath ] 
						var result = execSync(cmd.join(' && '))
						pubApiResponse(null , 'backup done')
					}catch(err){
						pubApiResponse('backup fail')
					}
						
				})

				break
			case 'publish':
				//svn up ; build onlyfull
				if (!organ ) return pubApiResponse('miss widget ')

				var authCode = req.__get.authCode
				if (!checkAuthCode(authCode)) return pubApiResponse('auth code illegal')

				var organPath = path.resolve(organBox , organ) 
				fs.exists(organPath , function(exists){
					if (!exists) return pubApiResponse('widget not exist')
					try {	
						var cmd = [
								 'cd ' + organPath 
								 ,'rm -rf conf/uptime.json'
								 ,'svn cleanup'
								 ,'svn up ' + organPath
								 ,'cd ' +  __dirname
								,'node build.js ' + organ + ' --noVersionUp --onlyFill --noDepend']
						var result = execSync(cmd.join(' && '))
						pubApiResponse(null , 'publish done \n' + result.toString())
					
					}catch(err){	
						pubApiResponse('publish fail')
					}
					
				})
					
				break
			case 'rollback':
				var tar_name = params.shift()
				if (!organ || !tar_name) return pubApiResponse('miss widget or tarName')

				var authCode = req.__get.authCode
				if (!checkAuthCode(authCode)) return pubApiResponse('auth code illegal')

				tar_name = organ + '.' + tar_name + '.tar.gz' 
				fs.exists(path.resolve(organBackPath , tar_name) , function(exists){
					if (!exists) return pubApiResponse('rollback not exist')
					try {
						var auto_back_tar =  organ + '.auto.' + getDateTime() + '.tar.gz'
						var cmd = [	'cd  ' + organBox 
									, 'tar zcf ' + auto_back_tar + ' ' + organ
									, 'mv ' + auto_back_tar + ' ' + organBackPath
									, 'rm -rf ' + path.resolve(organBox , organ)
									, 'tar zxf ' + path.resolve(organBackPath , tar_name)
								]
						var result = execSync(cmd.join(' && '))
						pubApiResponse(null , 'backup done')
					}catch(err){
						pubApiResponse('rollback fail')
					}


						
				})
				
				break
			/*
			case 'delete':
				//TODO check Authorize
				exeCMD('node builds.js '+ organ +' --delete',{
					start: function(){
						console.log('删除模块' + organ);
					},
					end: function(){
						res.write('done');
						res.end();
					}
				});
			*/
			default:
				break;
		}
	} , config.portRR , config.backlog);
}






function main(){
	tools.upConfig(config)

	codeBox = config.runPath
	organBox = path.resolve(__dirname , config.modPath)
	organBackPath = path.resolve(__dirname , config.backPath || '/tmp/widgetBackup')
	if (!fs.existsSync(organBackPath)) {
		execSync('mkdir -p ' + organBackPath)
	}


	RR = require(config.libPath + 'rr.js')
	//RR._setOptions({'modPath' : config.modPath , 'runBox' : codeBox})
	config.runBox = codeBox
	RR._setOptions(config)

	apiServer()
}


var parseArgs = require(config.libPath + 'parseArgs.js')
parseArgs.parse(config, args)
main()






