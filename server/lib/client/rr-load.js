;(function(global ,undefined){
	var index = 0
	global.nextTick = function(fn , ttl){
		global.setTimeout(fn , ttl || 0)
	}
	global.uuid = function(pre , len){
		var uid = (+new Date).toString(36) 
		if (len) return uid.slice( -len)
		return (pre || '') + uid + '_' + ++index 
	}
	function _detectType(obj , type){
		return Object.prototype.toString.call(obj) == "[object "+type+"]";
	}

	var util = global.util = {
		uuid : uuid
		,build_query : function(obj){
				if (_detectType(obj , 'String')) return obj
				var ret = []
				for (var name in obj){
					ret.push(encodeURIComponent(name) + '=' + encodeURIComponent(obj[name]))
				}
				return ret.join('&')
			}
		,report : function(){
			console && console.log &&  console.log.apply(console , arguments)
			}
		,reportErr : function(){
			console && console.error &&  console.error.apply(console , arguments)
			}
		,nextTick : nextTick
		,toArray : function(colletions ,offset){
				return Array.prototype.slice.call(colletions , offset || 0) 
				}
		,isArray : function(obj){
				return _detectType(obj , 'Array')
				}
		,detectType : function(obj , M){
				return _detectType(obj , M)
				}
	}

	var head = document.head  || document.getElementsByTagName('head')[0] || document.documentElement
	global.loadJS = function(src , opt){
		opt = opt || {}
		var l = document.createElement('script')
		l.type = 'text/javascript'
		l.src =  src
		if (opt.onErr) l.onerror = opt.onErr 
		if (opt.onLoad) l.onload = opt.onLoad 
		head.appendChild(l)
		return l
	}

	global.loadCSS = function(css){
		var l = document.createElement('link')
		l.setAttribute('rel','stylesheet')
		l.setAttribute('href',css)
		head.appendChild(l)
	}

	global.rmNode = function(node){
		node && node.parentNode  && node.parentNode.removeChild(node)
	}
})(this)

;(function(global ,undefined){
	function Assert(opt){
		this.opt = opt
	}
	Assert.prototype = {
		ok : function(condition , msg){
			if (condition) return
			var opt = this.opt
			console.error (opt.organ ,opt.widget ,' check fail  at ' +  opt.assertName + '\n error message is : ' + msg)
			throw (opt.organ +' check fail  at ' +  opt.assertName + '\n error message is : ' + msg)
			}
	}
	global.Assert = Assert
})(this)

;(function(global ,undefined){
	var evts = {}
		,onceTag = '__event_once'
	function emit(event ){
		var args = util.toArray(arguments , 1)
		if (!(event in evts)) return
		var _dels = []
		for (var i = 0 , j = evts[event].length ; i < j ;i ++){
			var cbk = evts[event][i]
			if (!cbk) return
			cbk.apply(null , args)
			if (cbk[onceTag])  { 
				evts[event][i] = null 
				_dels.push(i)
			} 
		}
		for (var i = _dels.length -1 ; i>=0 ; i--) evts[event].splice(_dels[i] , 1)
	}

	function addMultiCon(event , listener){
		var once = true
		event.sort()
		addListener(event.join('|') , listener , once)
		var eventBubbles = []
			,ret = {}
		function tinOpener(evt){
			eventBubbles.push(evt)

			if (arguments.length > 2)
				ret[evt] = util.toArray(arguments , 1)
			else
				ret[evt] = arguments[1] 

			if (eventBubbles.length >=  event.length) {
				eventBubbles.sort()
				emit(eventBubbles.join('|') , ret)
			}
		} 

		for (var i = 0 ; i < event.length;i ++){
			addListener(event[i] , tinOpener.bind(null, event[i]) , once)
		}
	}

	function addListener(event , listener , once){
		if (util.isArray(event)) return addMultiCon(event , listener)


		if (!(event in evts)) evts[event] = []
		if (once) listener[onceTag] = true
		evts[event].push(listener)
	}

	function removeListener(event, listener){
		if (!listener) {
			delete evts[event]
			return
		}
		for (var i = evts[event].length -1 ; i >= 0 ;i --){
			if (evts[event][i] === listener) {  evts[event].splice(i, 1) ; break}
		}
	}

	function listeners(event){
		return evts[event]
	}
	global.emitter = {
		on : addListener
		,once : function(event , listener){
				addListener(event , listener , true)
				} 
		,emit : emit
		,removeListener : removeListener
		,listeners : listeners
	}
})(this)


