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