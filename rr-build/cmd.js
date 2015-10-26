var util = require('util')

var color = {}
~function(){
	//https://github.com/dariuszp/colog
	var base = '\x1B[%dm'
	var colorMap = {
		'black':  30,
		'red':    31,
		'green':  92,
		'yellow': 93,
		'blue':   94,
		'magenta':35,
		'cyan':   36,
		'white':  37
		, 'grey' : 90
		, 'orange' : 91
		, 'pink' : 95
		, 'lgreen' : 96
	}
	function wrap(c , text){
		return ( util.format(base , c) + text +  util.format(base , 0))
	}
	for (var c in colorMap){
		color[c] = wrap.bind(null , colorMap[c]) 
	}
	
	
}(color)

~function(router){
	var stdin = process.stdin //process.openStdin()
	stdin.setRawMode(true )
	stdin.resume()
	stdin.setEncoding( 'utf8' )

	
	var history = []
		,history_nu = 0
		,column_nu = null 
	var userInput = '' 
	function echo(str){
		process.stdout.write(str)
	}

	function execInput(){
		var _input = userInput.trim()

		var last_history = history.slice(-1) 
		if (!last_history[0] || _input != last_history[0]){
			history.push(_input)
		}
		history_nu = history.length 
		router(_input)		
		userInput = '' 
		_lastInput = null
		column_nu = null 
	}
	var _lastInput 
	function historyEcho(){
		if (!_lastInput) _lastInput = userInput
		if (history_nu < 0 ) history_nu = 0 
		if (history_nu > history.length) history_nu = history.length
		var _input = history[history_nu]
		userInput = _input || _lastInput
		column_nu = null
		process.stdout.clearLine()
		process.stdout.cursorTo(0)
		echo(userInput)
	}

	function chgEcho(){
		if (null === column_nu) column_nu = userInput.length - 1
		else if (column_nu < 0 ) column_nu = 0
		else if (column_nu > userInput.length) column_nu = userInput.length 
		process.stdout.cursorTo(column_nu)
	}

	stdin.on("data", function(input) {
		var ascii = input.charCodeAt(0)
		switch (ascii) {
			case 127:
				process.stdout.clearLine()
				process.stdout.cursorTo(0)
				if (null === column_nu){
					userInput = userInput.slice(0 , -1)
				}else {
					userInput = userInput.slice(0, column_nu -1) + userInput.slice(column_nu)
					column_nu--
				}
				echo(userInput)
				if (null !== column_nu){
					chgEcho()
				}
				_lastInput = null
				return
			case 13:
				echo('\n')
				execInput()
				return
			case 3:
				print('Cancelled')
				process.exit()
				return
		}

		switch (input) {
			case '\u001b[A':
				history_nu--
				historyEcho()
				break
			case '\u001b[B':
				history_nu++
				historyEcho()
				break
			case '\u001b[D':
				if (null !== column_nu) column_nu--
				chgEcho()
				break
			case '\u001b[C':
				//上下左右
				if (null !== column_nu) column_nu++
				chgEcho()
				break
			default:
				if (null === column_nu){
					userInput += input 
					echo(input)
				}else {
					userInput = userInput.slice(0, column_nu) + input + userInput.slice(column_nu)
					column_nu++
					process.stdout.clearLine()
					process.stdout.cursorTo(0)
					echo (userInput)
					chgEcho()
				}
				_lastInput = null
				break
		}
	})

}(router)





function print(){
	console.log.apply(console , arguments)
}
function router(input){

	if (!input) return
	var esc = 27 === input.charCodeAt(0)
	input = input.replace(/ +/g,' ').split(' ')
	var act = input[0]
		,param = input.slice(1)
	if (cmds[act]){ 
		print(color.green('  ..processing..'))
		cmds[act].apply( null , param)		
	}else if (esc){
	}else {
		print('inputed %s %s' , color.red(input) , ' no response\n\n')
	}
}

// business
var path = require('path')
	,fs = require('fs')
	//,exec = require('child_process').execSync

function exec(cmd){
	if (util.isArray(cmd)) cmd = cmd.join(' && ')
	return require('child_process').execSync(cmd).toString()
}

const widgetSvn = 'http://svn.meilishuo.com/repos/meilishuo/fex/plover/trunk/widgets/'
const serverRoot = path.resolve(__dirname ,'../server')
const widgetRoot = path.resolve(__dirname ,'../widgets')

const serverConfig = require('../server/config/service.json')