;(function(global ,undefined){
	var mods = {}
		,modDefining = {}
		,inteligent = {}

	function require(mod , callerMod ,ns){
		if (util.detectType(mod , 'Function')) {
			mod = inteligent[mod] 
		}

		if (mod){
			mod = trnName(mod , callerMod)
		}
		if (! isModLoaded(mod ,ns) ) throw mod + '@' + ns + ' lost'
		if (ns) mod += '@' + ns
		return mods[mod]
	}

	function trnName(name , callerMod){
		if (callerMod) {
			var spath = name.split('/')
			if ('.' == spath[0]) spath[0] = callerMod.split('/')[0]
			var apath = []
			spath.forEach(function(path_item){
				if (!path_item || '.' == path_item) return 
				if ('..' == path_item) apath.pop()		
				else apath.push(path_item)
			})	
			//if (1 == apath.length) apath.push('index')
			name = apath.join('/')
		}

		if (-1 == name.indexOf('/') ) name += '/index'
		return name
		///return name.replace(/\//g,'::')
	}
	var DEFINESTAT = {'DEFINING' : 1 ,'ASYNCLOAD' : 2 ,'DEFINED':3}

	function define(modOrign , depencies , con ,opt){
		var mod = trnName(modOrign )
		var modNS = mod 
		var ns = define.ns
		if (ns) modNS += '@' + ns

		if (modNS in mods) return
		modDefining[modNS] = DEFINESTAT.DEFINING 

		opt = opt || {}

		var toLoad = []
		for (var i = 0,j = depencies.length ; i <  j ; i++){
			var toDep = depencies[i]
			//智能加载
			if (util.detectType(toDep , 'Function')) {
				if (!inteligent[toDep] ) inteligent[toDep] = toDep()
				depencies[i] = inteligent[toDep] 
			}
			var dependName = trnName(depencies[i] , mod)
			if (! isModLoaded(dependName , ns)) toLoad.push(dependName)
		}

		if (toLoad.length){
			//跨组件返回的js可能需要的依赖在下面，这里trick下  先执行无依赖的 ，有依赖的延时执行
			if (!opt.defered) {
				//util.report(modOrign + " lack of some  depencies " , toLoad)
				nextTick(function(){
					opt.defered = true
					define(modOrign , depencies , con ,opt)			
				})
				return
			}


			if (opt.throwIfDepMiss) return emitter.emit(modNS + ':loadfail'  , {"message" : toLoad.join(',') + ' miss while loading ' + mod})

			//依赖失败的话会尝试异步拉取一次
			//已加载的模块不再拉了
			var _on_evt_list = []
			for (var i = toLoad.length-1 ;i >= 0 ;i --){
				var _m = trnName(toLoad[i])
				if (ns) _m += '@' + ns
				_on_evt_list.push(_m + ':defined')
				if (modDefining[_m]) toLoad.splice(i,1) 
				else modDefining[_m] = DEFINESTAT.ASYNCLOAD 
			}

			emitter.on(_on_evt_list , function(){
				define(modOrign , depencies , con)
			})

			if (toLoad.length) loadJS(rrConfig.staticServer[ns] + '/mod/js/' + toLoad.join(':') + '?' + global.rrConfig.rrVersion)
			return
		}

		var exports = {}
			,module = {exports : null}

		var ret = con(function(inMod){ return require(inMod , mod ,ns)}, exports , module) 
		mods[modNS] = module.exports || exports || ret
		modDefining[modNS] = DEFINESTAT.DEFINED 

		emitter.emit(modNS + ':behavior' )
		emitter.emit(modNS + ':defined')
	}

	function isModLoaded(mod , ns){
		var modNS = mod 
		if (ns) modNS += '@' + ns
		return  (modNS in mods)
	}

	global.require = require
	global.define = define
	global.isModLoaded = isModLoaded
})(this)

