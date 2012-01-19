/**
 * @copyright (c) 2011 Spotify Ltd
 * @author Erik Bernhardsson <erikbern@spotify.com>
 *
 * These are all classes sharing the same interface. You can think of them as asynchronous iterators.
 * The next(callback) method returns the next track.
 */'use strict';

this.getDefaultPipe = function getDefaultPipe(tracks, seedMetadata) {
	var pipe = new DecayShufflePipe(tracks);
	var pipe = new MetadataDecoratorPipe(pipe, 20);
	var pipe = new FirstTrackRulesPipe(pipe, seedMetadata);
	var pipe = new MetadataFilterPipe(pipe, 20, 5, 10);
	var pipe = new PrefetchImagesPipe(pipe, 3);
	// TODO: add filter rules fetched from backend (should be simple)
	return pipe;
};


/**
 * Takes an underlying pipe and prefetches images for the next few albums
 * @param {Array} pipe The underlying pipe
 * @param {Array} n How many images ahead to prefetch
 */

function PrefetchImagesPipe(pipe, n) {
    this.n = n;
    this.queue = new Array();
    this.callback = null;    
    this.pipe = pipe;
}

PrefetchImagesPipe.prototype.next = function next(callback) {
	if (callback && this.queue.length > 0) {
		callback(this.queue.shift());
		callback = null;
	}

	if (this.queue.length < this.n) {
		var pi = this;
		this.pipe.next(function (elm) {
			console.log("[RADIO] loading image for " + elm.artistName + " - " + elm.trackName + ": " + elm.coverUri);
			elm.coverImg = new Image();
			elm.coverImg.src = elm.coverUri;
			pi.queue.push(elm);
			pi.next(callback);
		});
	}
}

/**
 * Takes an underlying pipe and filters for repeated tracks/albums/artists
 * @constructor
 * @param {Array} pipe The underlying pipe
 */

function MetadataFilterPipe(pipe, maxRepeatTrack, maxRepeatArtist, maxRepeatAlbum) {
	this.pipe = pipe;
	this.maxRetries = 20;
	this.maxRepeatTrack = maxRepeatTrack;
	this.maxRepeatArtist = maxRepeatArtist;
	this.maxRepeatAlbum = maxRepeatAlbum;
	this.lastTracks = new Array();
	this.lastArtists = new Array();
	this.lastAlbums = new Array();
}

MetadataFilterPipe.prototype.next = function next(callback) {
	this.next2(callback, 0);
}

MetadataFilterPipe.prototype.next2 = function next2(callback, retries) {
	var mf = this;
	this.pipe.next(function(elm) {
		var ok = true;
		if (retries < mf.maxRetries) {
			if (mf.lastTracks.indexOf(elm.trackId) != -1)
				ok = false;
			if (mf.lastArtists.indexOf(elm.artistId) != -1)
				ok = false;
			if (mf.lastAlbums.indexOf(elm.albumId) != -1)
				ok = false;
		}
		if (ok) {
			mf.lastTracks.push(elm.trackId);
			mf.lastArtists.push(elm.artistId);
			mf.lastAlbums.push(elm.albumId);

			while (mf.lastTracks.length > mf.maxRepeatTrack)
				mf.lastTracks.shift();
			while (mf.lastAlbums.length > mf.maxRepeatAlbum)
				mf.lastAlbums.shift();
			while (mf.lastArtists.length > mf.maxRepeatArtist)
				mf.lastArtists.shift();

			callback(elm);
		} else if ((retries + 1) >= mf.maxRetries) {
			console.log("[RADIO] " + elm.artistName + " - " + elm.trackName + " not ok, playing anyway...");
			callback(elm);
		} else {
			console.log("[RADIO] " + elm.artistName + " - " + elm.trackName + " not ok, skipping to next...");
			mf.next2(callback, retries + 1);
		}
	});
}
/**
 * Takes an underlying pipe and makes sure that the FIRST track has the same artist as the seed
 * Tracks before the first valid track are stashed then popped in the same order.
 * @constructor
 * @param {Array} pipe The underlying pipe
 */

function FirstTrackRulesPipe(pipe, seedMetadata) {
	this.pipe = pipe;
	this.stashed = new Array();
	this.found = false;
	this.maxRetries = 10;
	this.seedMetadata = seedMetadata;
}

FirstTrackRulesPipe.prototype.next = function next(callback) {
	if(this.stashed.length > this.maxRetries) {
		console.log("[RADIO] Gave up looking for first track with the correct artist, returning whatever");
		this.found = true;
		// max attempts...
	}

	if(this.found) {
		if(this.stashed.length > 0) {
			callback(this.stashed.shift());
		} else {
			this.pipe.next(callback);
		}
	} else {
		var ftr = this;
		this.pipe.next(function(elm) {
			var ok = false;
			
			if(ftr.seedMetadata.genre) {
				ok = true;
			}
			
			if(ftr.seedMetadata.uri == "spotify:artist:" + elm.artistId)
				ok = true;
			// If seed is an artist
			if(ftr.seedMetadata.artists && ftr.seedMetadata.artists[0].uri == "spotify:artist:" + elm.artistId)
				ok = true;
			// If seed is a track
			if(ftr.seedMetadata.uri == "spotify:track" + elm.trackId)
				ok = false;
			// Don't play the seed as the first track
			if(ftr.seedMetadata.name == elm.trackName)
				ok = false;
			// Same

			if(ok) {
				ftr.found = true;
				callback(elm);
			} else {
				console.log("[RADIO] Stashing " + elm.artistName + " - " + elm.trackName);
				ftr.stashed.push(elm);
				ftr.next(callback);
			}
		});
	}
}
/**
 * Takes an underlying pipe and makes sure that we have tagged the reslts
 * with metadata ahead of time.
 *
 * Also removes unplayable tracks.
 *
 * TODO 1: maybe we should just fetch metadata for everything?
 * TODO 2: don't fetch metadata for the same elm twice
 *
 * @constructor
 * @param {Array} pipe The underlying pipe
 */

