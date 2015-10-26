var path = require('path')
	,fs = require('fs')
	,exec = require('child_process').exec

var config = require('./config/service.json')
var parseArgs = require(config.libPath + 'parseArgs.js')
var args = []
parseArgs.parse(config,args)

var uptime_val = JSON.stringify( (+new Date).toString(32) )

console.log('uptime be set to ' + uptime_val)

var box = path.resolve(config.runPath)

args.forEach(function(organ){
	var uptime_conf = path.resolve(config.modPath , organ , 'conf/uptime.json')

	console.log('update : ' + organ)

	var sub_box = path.resolve(box , 'conf' , organ)
	if (!fs.existsSync(sub_box)) return console.log('this mod isnt in run env')

	fs.writeFile(uptime_conf , uptime_val ,function(err){
		if (err) return console.log('uptime err : [ ' + organ + ' ] '+  err)

		var cmd = 'cp ' + uptime_conf + '  ' + sub_box + ' '
		exec(cmd, function(err , stdout){
			if (err) console.log('copy error ' + err)
		})

	}) 
})