;(function(global ,undefined){
	var cache = {}
	/*
	* opt byCon 传字符串 非dom节点
	*	  byFunc 传函数
	*		noConsole  节点不存在返回false
	*		preserve  不摘除节点
	*/
	function etic(tplId , data , opt){
		if (!tplId) return
		if (cache[tplId]) return cbk()

		opt = opt || {}

		function  cbk(){
			//clear()
			return data ? cache[tplId](data) : cache[tplId]
		}

		if (opt.byCon || opt.byFunc) {
			opt.preserve = true
			var con = opt.byCon 
		} else {

			var tplNode  = document.getElementById(tplId)



			if (!tplNode) {
				if (opt.noConsole) return false
				return util.reportErr('template [' + tplId + '] is lost ')
			}

			var con = tplNode.innerHTML
			nextTick(clear)
		}

		function clear(){
			if (opt.preserve || !tplNode) return
			rmNode(tplNode)
			tplNode = null
		}

		try{
			var t = opt.byFunc || new Function("" , con)
			cache[tplId] = function (data){ return t.call(data)}
			return cbk()
		}catch(e){
			console && console.log(e , tplNode)
		}

	}
	global.etic = etic
})(this)


;(function(global ,undefined){
	var PULL_TTL = 10
	function pullData(dsType ,p , q , cache ,expires ,source , opt){
		//cache 数据缓存时间 
		if (util.isArray(dsType)) {
			var seg = dsType
			expires = p
		} else {
			var seg = new Array(7) 
			seg[0] = source || 'lc'
			seg[1] = cache || '0s'
			seg[2] = dsType || 'snake'
			seg[3] = p
			seg[6] = q
			seg[4] = ''
			seg[5] = opt || ''
		}
		if (false !== expires) expires = (expires ||  PULL_TTL) * 1000 + 2000

		return function (cbk , q ){
			var ttl_timer
			if (q) seg[6] = q
			if (cbk) {
				var  tId = uuid() 
				global[tId] = function (data , stderr){
					//global[tId] = undefined;
					ttl_timer && global.clearTimeout(ttl_timer)
					cbk(null ,  data ,stderr )
				}
				seg[4] = tId
			}
			if (expires){
				ttl_timer = global.setTimeout(function(){
					cbk('timeout')
					delete global[tId]
				} , expires)
			}
			if (seg[6]) seg[6] = util.build_query(seg[6])

			var url = rrConfig.DSEnd[seg[0]] + '/' + seg.join('::')
			var dataNode = loadJS(url , function(){
								cbk('erro raised on loading data')
							})
			
			//取消数据拉取
			return {
				'abort' : function(){
						delete global[tId]
						global.rmNode(dataNode)
						ttl_timer && global.clearTimeout(ttl_timer)
						}	
			} 
		}
	}
	global.pullData = pullData
	//加载模版
	function loadTpl(ns , name ,version , cbk){
		loadJS(rrConfig.staticServer[ns] + '/mod/html/' + name + '@' + version  , {"onLoad" : function(){
			var tpl = etic(name + '@' + ns ,null ,{'byFunc': window[name + '@' + ns]})
			cbk(tpl)
		}})
	}

	/*auto load data and scripts*/
	var stacks = []
		,decorate = {}
	
	var uiIDHash = {}
		,uiEventStack = {}

	function scan(){
		util.toArray(document.scripts ).forEach(function(x){
			if (x.scaned) return
			x.scaned = true
			if  ('text/template'  != x.type ) return
			if (1 != x.getAttribute('root')) return
			build(x)
		})

		nextTick(function(){
			var dataSq = []
				,lessSq = {} 
				,jsSq = {} 

			stacks.forEach(function(piece){
				var ds = piece.ds
					,tplId = piece.tplId
					,ns = piece.ns
					,version = piece.version
					,skin = piece.skin
					,organ = piece.organ
					,onReady = piece.onReady
					,ui_id = piece.ui_id
					,piece = piece.place

				uiIDHash[ui_id] = organ
				uiEventStack[ui_id] = []  //初始为数组 可以push事件队列 在控件注册onMsg时说明控件ready了 置为null 并取出队列执行

				if ('test::' == ds) ds += '::' + organ
				var organNS =  organ + '/index@' + ns 
                var eventid = organNS + ':data:' + uuid()
				if (onReady && window[onReady]) {
					emitter.once(organNS +':loadfail' , function(err){
						err && util.reportErr(err.message)
					})
					emitter.once([eventid , organNS + ':behavior'] , function (data){
                        //console.log('>>>' ,data[organNS + ':data'])
						var onReadyCon = onReady && document.getElementById(onReady)
						if (onReadyCon){
							onReady = new Function('widget' , onReadyCon.innerHTML )
							global.rmNode(onReadyCon)
						} else  {
							return  util.report('pull data ' ,organ ,' dont regist onready')
						}
						//var widget =  data[organNS + ':data'] || {}

						var widget_data =  data[eventid] || {}
						var widget = render(piece , tplId , widget_data)

						widget._data = widget_data
						//需要异步加载
						widget.requireTpl = function(name , cbk){
							if (!name || !cbk) return false
							name = name.replace('./' , organ + '/')
									.replace(/\//g,'_')
									.replace('.html' , '').replace(/ /g,'')
							//下划线 无法复原回原名
							var tpl =  etic(name + '@' + ns ,null ,{'noConsole': true}) 
							if (false === tpl) loadTpl(ns , name ,version , cbk)
							else cbk(tpl)
						}

						var MsgEngPre = 'msgSeq::'
						widget.__ui_id = ui_id 
						widget.onMsg = function(fn){
							if (!ui_id) return false
							if (uiEventStack[ui_id] && uiEventStack[ui_id].length){
								uiEventStack[ui_id].forEach(function(msgBody){
									fn.call(null , msgBody)
								})
							}

							uiEventStack[ui_id] = null
							emitter.on(MsgEngPre + ui_id , fn)
							return true
						}

						widget.postMsg = function (message , source ){
							var __ui_id = this.__ui_id
							if (!__ui_id) return false
							emitter.emit(MsgEngPre + __ui_id , {"data": message ,"source" : source ,"origin" : this})
							return true
						}
						widget.sendMsg = function(walias , message , source){
							var ui_with = this.__ui_with || {}
　　						if (this._ui_with) {
								ui_with = this.__ui_with = {}
								this._ui_with.forEach(function(id){
									var ui_organ = uiIDHash[id]
									if (!ui_organ) {
										util.report('ui_id ' + id + ' not found')
										return
									}
									ui_with[ui_organ] = id
								})			
								delete this._ui_with
								
							}		
							var __ui_id = []
							if ('object' === typeof walias){
								walias.__ui_id && __ui_id.push( walias.__ui_id )
							}else if (true === walias) {
								for (var walias in ui_with){
									__ui_id.push(ui_with[walias])
								} 
							}else {
								ui_with[walias] && __ui_id.push(ui_with[walias])
							}
							if ( ! __ui_id.length)	return false
							
							var  msgBody = {"data": message ,"source" : source ,"origin" : this}
							__ui_id.forEach(function(uid){
								if (uiEventStack[uid] && uiEventStack[uid].push){
									uiEventStack[uid].push(msgBody)
								}
								emitter.emit(MsgEngPre + uid , msgBody)
							})
							return true
						}

						//try {
							onReady.call(require(organ + '/index' ,null ,ns) , widget)
						//}catch(err){
							//util.report(organ , err)
						//}
						})
				}

				function bKall (err , data){
					data = data || {}
					if (err){
						util.report('pull data ' ,organ , ds , err)
						data = {err : err}
					}
					//var pglet = render(piece , tplId , data)
					//emitter.emit(organNS + ':data' , pglet)
					emitter.emit(eventid , data)
				}

				var dss  = ds.split('::')
				var dataTag = dss[0].split('-')


				switch ( dataTag[0]) {
					case 'none' :
						bKall(null ,{}  )
						break
					default :
						//多点数据源
						util.nextTick(function(){
							pullData(dss , dataTag[1])(bKall)
						})
				}

				var organSyb = version ? (organ + '@' + version) : organ 
				if (!lessSq[ns]) lessSq[ns] = []
				if (!jsSq[ns]) jsSq[ns] = []

				lessSq[ns].push(organSyb )
				if (skin) {
					var skinLink = organ + '_' + skin
					if (version) skinLink += '@' + version
					lessSq[ns].push(skinLink)
				}
				//TODO 判断是否加载过
				if (!isModLoaded(organ ,ns)) jsSq[ns].push(organSyb )
				else emitter.emit(organNS + ':behavior')
				///TODO 事件监听也得加上ns
			})

			for (var n in  lessSq) {
			 	loadCSS(rrConfig.staticServer[n] + '/mod/less/' + lessSq[n].join(':') + '?' + global.rrConfig.rrVersion)
			}	

			for (var n in jsSq) {
				loadJS(rrConfig.staticServer[n] + '/mod/js/' + jsSq[n].join(':') + '?' + global.rrConfig.rrVersion )
			}

			dataSq = lessSq = jsSq = null

		})
	}

	function render(place , tplId , data){
		if (!tplId) throw tplId + ' seek fail'
		var template = etic(tplId , null , {preserve : true})
		var html = template(data) 

		var t = document.createElement('div')
			,organ
		if (place && place.parentNode){

			~(['organ']).forEach(function(attr){
				var attrVal = place.getAttribute(attr)
				if (attrVal) t.setAttribute(attr , attrVal)
			})

			organ = place.getAttribute('organ')
			t.className = place.className + ' o-' + organ + ' o-' + organ + '-init' 
			t.style.cssText = place.style.cssText

			place.parentNode.replaceChild(t , place )
		}
		if (html) t.innerHTML = html
		return {"organ" : organ ,"dom" : t , "template" : template}
	}

	function build(piece){
		var set = {}

		set.tplId = piece.id
		set.place = piece
		;['ds' , 'organ' , 'onReady' ,'version' ,'skin' ,'ns' , 'ui_id'].forEach(function(attr){
			set[attr] = piece.getAttribute(attr)	
		})

		stacks.push(set)
	}

	global.scan = scan

})(this)
var global = this

/*先load /com/js/.version 取服务版本号*/
/*
var versionTimeStamp = (function(){
	var now = new Date
	return [now.getYear(), now.getMonth() + 1, now.getDate() , now.getHours() , Math.round(now.getMinutes()/10) ].join('.')
})() 

global.loadJS(
	rrConfig.staticServer.zero + '/com/js/.version?t=' + versionTimeStamp 
	,{'onErr' : 
		function(){ alert('roadrunner service down')}
	,'onLoad' : 
		function(){
			global.scan()
		}
	})
*/

~function(){
	var scripts = document.getElementsByTagName('script')  
	var current_script = scripts[scripts.length - 1]
	window.rrConfig.rrVersion = current_script.src.split('?')[1] 
	global.scan()
}()





