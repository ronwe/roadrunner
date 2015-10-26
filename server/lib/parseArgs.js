
exports.parse = function(config ,args) {
	args = args || [];
	process.argv.slice(2).forEach(function (val) {
		if ('--' == val.slice(0,2)) {
			val = val.slice(2).split('=')
			if (val[1] == void 0) val[1] = true
			config[val[0]] = val[1]
		}else{
			args.push(val)
		}
	});
}

