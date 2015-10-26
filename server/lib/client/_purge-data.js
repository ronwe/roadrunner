//loadJS('http://rr.x.meilishuo.net/com/js/_purge-data?' + +new Date)
;(function(){
	var beHost = 'quaker.meilishuo.com/'

	var count = 0
	util.toArray(document.scripts).forEach(function(link){
		var src = link.src
		if (src.indexOf(beHost) == -1) return
		count++
		var dss = src.split(beHost)[1]
		dss = dss.split('::')
		dss[1] = '-10m'
		var cbkid = uuid()
		window[cbkid] = function(){
			console.log(src ,'purge')
			if (--count <=0 ) {
				if (window.confirm('数据缓存刷新了，刷下页面')) window.location.reload()
			}
		}
		dss[4] = cbkid
		console.log(dss)
		if (dss[6]) dss[6] = util.build_query(dss[6])

		var url = rrConfig.DSEnd[dss[0]] + '/' + dss.join('::')
		loadJS(url , function()  {
			cbk('erro raised on loading data')
		})

	})
})()
