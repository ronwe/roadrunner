/*
EXSAMPLE : node build.js ../modules/pins --RRsvn=http://svn.meilishuo.com/repos/meilishuo/fex/plover/trunk/widgets/
--mkEmpty --delete --noDepend --onlyFill --clean

node build.js pins --onlyFill --noDepend
node build.js pins --clean
*/
var path = require('path')
	, fs = require('fs')
	, util = require('util')
	, extend = util._extend
	, uglifyjs = require('uglify-js')
	, timer
	, pwd = './'
	, exeCMD = require('child_process').execSync
	, exec = require('child_process').exec
	, args = []
	, ignoreSymbols = ['.svn','.git'];

var config = require('./config/service.json')
var parseArgs = require(config.libPath + 'parseArgs.js')
var beautify =  require('js-beautify')

// 处理&存储启动参数
parseArgs.parse(config,args)

if (!config.RRsvn) config.RRsvn = 'http://svn.meilishuo.com/repos/meilishuo/fex/plover/trunk/widgets/'
	// 命令行
var  shell = {} 
shell.exec = exec


function mkdirp(p){
    p = p.split('/');
    var pathnow = '';
    p.forEach(function(pi){
        pathnow += pi + '/';
        if (!fs.existsSync(pathnow) ) fs.mkdirSync(pathnow)
	})
}
/**
 * 递归遍历文件夹下所有文件，并用cbk处理其内容，遍历完之后调用afterMap
 */
function mapFolder(f , cbk , afterMap){

	if (ignoreSymbols.indexOf(path.basename(f)) !== -1) return;

	if(fs.existsSync(f)){
		var stats = fs.statSync(f);
		// 如果是文件就直接处理
		if (stats.isFile()) {
			var data = fs.readFileSync(f ,{encoding:  'utf8'} );
			cbk(f , data);
		// 文件夹的话继续递归处理子文件夹
		}else if(stats.isDirectory()) {
			var files = fs.readdirSync(f);
			files.forEach(function(fi){
				mapFolder(f + '/' + fi , cbk);
			});
		}
	}
	if(afterMap && afterMap instanceof Function) afterMap();
}

/**
 * 将处理过的文件写入到模块库文件夹下面
 */
function buildFactor(organ , source , dist  ,  suffix , dealItem , finishAll){

	mapFolder(source , function(f , data){
		var fileName = path.basename(f)
		var apiFile = fileName.indexOf('-min.') > 0 || fileName.indexOf('-atom.') > 0
		/*
		if (!apiFile)	{
			if ('.js' != fileName.slice(-3)){
				//data = uglifyjs.minify(data.toString('utf8') , {fromString: true}).code
			//}else if ('.less' == fileName.slice(-5)) {
				data =  strip(data)
			}
		}
		*/

		if (data && dealItem && ('.' != fileName[0])) data = dealItem(data , f , {"apiFile" : apiFile} )

		f = path.resolve(
			dist ,
			path.relative( source , f)
		);

		mkdirp(
			path.resolve(f,'../')
		);

		fs.writeFileSync(f , data);

	},finishAll);

}

function lessBuilder(organ , source , dist , onBuilded){

	var suffix = 'less'
		, depencies = [];

	buildFactor(
		organ
		, source
		, dist
		, suffix
		, function (data , f , opt){
			/**
			 * 匹配@import 'atom'; 查找依赖
			 * a1:完整匹配结果
			 * a2:引号
			 * module:模块名
			 */
			opt = opt || {}
			if (opt.apiFile) return data

			data = data.replace(/\@import[ ]*('|")(.+)?\1/g , function(a1 ,a2 ,module){
				// 尾部加/
				if (module.indexOf('/')  == -1) module += '/';

				module = module.trim()	// 去空格
					.replace('./' , organ + '/')	// 相对路径转绝对路径
					.replace(/\/$/, '/index.' + suffix);	// 屁股后面加上index.less

				// 如果模块路径中没有后缀，补上后缀，这句貌似没用
				if (module.indexOf('.') == -1) module += '.' + suffix;

				//去掉头部 /
				if ('/' == module.slice(0,1)) module = module.slice(1)

				depencies.indexOf(module) == -1 && depencies.push( module );

				return '@import "' + module+ '"';
			});

			if (-1 !== f.indexOf('/skins/')) {
				data = '.o-' + organ + '{\n' + data + '\n}'
			}
			if ('/index.less' == f.slice(-11)) {
				data = '.o-' + organ + '{\n' + data + '\n}'
				var initCss = path.resolve(f , '../init.less')
				if (fs.existsSync(initCss)){
					data += '\n.o-' + organ + '-init{\n @import "' + organ + '/init.less"; \n}'	
				}

			}
			return data
		}
		, function(){
			onBuilded(depencies);
		}
	);
}

