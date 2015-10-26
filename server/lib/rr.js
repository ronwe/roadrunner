var path = require('path')
	,util = require('util')
	,fs =  require('fs')

var est = require('./est/est.js')

var config = {}
	,dirCache = {}
var runBox = path.resolve('.run')

exports.load = function(mod ,noCache){
	//console.log('toload' , path.resolve(runBox , 'html' ,mod))

	//version
	var modConf = {}
	var confCheck = ['prop' , 'depency' ,'uptime'].every(function(name){
		var fpath = path.resolve(runBox , 'conf' ,  mod ,name +'.json')
		if (!fs.existsSync(fpath)){
			console.log(mod + ' is unavailable , ' + fpath + ' is not config')	
			return false
		}
		modConf[name] = require(fpath)
		return true
	})

	if (!confCheck) {
		return function(){
			return false
		}
	}

	var  mod_version = modConf.uptime
		,mod_htmls = modConf.depency.html

	return function(dataSource  , onReady , prop , test){
		var sHtml = ''

		var readyFnName = mod + (+new Date()).toString(24) +  parseInt(Math.random() * 1000) 
		var tpl = 'index.html'
		var part_prop ={}
		if (prop ){
			if ( prop._prop){
				var runWith = prop._prop
				delete prop._prop
			}

			if (prop._class){
				var addClass = prop._class
				delete prop._class
			}
			if (prop._ui_id){
				var ui_id = prop._ui_id
				delete prop._ui_id
			}
			if (prop._ui_with){
				var ui_with = prop._ui_with
				delete prop._ui_with
			}
			if (prop._skin){
				var skin = prop._skin
				delete prop._skin
			}

			if (prop._cssText){
				var cssText = prop._cssText
				delete prop._cssText
			}

			if (prop._includeTpl){
				var htmlToLoad = prop._includeTpl
				delete prop._includeTpl
			}

			if (prop._tpl && 'index' != prop._tpl) {
				tpl = 'index/' + prop._tpl +  '.html'
				delete prop._tpl
			}
		}
		//改读 depency.json html字段
		var htmlToLoad = htmlToLoad 
						|| (mod_htmls && mod_htmls[tpl])
						|| fs.readdirSync(path.resolve(runBox , 'html' ,mod)) 

		htmlToLoad.forEach(function(f){
			if ('.' == f.slice(1)) return
			if ('.html' != f.slice(-5)) return
			///if ('index.html' == f) return //没必要的感觉
			if (tpl == f) return
			tplCon(f , false)
		})


		tplCon(tpl , true)
		//TODO 清理缓存 

		function  tplCon(f , isRoot){
			var modNm = mod + '_' + f.slice(0, - 5).replace(/\//g,'_')
			if (!dirCache[modNm]) {
				//var html = est.renderFile('' ,  path.resolve(runBox , 'html' ,mod , f) , prop)
				var fpath = path.resolve(runBox , 'html' ,mod , f)

				var html = fs.existsSync(fpath) ? fs.readFileSync( fpath) : 'return "tpl not exist"' 
				dirCache[modNm] = html
			}
			sHtml += '<script type="text/template"  id="' + modNm + '@' + config.namespace +'" '
			if (isRoot) {
				sHtml += ' root=1 ds="' + (dataSource || 'none::') + '" onReady="' + readyFnName+ '" organ=' + mod 
				sHtml += ' ns="' + config.namespace + '"'
				if (addClass) sHtml +=' class="' + addClass + '" '
				if (skin) sHtml +=' skin="' + skin + '" '
				if (cssText) sHtml += ' style="' + cssText +'" '
				if (mod_version) sHtml += ' version="' + mod_version + '" '
				if (ui_id) sHtml += ' ui_id="' + ui_id +'" '
			}
			sHtml += '  >' + dirCache[modNm] + '</script>\n'

		}
		if (ui_with && onReady){
			onReady = 'widget._ui_with = ' + JSON.stringify(ui_with) + ';' +  onReady
			
		} 
		if (runWith && onReady) {
			runWith = JSON.stringify(runWith , null , 4)
			onReady = 'widget._prop = ' + runWith + ';' +  onReady
		}

		if (tpl && onReady){
			onReady = 'widget._tpl = "' + tpl + '";' +  onReady
		}
		var assert = ''
		if (test){
			var assertCan = path.resolve(config.modPath ,mod , 'test' )
			if (!dirCache[mod + '-assert'] ) dirCache[mod + '-assert'] = fs.readdirSync(assertCan)
			var assert = []
			dirCache[mod + '-assert'].forEach(function(f){
				if ('.' == f[0]) return
				assert.push('~function(assertName){var assert = new Assert({that : modObj ,assertName:assertName , widget:widget ,organ:"' + mod + '"});' + fs.readFileSync(path.resolve(assertCan ,f )) + '}("' + f  + '")' )
			})
			assert = ';var modObj = this;window.setTimeout(function(){' + assert.join(';\n') + '},16)'
		}
		onReady = (onReady || '') + assert
		if (onReady){
			sHtml += '<script type="text/template"  id="' + readyFnName + '" >'  + onReady + '</script>'
		}
		//var props = require(path.resolve(runBox,'modules.json'))[mod];
		var props = require(path.resolve(runBox , 'conf' ,mod , 'prop.json')) 
		props.html = sHtml
		props.version = mod_version || '0'
		if (noCache)  dirCache = {}
		return props;
		}
}
exports._setOptions = function(options){
	config = options
	runBox = config.runBox || runBox
}
