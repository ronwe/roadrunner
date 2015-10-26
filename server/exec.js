var queue = [];
var processing = false;
var exec = require('child_process').exec
var pwd = '';
function Cmd(str,cbk){
	this.str = str;
	this.cbk = cbk;
	this.next = null;
}
Cmd.prototype.followBy = function(cmd){
	this.next = cmd;
};
var exeCMD = exports.exeCMD = function(cmd,cbk){
	if(cmd.shift){
		var temp;
		cmd.forEach(function(c,i){
			var _cmd = new Cmd(c[0],c[1]);
			if(i != 0){
				temp.followBy(_cmd);
			}else{
				queue.push(_cmd);
			}
			temp = _cmd;
		});
		process();
		return ;
	}
	if(typeof(cmd) !== 'string'){
		return console.log('expect string command,get ' + typeof(cmd));
	}
	queue.push(new Cmd(cmd,cbk));
	process();
}

var execute = function(cmd){
	processing = true;
	console.log(cmd.str)
	cmd.cbk && typeof(cmd.cbk.start) == 'function' && cmd.cbk.start();
	var change_path = cmd.str.match(/\s*cd\s+([^\&]+)$/);
	if(change_path){
		pwd = change_path[1];
	}
	exec(cmd.str,{ cwd:pwd },function(err,data,stderr){
		(cmd.cbk && typeof cmd.cbk.end == 'function') && cmd.cbk.end(err,data);
		if(!cmd.next || err){
			queue.shift();
			if(queue.length){
				execute(queue[0]);
			}else{
				processing = false;
			}
		}else{
			execute(cmd.next);
		}
	});
}
function process(){
	if(processing) return;
	execute(queue[0]);
}
