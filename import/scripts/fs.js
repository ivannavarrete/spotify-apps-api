"use strict";

sp = getSpotifyApi(1);

exports.readFile = readFile;

function readFile(fileName) {
	var fileContents = sp.core.readFile(fileName);
	if (null === fileContents) {
		throw new Error("Bad file descriptor \"" + fileName + "\"");
	}
	return fileContents;
}
