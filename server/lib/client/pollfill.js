//polyfill
if (!Function.prototype.bind){
	Function.prototype.bind = function(){
		var fn = this
			,context = arguments[0]
			,args = util.toArray(arguments , 1)
		return function(){
			var args2 = args.concat(util.toArray(arguments))
			return fn.apply(context , args2)
		}
	}
}

if (!Array.prototype.forEach){
	Array.prototype.forEach = function(it){
		for (var i = 0 ,j = this.length ; i < j ; i++){
			it(this[i])
		}
	}
}
/*
if (!window['JSON']){
	window.JSON = {
		'parse' : function (str){
				try {
					return eval('(' + str +  ')')
				}catch(err){
					return str
				}
			}
	}
}
*/