const runBox = path.resolve(__dirname , '../server' , serverConfig.runPath)
const shadowBox = path.resolve(__dirname , '../server' , serverConfig.shadowPath || './.shadow')


process.on('uncaughtException', function(err) {
	print('Caught exception: '  , color.red(err))
})

function printErr(err){
	err = ({
		'0' : 'which module you wanna make'
	})[err || 0] || err
	print(color.red(err))
}

var cmds = {}

cmds.ls = function (all){
	
	var onlineOrgans = exec('svn ls ' + widgetSvn) 
		,localOrgans = fs.readdirSync(widgetRoot)

	onlineOrgans = onlineOrgans.split('\n').map(function(o){
		return o.slice(0 , -1)
	})
	var list1 = localOrgans 
		,list2 = onlineOrgans

	if ('-a' == all){
		list1 = onlineOrgans 
		,list2 = localOrgans
	}

	list1.forEach(function(o){
		o = o.trim()
		if (!o) return
		var checked = list2.indexOf( o ) != -1 
		print(checked ? color.blue(o) : o)
	})
	waiting()
}

cmds['?'] = cmds.help = function(organ){
	if (organ) {
		print(color.grey('---not support yet----'))

	} else { 
		print(color.grey('---command list----'))
		print(Object.keys(cmds).map(function(cmd ,i){
				var comments = cmds[cmd].comments 	
				return color.blue(cmd)  
						+ (comments? color.grey(' [' + comments + '] ') : '') 
						//+ ( 0 == (i+1) % 5 ? '\n' : '')
						
			}).join('   '))
	}

	waiting()
}

cmds.checkout = cmds.co =  function(organ ){
	if (!organ) return printErr() 
	if ('_blank' == organ) return printErr('could not export project _blank')
	var res = exec(['cd ' + widgetRoot  ,'svn co ' + widgetSvn + organ ])
	print(res)
	var res = exec(['cd '+ serverRoot ,'node build.js ' + organ  +  ' --RRsvn=' + widgetSvn])
	print(res)
	waiting()
}
cmds.co.comments = '从线上检出模块'

cmds.rm = cmds.unlink = function(organ){
	if (!organ) return printErr() 
	try{
		var res = exec(['cd '+ serverRoot ,'node build.js ' + organ  +  ' --delete'])
		print(res)
	}catch (err){}
	var res= exec('rm -rf ' + path.resolve(widgetRoot , organ))
	print(res)

	waiting()
}

cmds.update = function(organ){
	if (!organ) return printErr() 
	var p = path.resolve(widgetRoot , organ)
	if (!fs.existsSync(p)) return printErr('could not find module ' + organ)	
	var res = exec('svn up ' + p)
	print(res)
	var res = exec(['cd '+ serverRoot ,'node build.js ' + organ])
	print(res)
	waiting()
}

cmds.mk = function(organ){
	if (!organ) return printErr() 
	var res = exec(['cd '+ serverRoot ,'node build.js ' + organ + ' --mkEmpty'])
	print(res)
	waiting()
}

cmds.update = function(organ){
	if (!organ) return printErr() 
	var p = path.resolve(widgetRoot , organ)
	var cied = exec('find ' + p + ' -name ".svn"' )
	if (cied) {
		var res = exec('svn update ' + p  )
		print(res)
	}else {
		print('尚未提交过')
	}

}

