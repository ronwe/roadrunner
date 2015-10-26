var fs = require('fs') 
	,path = require('path')
var md5 = require('crypto');
var _cacheArr = {};
var _watched = {};
var compiledFolder = '',
	roadRunner,
	watchingTpl = true;
var htmlend = '\\n',
	fuss = false;
var isWindows = process.platform === 'win32';

var extFnPath = path.resolve(__dirname,'extFn.js')
var estFnPath = path.resolve(__dirname,'est.js')	
var RRFnPath = path.resolve(__dirname,'../rr.js')
var cache_sjt = {}

function dataErrLog( err ){
	console.log('tpl error : ' , err)	
}

function watchTpl(tplname , compiledFile) {
  //var dir = path.dirname(tplname);
  //if (_watched[dir] ) {return;}
  if(_watched[tplname]) {
    return;
  }

  fs.watchFile(tplname, {
    persistent: true,
    interval: 10
  }, onChg);

  function onChg(event, filename) {
    //var tplname = dir + '/' + filename;
	compiledFile = path.resolve(compiledFile)
	delete require.cache[compiledFile]
    _cacheArr[tplname] && delete _cacheArr[tplname];

  }

  _watched[tplname] = true;
  //_watched[dir] = true;
}

function getCompiledName(tplname, tplPre) {
  return compiledFolder + (tplPre || '') + md5.createHash('md5').update(tplname).digest("hex") + '.est';
}

function render(html, data, callBack, tplPre, tplpath) {
	renderFile(tplpath , html, data, callBack, tplPre, false , true) 
}

function renderFile(tplpath, tplname, data, callBack, tplPre, requireFn , withoutFile) {

  if (!withoutFile) tplname = tplpath + tplname;
  var compiledFile = getCompiledName(tplname, tplPre);
  //var compiledFile = tplname + '.est';
  if(watchingTpl &&  !withoutFile) watchTpl(tplname , compiledFile);

  var _clearCache = function(file) {
    var _getHtml = require(file).html;
    if (typeof _getHtml !== 'function') {
        delete require.cache[file];
        _getHtml = require(file).html;
    }
    return _getHtml;
  }

  var fillTpl = function() {
      if(true === requireFn) return _clearCache(compiledFile);
      var html = false
	  try{
		  html = _clearCache(compiledFile).call(data , roadRunner);
	  }catch(err){
		 dataErrLog(err)
	  }
      _cacheArr[tplname] = true;
      if(callBack) {
        callBack(null, html);
      } else {
		if (false === html)
			throw "INCFAIL" + tplname
        return html;
      }
    }

  if(fs.existsSync(compiledFile) && !withoutFile ) {
    ///console.log(tplname , _cacheArr[tplname]);
    if(_cacheArr[tplname]) {
      return fillTpl();
    } else {
      var tplMtime = fs.statSync(tplname).mtime;
      var compileMtime = fs.statSync(compiledFile).mtime;
      //console.log('tplMtime' + tplMtime);
      return tplMtime < compileMtime ? fillTpl() : compile(tplpath, tplname, compiledFile, tplPre, fillTpl , withoutFile);
    }
  } else {
    return compile(tplpath, tplname, compiledFile, tplPre, fillTpl , withoutFile);

  }
}

