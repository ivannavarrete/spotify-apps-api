"use strict";

sp = getSpotifyApi(1);

exports.getMetadata = getMetadataWithCache;

var SESSION_STORAGE_PREFIX = "mc-";

function getMetadata(uri, onSuccess, onError) {
	sp.core.getMetadata(uri, {
		onSuccess: compose(onSuccess, partial(cacheMetadata, uri)),
		onFailure: onError
	});
}

/**
 * Wrapper around getMetadata
 * @param {string|Array.<string>} uri
 * @param {function} onSuccess
 * @param {function=} onError
 */
function getMetadataWithCache(uri, onSuccess, onError) {
	var md = sessionStorage.getItem(SESSION_STORAGE_PREFIX + uri);
	if (null === md) {
		getMetadata(uri, onSuccess, onError ? onError : id);
	} else {
		onSuccess(JSON.parse(md));
	}
}

/**
 * @param {string|Array} uri
 * @return {Object}
 */
function cacheMetadata(uri, md) {
	// Don't cache if uninitialized
	if (null !== md)
		sessionStorage.setItem(SESSION_STORAGE_PREFIX + uri, JSON.stringify(md));
	return md;
}