function eticCompilor(organ ,html_root , tpl , filepath , cbkDepend){
	var dir = path.dirname( path.relative(html_root, filepath) )
	//compile template into js
	function tLine(str ){
		return str.replace(/[\r\t\n]/g, " ").replace(/'/g , "\\'")
	}
	var toInclude = []

	var sn = '__ret'
	var con = 'var ' + sn + ' ="" ;'
	function getSubTpl(f){
		f = f.trim()
		f = path.resolve('/', dir , f)
		//f =f.replace('./' , organ + '/')
		if (toInclude.indexOf(f) == -1) toInclude.push(f.slice(1))

		f =	f.replace(/^\//, organ + '/')
			.replace(/\//g,'_')
			.replace('.html' , '').replace(/ /g,'')
		return f + '@' + config.namespace
	}
	function tLine(str ){
		return str.replace(/[\r\t\n]/g, " ").replace(/'/g , "\\'")
	}

	var sn2 =  ';' + sn
	while (true){
		var sPos = tpl.indexOf('<?')
		if (-1 == sPos) break
		var ePos = tpl.indexOf('?>' , sPos + 2)

		var part1 = tpl.slice(0,sPos)
			, f = tpl.slice(sPos + 2 , ePos)
			,tpl = tpl.slice(ePos + 2)
		var op = f.charAt(0)
		if (part1.length) con += sn2 + " += '" + tLine(part1) + "';"
		switch (op){
			case '-':
				f = f.slice(1)
				//config from template
				break
			case '=' :
				f = f.slice(1)
				con += sn2 + " += " + f + ";"
				break
			case '#' :
				f = f.slice(1)
				f = getSubTpl( f)
				con += sn2 +  " += etic('" + f + "')(this);"
				break
			case '*': break
			default:
				//complie requireTpl to etic
				f = f.replace(/\brequireTpl *\(('|")([\w\W]+?)\1\)/g , function(w , q , tplf){
					return 'etic(' + q + getSubTpl(tplf) + q + ')'
					})

				con += f
		}

	}

	tpl.length  && (con +=  sn2 + " += '" + tLine(tpl) + "';")

	//con = uglifyjs.minify(con , {fromString: true}).code
	con = beautify.js(con)
	con += 'return ' + sn
	//console.log(con)
	cbkDepend && cbkDepend(toInclude)
	return con

}

function htmlBuilder(organ , source , dist , onBuilded , tplBuilder){
	//<!--// 配置名:配置值 //-->
	function getTplInfo(data){
		var startMark = '<!--//'
			,endMark = '//-->'
		var _pos_start_comment = data.indexOf(startMark)
		if (_pos_start_comment < 0) return
		var _pos_end_comment = data.indexOf(endMark , _pos_start_comment)
		if (_pos_end_comment < 0 ) return
		var comments = data.slice(_pos_start_comment + startMark.length , _pos_end_comment)
		comments = comments.trim()
		if (!comments) return
		data = data.slice(0 , _pos_start_comment) + data.slice(_pos_end_comment + endMark.length)
		var ret = {}
		comments.split('\n').forEach(function(line){
			line = line.trim()
			if ('//' == line.slice(0,2)) return
			line = line.split(':').map(function(l){
					return l.trim()
				})
			if (!line[1]) return
			ret[line[0]] = line[1]
		})
		console.log(ret)
		return {'info' : ret ,'data' : data} 
	}

	var allTpl = []
		,tplDepends = {}
		,tplRelation = {}
	buildFactor( organ , source , dist  , 'html'
	, function(data , f , opt){
		var file_base = path.relative( source , f)
			,tplShort
		if('index/' == file_base.slice(0, 6)) tplShort = file_base.slice(6, -5)



		if ( tplShort && '.' != tplShort[0]) {
			//add title which get from data comments
			var comments = getTplInfo(data)
				,info = {name : tplShort , prev : null}
			if (comments) {
				data = comments.data
				extend(info , comments.info)
			}
			allTpl.push(info)
		}
		return tplBuilder(data , f , function(toIncludes){
				tplRelation[file_base] = toIncludes
				if ('index.html'  != file_base && !tplShort)	return
				tplDepends[file_base] = toIncludes || []
				} , opt)
		}
	, function(){
		var mods_file = path.resolve(config.modPath ,  organ , 'conf/prop.json')
		var mods_prop = require(mods_file)

		var _tpls = mods_prop.tpls
		var _tpls_hash = {}
		_tpls && _tpls.forEach(function(t){
			_tpls_hash[t.name] = t
		})
		allTpl = allTpl.map(function(t){
			if (t.name in _tpls_hash) return _tpls_hash[t.name]
			return t
		})
		mods_prop.tpls = allTpl

		fs.writeFileSync(mods_file, JSON.stringify(mods_prop , null ,4) )
		delete require.cache[mods_file]

		onBuilded(tplDepends , tplRelation)
		});
}

function dependHelper(organ ,data_source , depencies ,mod_depend ,intel_depend){
	 //var reg = /require *\(('|")(.+)?\1\)/

	var data = data_source 
		   .replace(/\/\*[\s\S]*?\*\//mg, '') // block comments
		 //  .replace(/\/\/.*$/mg, ''); // line comments

	var reName 
	function require(module){
		var oldName = module
		if (!module) return
		module = module.trim()	// 去空格
		// 无视自依赖，避免死循环
		if (module == organ || module == organ + '/index') return
		// 屁股后面加个斜杠
		if (module.indexOf('/')  == -1) module += '/'

		module = module.replace('./' , organ + '/')	// 相对路径转绝对路径
					.replace(/\/$/, '/index');	//后面再加个index
		// 存储依赖
		depencies.indexOf(module) == -1 && depencies.push( module )
		// 存储模块依赖
		mod_depend.indexOf(module) == -1 && mod_depend.push( module )

		//reName.push([oldName , module])
	}

	function tryRequire(line){
		try {
			var evaFn = new Function('require' , line.replace(/,/g , ';'))
			//reName = []
			evaFn(require)
			/*
			reName.forEach(function(toName){
				var oldName = toName[0]
					,newName = toName[1]
				if (oldName == newName) return

				var reg = new RegExp('require *\\((\'|")' + oldName + '\\1\\)' , 'g')
				var line_new  =  line.replace(reg , 'require($1' + newName + '$1)' )
				if (line_new != line) data_source = data_source.replace(line , line_new)
			})
			*/
		} catch (err){
			//return line
		}
	}


	data.split('(((').forEach(function(s_fpart , i){
		if (0 === i ) return
		var intelligent = s_fpart.split(')))')[0]
		if (intelligent.length == s_fpart.length) return

		intelligent.replace(/require *\(([\s\S]*)\)/ ,function(a0 , depFn){
			intel_depend.indexOf(depFn) == -1 && intel_depend.push( depFn )
		})
	})


	data.split('\n').forEach(function(line){
		if (!!line.match(/\brequire\b/)) line = tryRequire(line)
	})
	//return data_source

}

function jsBuilder(organ , source , dist , onBuilded){

	var suffix = 'js'
		, depencies = [];

	buildFactor(
		organ
		, source
		, dist
		, suffix
		, function (data , f , opt){
			var mod_depend = []
				,intel_depend = []
			if (!(opt && opt.apiFile)) {
				 dependHelper(organ , data , depencies , mod_depend , intel_depend)
			}
			/**
			 * 后面这段代码是要把所有的依赖关系都添加到文件头部去
			 * 例如代码中出现过 require('jquery');.....;require('test/example');
			 * 处理完之后会变成
			 * define(module_name,[${BasePath}/jquery/index,${BasePath}test/example/index],function(require,exports,module){
			 *		...;
			 * });
			 */
			var d = mod_depend.join('","')
			if (d) d = '"' + d + '"'
			else d = ''

			if (intel_depend.length){
				if (d) d += ','
				d += intel_depend.join(',')
			}

			var module_name = organ + '/' +  path.relative( source , f).split('.')[0]
			//data = 'define("' + module_name  + '" ,[' + d + '] , function(require , exports , module) { \n '+ data + '\n} ,"' + config.namespace + '");'
			data = 'define("' + module_name  + '" ,[' + d + '] , function(require , exports , module) { \n '+ data + '\n} );'
			return data;
		}
		, function(){
			onBuilded( depencies );
		}
	);
}

function fullRunBox(organ , organ_dist , organDep , afterMap){

	var box = path.resolve(config.runPath) // 本地模块路径
		, shadow_box = path.resolve(pwd , '.shadow'); // 从其它站点库同步过来的模块路径

	mkdirp(box)
	mkdirp(shadow_box)

	function tryRegAfter(){
		if (timer) clearTimeout(timer)
		timer = setTimeout(afterMap , 100)
	}

	var loaded = [organ];
	function copy2Run(dist ,organName , suffix){
		var sub_box = path.resolve(box , suffix , organName)
		mkdirp(sub_box)
		if (!fs.existsSync(dist)) {
			mkdirp(dist)
		}
		var cmd = 'cd ' + dist + ' && rsync -rua   ./ ' + sub_box + ' '
		if (config.delete || config.clean)  cmd = 'rm -rf '+ sub_box
		exeCMD(cmd)
	}

	function cloneDep(depencies ){
		tryRegAfter()
		//download depend mod
		if (loaded.indexOf(depencies) != -1) return
		loaded.push(depencies)
		
		if (fs.existsSync(path.resolve(config.modPath , depencies) )){
			var cmd = 'rsync -ru ' + path.resolve(config.modPath , depencies) + ' ' + shadow_box
		}else if (fs.existsSync(path.resolve(shadow_box , depencies) )) {
			var cmd = 'echo "rsync ' + depencies + '" '
		}else if ( config.RRsvn){
			var cmd = [	
						'cd ' + shadow_box 
						,'svn export ' + config.RRsvn + '/' +  depencies + '  --force'
						].join (' && ')  
		}
		
		if (!cmd)  throw(depencies + ' is lost ')
		cmd && shell.exec (cmd , function(err){
			if (err) throw (depencies , err)
			tryRegAfter()
			var sub_dep = require(path.resolve(shadow_box , depencies ,'conf/depency.json'))
			copy2Run(path.resolve(shadow_box , depencies , 'conf') , depencies , 'conf' )
			for (var k in organDep){
				copy2Run(path.resolve(shadow_box , depencies ,'dist' , k) , depencies , k)
				sub_dep[k] && sub_dep[k].length && sub_dep[k].forEach(function(sub){
					process.nextTick(function(){
						cloneDep(sub.split('/')[0])
					})
				})
			}
		})
	}

	var depend_on =  []
	// 拷贝config文件到.run目录下
	copy2Run(path.resolve(config.modPath ,organ , 'conf') , organ , 'conf' )
	tryRegAfter()
	// 删除或者不考虑依赖
	var runDep = !(config.noDepend || config.delete || config.clean)
	for (var k in organDep){
		copy2Run(path.resolve(organ_dist , k) , organ , k )
		//html 的依赖为 hash 结构
		if (!(runDep && organDep[k] && util.isArray(organDep[k])) ) continue
		organDep[k].forEach(function(dep){
			var organ_name = dep.split('/')[0]
			if (depend_on.indexOf(organ_name) == -1) {
				depend_on.push(organ_name)
				cloneDep(organ_name)
			}
		})
	}
}

function buildEmpty(organ){
	var organPath = path.resolve(config.modPath , organ)
	var cmd = 'svn export ' + config.RRsvn +  '/_blank ' + organPath 
	shell.exec(cmd , function(){
		shell.exec('find ' + organPath + ' -name .svn -o -name .git|xargs rm -rf ' , function(){
			console.log('empty organ [' + organ + ']  is created')
			build(organ ,function(){
				console.log( organ + ' built')
			});
		})
	})
}
function build(organ , cbk){
	// ??
	if (organ.indexOf(config.modPath) > -1 ) organ= path.relative(config.modPath , organ);

	if ('/' == organ.slice(-1)) organ = organ.slice(0, -1);
	
	if (!fs.existsSync(config.modPath + organ) && config.mkEmpty) return buildEmpty(organ) 

	var organ_src = path.resolve(config.modPath , organ , 'src')
	var depend_conf_file = path.resolve(config.modPath , organ , 'conf/depency.json')

	if (!fs.existsSync(organ_src)) {throw (organ + ' not exists')}

    var dist = path.resolve(config.modPath , organ , 'dist')
		,dist_html = path.resolve(dist , 'html')
		,dist_conf = path.resolve(dist , 'conf')
		,dist_css = path.resolve(dist , 'css')
		,dist_less = path.resolve(dist , 'less')
		,dist_js = path.resolve(dist , 'js')

	if (config.onlyFill || config.clean) {
		//上线后不需要分析 只需要 cp 文件
		var organDep = require(depend_conf_file)
		return fullRunBox(organ , dist , organDep , cbk && cbk.bind(null, organDep))
	}
    var prop = require(config.modPath + organ + '/conf/prop.json')

	mkdirp(dist_html)
	mkdirp(dist_css)
	mkdirp(dist_less)
	mkdirp(dist_js)


	var organDep = {}
		,_odc = 0 

	function  onBuilded (organ ,type , depencies,relations){

		if (type) {
			organDep[type] = depencies
			if ('html' == type && relations) organDep['templates'] = relations
		}
		_odc--
		if ( _odc > 0) return
		//update depencied config , copy to sandbox

		fs.writeFileSync(depend_conf_file , JSON.stringify(organDep , null ,4) )

		var uptime_conf = path.resolve(config.modPath , organ , 'conf/uptime.json')
		fs.writeFileSync(uptime_conf , JSON.stringify((+new Date).toString(32)) )	

		var modsFile = path.resolve(config.runPath , 'modules.json') // config.libPath + 'modules.json' 
		var modules = fs.existsSync(modsFile ) ? require(modsFile) : [] 
		//modules[organ] = require(path.resolve(config.modPath , organ , 'conf/prop.json'))
		var ii = modules.indexOf(organ)
		if (config.delete) {
			shell.exec('rm -rf ' + path.resolve(config.modPath , organ))
			if (ii > -1) modules.splice(ii , 1)
		}else if (ii == -1) {
			modules.push(organ)
		}
		mkdirp(path.dirname(modsFile))
		fs.writeFileSync(modsFile , JSON.stringify(modules , null ,4) )
		///console.log(organ ,type,  dist )
		fullRunBox(organ , dist , organDep , cbk && cbk.bind(null, organDep))

	}

    var cssIn = prop.cssIn 
    var cssBuilder = cssIn && {'less' : lessBuilder }[cssIn]
		,tplBuilder = {'html' : eticCompilor}[prop.tplIn || 'html']  
	organDep.js  = null
	_odc = 2 //js + html 
	if (cssBuilder) {
		_odc ++ 
		organDep[cssIn] = null 
		cssBuilder(organ ,  path.resolve(organ_src , 'less'), path.resolve(dist , cssIn) , onBuilded.bind(null , organ , cssIn))
	}else  if ('NONE' != cssIn) {
		if ( cssIn) throw (cssIn + ' can not work')	
		else console.log('no css to precompile')
	}
	jsBuilder(organ ,  path.resolve(organ_src , 'js'), dist_js , onBuilded.bind(null ,organ , 'js') )

	var html_root = path.resolve(organ_src , 'html')
	htmlBuilder(organ ,  html_root , dist_html , onBuilded.bind(null ,organ , 'html') ,tplBuilder.bind(null ,  organ , html_root))
}


if (config.RRsvn && config.RRsvn.slice(-1) == '/') config.RRsvn = config.RRsvn.slice(0 , -1) 
mkdirp(config.modPath)
exports.build = build

exports.mkdirp = mkdirp

if (args.length){
	//if (config.RRgit && config.RRgit.slice(-1) == '/') config.RRgit = config.RRgit.slice(0 , -1) 

	var organ = args[0]
	build(organ , function(){
		console.log('< ' + organ + ' complete >')
	})
}