function compile(tplpath, tplname, compiledFile, tplPre, callBack, withoutFile) {

  function trsTpl(err, data) {

    if(!data) return;
    //// function html_encode(str){return str.replace(/&/, '&amp;').replace(/</g, '&lt;').replace(/\"/g, '&quot;').replace(/'/g, '&#039;'); } ;\n \
    var comFileCon =   "/*--" + (withoutFile  ? '' :tplname) + "--*/ \n \
    var est = require('" + estFnPath + "'); \n \
    var _extFn = require('" + extFnPath + "'); \n \
    function requireFn(tpl) {var x = est.renderFile('" + tplpath + "' ,tpl , null , null ,'" + tplPre + "' ,true); return function(t){ return x.call(t,_RR);} } ; \n \
    function __getHtml (_RR) { \n \
      var __htm ='';\n";
    var funcCon;
    var pos = 0,
      posStart = 0,
      posEnd = 0;
    var bufferLen = data.length;

    var comments_mark = 0
    function fillCmpl(str , plainGram){
        if (comments_mark > 0 ) return
        if (plainGram ) comFileCon += str
        else comFileCon += "__htm += '" + stripBlank(str) + "';\n"
        }
	

    while(true) {
		pos = withoutFile ? data.indexOf('<%' ,pos) : findTag(data, pos, 60, 37);
		if(pos > -1) {
			posEnd = withoutFile ? data.indexOf('%>' , pos + 2) : findTag(data, pos + 2, 37, 62);
		} else {
			///comFileCon += "__htm += '" + stripBlank(buffer2String(data, posStart, bufferLen)) + "';\n";
			fillCmpl(withoutFile ? data.slice(posStart) : buffer2String(data, posStart, bufferLen)) 
			break;
		}
		if((pos > -1) && posEnd) {
			if (withoutFile){
				fillCmpl(data.slice( posStart, pos)) 
				funcCon = data.slice( pos + 2, posEnd) //.replace(/\$_ENGINE_SELF\./g, 'est.');
			} else {
				fillCmpl(buffer2String(data, posStart, pos)) 
				///comFileCon += "__htm += '" + stripBlank(buffer2String(data, posStart, pos)) + "';\n";
				funcCon = data.toString('utf8', pos + 2, posEnd) //.replace(/\$_ENGINE_SELF\./g, 'est.');
			}
			switch(funcCon[0]) {
				case '*':
					switch (funcCon[1]){
                        case '{':
                            comments_mark++
                            break
                        case '}':
                            comments_mark--
							if (comments_mark < 0 ) comments_mark = 0
                            break
                        }	
					break;
				case '=':
					switch(funcCon[1]) {
						case '=':
							var _fn_name = '_extFn.html_encode',
								_func_stripted = stripBlank(funcCon.substr(2));

							fillCmpl( '__htm += ' + _fn_name + '(' + _func_stripted + ");\n" , true)
							///comFileCon += '__htm += ' + _fn_name + '(' + _func_stripted + ");\n";
							break;
						default:
							fillCmpl( '__htm +=' + stripBlank(funcCon.substr(1)) + ";\n" , true)
							///comFileCon += '__htm +=' + stripBlank(funcCon.substr(1)) + ";\n";
							break;
					}
					break;
				case '#':
					fillCmpl( '__htm += est.renderFile("' + tplpath + '" ,"' + funcCon.substr(1).trim() + '",null,null,"' + tplPre + '" ).call(this)||"";\n' , true)
					break;
				case '!':
					var code = getHereDoc(funcCon.substr(1)).trim();
					if(code.substr(-1) == ';') code = code.substr(0, code.length - 1);
					funcCon = '__htm += ' + stripBlank(code) + " || '';\n ";
				default:
					fillCmpl( funcCon + ';' , true)
					///comFileCon += funcCon;
			}

		}
		pos = posStart = posEnd + 2;
		posEnd = 0;
    };

    comFileCon += "return __htm;} \n exports.html = __getHtml; ";

	function onWriteDone(e) {
		if(e) {} else {

			delete require.cache[compiledFile];
			_cacheArr[tplname] = true; //compiledFile;
			return callBack();
		}
	};
    //console.log(compiledFile);
    fs.writeFileSync(compiledFile, comFileCon);
    return onWriteDone();
  };
	//fs.readFile(tplname , trsTpl);
	if (withoutFile )
		return trsTpl(null, tplname)
	else
		return trsTpl(null, fs.readFileSync(tplname));
}

function stripBlank(str) {
	str = str.replace(/ _RR\.([a-zA-Z0-9]+)\b/g, ' _RR.load("$1")')
	if(fuss) {
		str = str.replace(/[  ]+/g, ' ');
	}
	return str;
}

function getHereDoc(str) {
  var herepos = str.indexOf('<<<');
  if(herepos < 0) return str;
  var hereTag = str.substring(herepos + 3, str.indexOf(':', herepos)) + ':';
  var tmpv = str.split(hereTag);
  tmpv[0] = tmpv[0].substr(0, herepos);
  tmpv[1] = tmpv[1].trim().replace(/"/g, '\\"')
			.replace(/[\r\n]+/g, '\\n')///.replace(/[\r\n]+/g, ';'+htmlend)	//	.replace(/[\r\n]+/g, htmlend)

  str = tmpv.join('');

  return getHereDoc(str);

}

function buffer2String(buffer, start, end) {
  return buffer.toString('utf8', start, end).replace(/\\/g, '\\\\').replace(/[\n\r]+/g, htmlend).replace(/'/g, "\\'");
}

function findTag(buffer, start, char1, char2) {
  for(var i = start, j = buffer.length; i < j; i++) {
    if(buffer[i] == char1 && buffer[i + 1] == char2) {
      return i;
    }
  }
  return -1;
}
var assigned = {}
exports.assignFn = function(fname, fncxt) {
  assigned[fname] = fncxt
}
exports.callFn = function(fname) {
  return assigned[fname]
}

exports.renderFile = renderFile
exports.render = render
exports.setOption = function(options) {
  compiledFolder = options.compiledFolder || '';
  roadRunner = options.roadRunner
  if(options.hasOwnProperty('watchingTpl')) watchingTpl = options.watchingTpl;
  if(options.hasOwnProperty('fuss')) {
    fuss = options.fuss;
    htmlend = options.fuss ? '' : htmlend;
  }
}