function MetadataDecoratorPipe(pipe, n) {
    this.pipe = pipe;
    this.queueSize = n;
    this.queue = new Array();
    this.callback = null;
}

MetadataDecoratorPipe.prototype.next = function next(callback) {
    while (this.queue.length > 0) {
	if (!this.queue[0].returned) {
	    break;
	}
	if(this.queue[0].ok) {
	    if (callback) {
		callback(this.queue.shift());
		callback = null;
	    }
	    break;
	} else {
	    this.queue.shift();
	}
    }

    // Refill queue
    var n = this.queueSize - this.queue.length;
    var md = this;

    // Fetch a range of entries
    // When done, fetch the metadata for all of them
    function fetchOneMore(n, k) {
	md.pipe.next(function(elm) {
		elm.returned = false;
		md.queue.push(elm);
		if (k > 0) fetchOneMore(n, k-1);
		else md.fetchMetadata(md.queue.slice(md.queueSize - n, md.queueSize), function() { md.next(callback); }); // TODO: assert that md.queue.length = md.queueSize
	    });
    }
    if (n > (this.queueSize - 2)) fetchOneMore(n, n - 1);
}
    
MetadataDecoratorPipe.prototype.fetchMetadata = function fetchMetadata(elms, callback2) {
    var uris = new Array();
    for (var i = 0; i < elms.length; i++) uris.push("spotify:track:" + elms[i].trackId);
    var md = this;

    console.log("[RADIO] fetching metadata for " + elms.length + " tracks");

    function trackInfoAvailable(metadata) {
	// TODO: assert metadata has same length as elms
	for (var i = 0; i < metadata.length; i++) {
	    var elm = elms[i];
	    var m = metadata[i];
	    elm.returned = true;
	    if (m) {
		elm.trackName = m.name;
		elm.albumId = idFromUri(m.album.uri);
		elm.albumName = m.album.name;
		elm.artistId = idFromUri(m.artists[0].uri);
		elm.artistName = m.artists[0].name;
		elm.coverUri = m.album.cover;
		elm.availableForPlayback = m.availableForPlayback;
		elm.returned = true;
		elm.ok = elm.availableForPlayback;
		elm.starred = m.starred;
	    } else {
		elm.ok = false;
	    }
	}
	
	callback2();
    }

    function trackInfoFailure() {
	// should never happen?
    }

    sp.core.getMetadata(uris, {
	    onSuccess : trackInfoAvailable,
	    onFailure : trackInfoFailure
	});
}
/**
 * An array wrapper that enables getting one random element from the array,
 * behaving like a deck in the sense that the same element will only have a
 * chance of appearing once the whole array has been iterated.
 *
 * @constructor
 * @param {Array} array The array to wrap.
 */
function DeckShufflePipe(array) {
	this.array = array.slice(0);
	// Copy the array
	this.index_ = 0;
}

/**
 * Gets one item from the pipe. If the pipe has been exhausted, the pipe will
 * be reshuffled.
 * @return {*} Returns the next element in the pipe.
 */
DeckShufflePipe.prototype.next = function next(callback) {
	var arr = this.array, length = arr.length, i = this.index_;
	this.index_ = (i + 1) % length;

	var j = Math.round(Math.random() * (length - 1 - i) + i);
	// within [i, length -1]
	var o = arr[j];
	arr[j] = arr[i];
	arr[i] = o;

	callback(o);
}
/**
 * Similar to DeckShufflePipe, but does not guarantee that we cycle through everything.
 * Instead, it chooses element i with probability proportional to k ^ i (where k < 1).
 * Meaning that elements around the top of the list will be chosen with larger probability.
 *
 * @constructor
 * @param {Array} array The array to wrap.
 */
function DecayShufflePipe(array) {
	this.array = array.slice(0);
	// Copy the array
	this.k = Math.pow(0.1, 1.0 / this.array.length);
	// The last elm will be 10x less likely to be chosen
}

/**
 * Gets one item from the pipe
 * @return {*} Returns the next element in the pipe.
 */
DecayShufflePipe.prototype.next = function next(callback) {
	var i = Math.floor(Math.log(1 - Math.random() * (1 - Math.pow(this.k, this.array.length))) / Math.log(this.k));
	callback(this.array[i]);
}
function idFromUri(uri) {
	return (uri.substring(uri.lastIndexOf(":") + 1));
}