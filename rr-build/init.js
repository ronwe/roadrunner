var util = require('util')


function print(){
	console.log.apply(console , arguments)
}

var path = require('path')
	,fs = require('fs')
	//,exec = require('child_process').execSync

function exec(cmd){
	if (util.isArray(cmd)) cmd = cmd.join(' && ')
	return require('child_process').execSync(cmd).toString()
}

const packageSvn = 'http://svn.meilishuo.com/repos/meilishuo/fex/plover/trunk/roadrunner/package.json'
const builderSvn = 'http://svn.meilishuo.com/repos/meilishuo/fex/plover/trunk/roadrunner/rr-build/'
const serverSvn = 'http://svn.meilishuo.com/repos/meilishuo/fex/plover/trunk/roadrunner/server/'
const widgetSvn = 'http://svn.meilishuo.com/repos/meilishuo/fex/plover/trunk/widgets/'

const packageFile = path.resolve(__dirname , 'package.json')
const serverRoot = path.resolve(__dirname ,'server')
const widgetRoot = path.resolve(__dirname ,'widgets')
const builderRoot = path.resolve(__dirname ,'rr-build')


var res = exec(['rm -rf  ' + serverRoot
				,'rm -rf  ' + widgetRoot
				,'rm -rf ' + builderRoot
				])
print(res)
var res = exec(['mkdir -p ' + serverRoot
				,'mkdir -p ' + widgetRoot
				,'mkdir -p ' + builderRoot])
print(res)

res = exec(['cd ' + serverRoot 
		, ' svn co ' + serverSvn + ' ./'])
print(res)


res = exec([ 'cd ' + builderRoot 
		, ' svn co ' + builderSvn + ' ./'])
print(res)

res = exec('svn export ' + packageSvn + ' --force')
print(res)

var pageckage = require(packageFile)
var dependencies = pageckage.dependencies

Object.keys(dependencies).forEach(function(node_module){
	res = exec([
				'sudo rm -rf ./node_modules/' + node_module
				,'sudo npm install ' + node_module
				])	
	print(res)
})

