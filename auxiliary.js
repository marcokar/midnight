
exports.decJson = function (m) {
	return JSON.parse(exports.cleanString(m));
}

exports.encJson = function (j) {
	return JSON.stringify(j) + "\n";
}

exports.cleanString = function (s) {
	// preserve newlines, etc - use valid JSON
	s = s.replace(/\\n/g, "\\n")
		.replace(/\\'/g, "\\'")
		.replace(/\\"/g, '\\"')
		.replace(/\\&/g, "\\&")
		.replace(/\\r/g, "\\r")
		.replace(/\\t/g, "\\t")
		.replace(/\\b/g, "\\b")
		.replace(/\\f/g, "\\f")
		.replace(/[\u0000-\u0019]+/g, "");
	return s;
}
