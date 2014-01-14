function updateMolgenisTable(molgenisUrl, chr, mutation) {
	if (mutation == null || mutation.typeId == "mutation") {
		var url = '/plugin/genomebrowser/data?segment='+chr;
		if (mutation != null) {
			url = url +'&mutation='+ mutation.id;
		}
		$.ajax({
			url : url,
			type : "GET",
			dataType : "json",
			success : function(data) {
				if (typeof data == 'object') {
					patientMutationTable(data);
				}
			},
			error : function(jqXHR, textStatus, errorThrown) {
				console.log("jqXHR : " + jqXHR + " text status : " + textStatus
						+ " error : " + errorThrown);
			}
		});
	}
}

Browser.prototype.reset = function(){
	for (var i = this.tiers.length - 1; i >= 0; --i) {
		this.removeTier({index: i});
	}
	for (var i = 0; i < this.defaultSources.length; ++i) {
		this.addTier(this.defaultSources[i]);
	}
	
	this.setLocation(this.defaultChr, this.defaultStart, this.defaultEnd);
}