cmds.ci = function(organ ){
	if (!organ) return printErr() 
	var message = Array.prototype.slice.call( arguments , 1).join(' ')
	if (!message) return printErr('svn ci need --message')
	if (message.length < 5) return printErr('ci message must > 5  chars')
	var p = path.resolve(widgetRoot , organ)
	var cied = false
		,wexists = true
	try {
		wexists = exec('svn ls ' + widgetSvn + organ)
	} catch(err){
		wexists = false
		exec('svn mkdir ' + widgetSvn + organ + ' -m "init respo"')
	}
	var cied = exec('find ' + p + ' -name ".svn"' )

	cied = !!cied
	wexists = !!wexists	
	if (cied){
		var res = exec('svn ci ' + p + ' -m "' + message + '"' )
		print(res)
		var st  = exec('svn st ' + p  )
		//var st  = exec('svn st ' + path.resolve(p , 'src')  )
		
		var toAdd = []
			,toDel = []
		st.split('\n').forEach(function(file){
			file = file.trim().replace(/ +/g,' ')
			if (!file) return
			file = file.split(' ')
			switch (file[0] ) {
				case '?':
					toAdd.push(file[1])
					break
				case '!':
					toDel.push(file[1])
					break
				default:
					print('未处理文件:', file[0] , file[1])
			}
		})

		if (toAdd.length) {
			print ('添加文件')
			var res = exec('svn add ' +  toAdd.join(' ') )
			print(res)
			var res = exec('svn ci ' + p + ' -m "' + message + '"' )
			print(res)
		}

		if (toDel.length) {
			print ('将删除' , toDel ,'输入y确认')
			cmds.y = function(){
				delete cmds.y
				var res = exec('svn delete ' +  toDel.join(' ') )
				print(res)
				var res = exec('svn ci ' + p + ' -m "' + message + '"' )
				print(res)
			}
			cmds.y.comments = '输入 y  确认删除'
		}

	} else if (!wexists){
		//init svn

		var citmp =  'rrt'
		exec(['cd ' + widgetRoot 
			, 'rm -rf ' + citmp
			,'mv ' + organ + ' ' + citmp])
		exec([ 'cd ' + widgetRoot
			,'svn co ' + widgetSvn + organ + ' '
			,'mv ' + citmp + '/* ' + organ 
			,'rm -rf ' + citmp
			,'cd  ' +  organ 
			,'svn add ./* '
			,'svn ci ' + p + ' -m "init"'] )
		print(res)
	}else {
		printErr('widget is existed')
	}
	waiting()

}


cmds.rename = function(orgnow , orgnew){
	if (!orgnow || !orgnew) return printErr() 
	var p = path.resolve(widgetRoot , orgnow)
	if (!fs.existsSync(p)) return printErr('could not find module ' + orgnow)	

	var p2 = path.resolve(widgetRoot , orgnew)
	if (fs.existsSync(p2)) return printErr('module ' + orgnew + ' already there')	

	var cied = exec('find ' + p + ' -name ".svn"' )
	if (!!cied) return printErr(orgnow + ' has been submited')
	
	fs.renameSync(p , p2)
	waiting()
	
}

function getIP(){
	var os = require('os')
	var ifaces = os.networkInterfaces()
	var ret = {}
	for (var dev in ifaces) {
	  var alias=0
	  ifaces[dev].forEach(function(details){
		if (details.family=='IPv4') {
		  ret[dev+(alias?':'+alias:'')] = details.address
		  ++alias
		}
	  })
	}
	return ret
}
var myIp = getIP()
var httpConf
	,localIp = myIp['en0'] || myIp['eth0']  || myIp['en1'] || myIp['eth1']  || '127.0.0.1'
function runHTTP(){
	// clear all cache
	var cmd = ['rm -rf ' + shadowBox ,'rm -rf ' + runBox ]
	exec(cmd)
	var config = require(serverRoot + '/http.js').bind(
		{
			'HostIP' : localIp 
		},['local'])
	httpConf = config
}
cmds.build = function(organ){
	if (!organ) return printErr() 
	var cmd = ['cd '+ serverRoot  
				, 'node build.js ' + organ ]
	var res = exec(cmd)
	print(res)
	waiting()

}

cmds.run = function(organ){
	if (!organ) return printErr() 
	var p = path.resolve(widgetRoot , organ)
	if (!fs.existsSync(p)) return printErr('could not find module ' + organ)	
	if (!httpConf) runHTTP()
	print(color.grey('URL:') ,color.magenta(' http://' + localIp + ':' + httpConf.portLocal + '/' + organ))
	reBuildMod(organ)

	var timer

	function reBuildMod(mod ,nodepend ,cbk){
		print(color.orange('rebuild ' + mod) )
		var cmd = ['cd '+ serverRoot  
					, 'node build.js ' + mod +  ' ' + (nodepend? 'nodepend ' : '')]
		var res = exec(cmd)
		print(res)
		cbk && cbk(mod)
	}

	function autoBuild( stats , path){
		print( stats , path)
		if (timer) clearTimeout(timer)
		timer = setTimeout(function(){
			reBuildMod( organ ,  true , function(){})
		} , 300)
	}
	var chokidar = require('chokidar')
	var watcher = chokidar.watch(path.resolve(p , 'src'), {"ignored": /[\/\\]\./, "persistent": true})
	watcher.add(path.resolve(p , 'data') )
	watcher.on('all', autoBuild)
}

	

function waiting(){
	print(color.grey('waiting for the order >>'))
}
waiting()

