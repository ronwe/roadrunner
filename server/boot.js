var cluster = require('cluster')
	, fs = require("fs")

if (process.argv.length  < 2) return
var server_script = process.argv[2] 
	,args = process.argv.slice(3)

if (server_script.indexOf('.') == -1) server_script +=  '.js'

cluster.setupMaster({
    exec : server_script,
    args : args,
    silent : false
})

for(var i = require('os').cpus().length ; i--;){
    cluster.fork()
}

cluster.on('exit', function (worker, code, signal) {
    console.log('[master] ' + 'exit worker' + worker.id + ' died')
    cluster.fork()
})

fs.createWriteStream("config/pids", {
	flags: "a",
	encoding: "utf-8",
	mode: 0666
}).write(process.pid + "\n")

