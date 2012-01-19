/**
 * @copyright (c) 2011 Spotify Ltd
 * @author Andreas Blixt <blixt@spotify.com>
 * @author Gandalf Hernandez <gandalf@spotify.com>
 * @author Erik Bernhardsson <erikbern@spotify.com>
 * @author Sriram Malladi <sriram@spotify.com>
 * @author Ernie Yu <ernie@spotify.com>
 */

'use strict';

var dom = sp.require('sp://import/scripts/dom'),
	kbd = sp.require('sp://import/scripts/keyboard'),
	r = sp.require('sp://import/scripts/react'),
	hermes = sp.require("sp://import/scripts/hermes"),
	ui = sp.require('sp://import/scripts/ui'),
	dnd = sp.require('sp://import/scripts/dnd'),
    lang = sp.require('sp://import/scripts/language');

var ac = sp.require('autocomplete');
var ic = sp.require('imageCarousel');
var pipes = sp.require('pipes');
var cloud = sp.require('cloud');

var catalog = lang.loadCatalog("cef_views");
var _ = partial(lang.getString, catalog, "Radio");

// Hermes data structures for radio.
sp.core.registerSchema([{
	name: 'Rules',
	id: 1,
	fields: [{
		id: 1,
		name: 'js',
		type: 'string'
	}]
}]);

sp.core.registerSchema([{
	name: 'Tracks',
	id: 1,
	fields: [{
		id: 1,
		name: 'gids',
		type: '*string'
	},{
		id: 2,
		name: 'source',
		type: 'string'
	},{
		id: 3,
		name: 'identity',
		type: 'string'
	}]
}]);

sp.core.registerSchema([{
	name: 'TracksOld',
	id: 1,
	fields: [{
		id: 1,
		name: 'gids',
		type: '*string'
	}]
}]);

// Initialize radio.
dom.listen(window, 'DOMContentLoaded', _init);
function _init() {

	// Rules currently not in effect
	//loadRules();

	// Set section titles
	dom.queryOne('#first-time h2').innerHTML = _('First time header');
	dom.queryOne('#first-time div').innerHTML = _('First time message');
	dom.queryOne('#first-time button').innerHTML = _('First time hide');
	dom.queryOne('#offline-error').innerHTML = _('Offline');
	dom.queryOne('#station-error').innerHTML = _('Missing station');
	dom.queryOne('#share-radio span#text').innerHTML = _('Share Station');
	dom.queryOne('#create-station .button span').innerHTML = _('Create Station');
	dom.queryOne('#echonest div').innerHTML = _('Powered By');
	dom.queryOne('#genres h2').innerHTML = _('Popular Genres');

	var genreDict = {
		"alternative": [_("Alternative"), 1 << 0],
		"black_metal": [_("Black Metal"), 1 << 1],
		"blues": [_("Blues"), 1 << 2],
		"classical": [_("Classical"), 1 << 3],
		"country": [_("Country"), 1 << 4],
		"dance": [_("Club/House"), 1 << 5],
		"death_metal": [_("Death Metal"), 1 << 6],
		"electronic": [_("Electronic"), 1 << 7],
		"emo": [_("Emo"), 1 << 8],
		//"folk": [_("Folk"), 1 << 9],
		"hardcore": [_("Hardcore"), 1 << 10],
		"heavy_metal": [_("Heavy Metal"), 1 << 11],
		"hip_hop": [_("Hip-Hop"), 1 << 12],
		"indie": [_("Indie"), 1 << 13],
		"jazz": [_("Jazz"), 1 << 14],
		"latin": [_("Latin"), 1 << 15],
		"pop": [_("Pop"), 1 << 16],
		"punk": [_("Punk"), 1 << 17],
		"reggae": [_("Reggae"), 1 << 18],
		"r_n_b": [_("R&B"), 1 << 19],
		"rock": [_("Rock"), 1 << 20],
		"singer_songwriter": [_("Singer-Songwriter"), 1 << 21],
		"soul": [_("Soul"), 1 << 22],
		"trance": [_("Trance"), 1 << 23],
		"60s": [_("60s"), 1 << 24],
		"70s": [_("70s"), 1 << 25],
		"80s": [_("80s"), 1 << 26],
		"90s": [_("90s"), 1 << 27]
	}

	r.fromDOMEvent(window, 'resize').subscribe(function (e) {
		adjustHeaderWidth();
	});

	r.fromDOMEvent(window, 'click').subscribe(function (e) {
		// Find an anchor somewhere between the clicked element and the element
		// that the handler is attached to. The anchor element has to link to
		// a Spotify URI.
		var a = e.target;
		while (true) {
			if (a.tagName == 'A' && a.href.substr(0, 8) == 'spotify:') {
				// Skip handling for auto-complete form, which uses callback
				// to handle user actions.
				if (isInAutoComplete(a)) {
					return;
				}
				if (a.className.indexOf('outgoing') == -1) {
					e.preventDefault();

                    // Note that the section elements in the HTML controls what goes into logging
                    var element = "link";
                    var o = a;
                    while(o = o.parentNode) {
                        if (o.tagName == "SECTION") {
                            element = o.id;
                            break;
                        }
                    }
					loadStation(a.href, "spotify:app:radio", "", element, true);
				}
				return;
			} else if (a.tagName == 'A' && a.href == 'radio:skip') {
				e.preventDefault();
				// Get next track only if not disabled.
				if (a.className.search('disabled') === -1) {
					findNextTrack(true);
				}
			} else if (a.tagName == 'A' && a.href == 'radio:star') {
				e.preventDefault();
				if (curTrack) {
					curTrack.starred = !curTrack.starred;
					var trackUri = curTrackUri;
					var playlist = sp.core.getStarredPlaylist();
					if (curTrack.starred) {
						playlist.add(trackUri);
					} else {
						var len = playlist.length;
						for (var i = 0; i < len; ++i) {
							if (playlist.get(i) == trackUri) {
								playlist.remove(i);
								break;
							}
						}
					}
					// We will get a change message through the client, that will update the star,
					// but it can take a little while, so we update right away.
					dom.queryOne('#radio-star').className = curTrack.starred ? "starred" : "";
				}
			} else if (a.tagName == 'A' && a.href == 'radio:play-pause') {
				e.preventDefault();
				playPause();
			} else if (a.className && a.className.search('playButton') !== -1) {
				e.preventDefault();
				playPause();
			} else if (a.tagName == 'A' && a.href == 'radio:share') {
                var radioUri = seed.replace('spotify', 'spotify:radio');
				e.preventDefault();
                console.log(radioUri);

                // Find the location in the document
                var x = parseInt(a.offsetWidth) / 2, y = parseInt(a.offsetHeight), obj = a;
                do {
                    x += obj.offsetLeft;
                    y += obj.offsetTop;
                    console.log(x,y);
                } while(obj = obj.offsetParent);
                sp.social.showSharePopup(parseInt(x), parseInt(y), radioUri);
			} else if (a == e.currentTarget) {
				return;
			}
			a = a.parentNode;
			if (!a) { return; }
		}
	});

	function fillTopList(selector, titleHTML, items) {
		if (typeof items === 'undefined' || items.length === 0) {
			dom.queryOne(selector).style.display = 'none';
			return;
		}
		var carousel = new ic.ImageCarousel(selector, titleHTML);
		for (var i = 0; i < items.length && i < 10; i++) {
			var item = items[i];
			var imgSrc, title = {}, subtitles = [];
			switch (item.type) {
				case 'artist':
					imgSrc = item.portrait;
					title.name = item.name;
					title.link = item.uri;
					break;
				case 'track':
					imgSrc = item.album.cover;
					title.name = item.artists[0].name;
					title.link = item.artists[0].uri;
					var subtitle = {};
					subtitle.name = item.name;
					subtitle.link = item.uri + "?action=browse";
					subtitles.push(subtitle);
					break;
				default:
					continue;
			}
			if (!isValidImageUri(imgSrc)) {
				imgSrc = "";
				console.log("[RADIO] Empty image for ", item);
			}
			carousel.addItem(item.uri, imgSrc, title, subtitles);
		}
		carousel.scrollTo(0);
	}
	var topArtists = [], topTracks = [], popularArtistsLoaded = false, userTopArtistsLoaded = false;

	function playTopArtist() {
		console.log('[RADIO]', stationLoaded, userTopArtistsLoaded, popularArtistsLoaded, topArtists.length);
		if (!stationLoaded && userTopArtistsLoaded && popularArtistsLoaded && topArtists.length > 0) {
			loadStation(topArtists[0].uri, "spotify:app:radio", "", "autostarttopartist", false);
		}
	}

	function fillTopArtists() {
		sp.social.getToplist('artist', 'user', sp.core.user.canonicalUsername, {
			onSuccess: function (r) {
				console.log('[RADIO] user top artists ok');
				if (r.artists.length > 0) {
					topArtists = r.artists;
				}
				console.log('[RADIO] user top artists ok', topArtists.length);
				fillTopList('#topartists', _("Your Top Artists Stations"), r.artists);
			},
			onComplete: function(_) {
				console.log('[RADIO] user top artists complete');
				userTopArtistsLoaded = true;
				playTopArtist();
				// Fill top tracks only after top artists completed.  This
				// prevents the JS bridge from getting confused, which causes
				// artist image uris to be missing.
				fillTopTracks();
			}
		});
	}

	function fillTopTracks() {
		sp.social.getToplist('track', 'user', sp.core.user.canonicalUsername, {
			onSuccess: function (r) {
				topTracks = r.tracks;
				fillTopList('#toptracks', _("Your Top Tracks Stations"), r.tracks);
			}
		});
	}

	// Fill popular radio stations list
	function fillPopularStations() {
		var artists=null, tracks=null;

		function fill() {
			if (artists === null || tracks === null) {
				return;
			}
			var items = [];
			var more = true;
			var ai = 0, ti = 0;
			while(more) {
				more = false;
				if (artists.length > ai) {
					items.push(artists[ai++]);
					more = true;
				}
				if (tracks.length > ti) {
					items.push(tracks[ti++]);
					more = true;
				}
			}
			fillTopList('#popular', _("Popular Stations"), items);
		}

		sp.social.getToplist('artist', '', sp.core.user.canonicalUsername, {
			onSuccess: function (r) {
				console.log('[RADIO] global top artists ok');
				if(topArtists.length == 0) { topArtists = r.artists; }
				console.log('[RADIO] global artists ok', topArtists.length);
				artists = r.artists;
				fill();
			},
			onComplete: function (r) {
				popularArtistsLoaded = true;
				playTopArtist();
			}
		});

		sp.social.getToplist('track', '', sp.core.user.canonicalUsername, {
			onSuccess: function (r) {
				if(topTracks.length == 0) { topTracks = r.tracks; }
				tracks = r.tracks;
				fill();
			}
		});
	}


	function fillGenres() {
		var genreLis = []
		function addGenre(name, canonical) {
			var li = dom.Element('li');
			var a = dom.Element('a', {className: 'main', href: "spotify:genre:" + canonical});
			var img = dom.Element('span', {className: 'genre-image'});
			var text = dom.Element('span', {className: 'genre-text', innerHTML: name});

			a.appendChild(img);
			a.appendChild(text);
			li.appendChild(a);
			genreLis.push(li);
		}

		for (var genre in genreDict) {
			addGenre(genreDict[genre][0], genre);
		}
		
		new cloud.Cloud('#genres>div', genreLis);
	}

	// Set up autocomplete. ---------------------------------------------------------
	// TODO: Create a generic autocomplete library.
	var createStation = dom.queryOne('#create-station');
	var showingAutocomplete = false;
	var autocompleteForm = dom.queryOne('.auto-completeForm'),
		searchInput = ac.tokenInput.input,
		outputElement = ac.setupAutoComplete(ac.tokenInput, function(){
            loadStation(searchInput.value, "spotify:app:radio", "", "search", true);
            hideAutocomplete();
        });


	// Creating the method that runs the autocomplete search and updates the table.
	// Take some default methods defined in autocomplete.js and curry them
	var searchHandler = partial(ac.searchResultHandler, ac.tokenInput, outputElement);
	var autocomplete = partial(ac.autoComplete, searchHandler, function() {return {tracks: topTracks, artists: topArtists}});

	function showAutocomplete() {
		showingAutocomplete = true;
		dom.queryOne('#create-station .upArrowContainer').style.display = 'block';
		dom.queryOne('#create-station .auto-completeForm').style.display = 'block';
		dom.queryOne('#create-station input').focus();
		searchInput.value = '';
		ac.tokenInput.clear();
		autocomplete({target: searchInput});
	}
	function hideAutocomplete() {
		showingAutocomplete = false;
		dom.queryOne('#create-station .upArrowContainer').style.display = 'none';
		dom.queryOne('#create-station .auto-completeForm').style.display = 'none';
		searchInput.value = '';
		ac.tokenInput.clear();
	}

	// Some interesting events
	var keyDowns = r.fromDOMEvent(window, 'keydown'),
	escapes = r.filter(function (e) {
		return 27 === e.keyCode;
	}, keyDowns);

	dom.adopt(autocompleteForm, ac.tokenInput.node);

	// Escape key pressed while focused
	kbd.whileFocused(searchInput, escapes).subscribe(function (_) {
		hideAutocomplete();
	});

	r.fromDOMEvent(searchInput, 'input').subscribe(ac.throttle(autocomplete, 500));

	r.fromDOMEvent(window, 'click').subscribe(function (e) {
		// The click was over the create stations button, toggle autocomplete, otherwise hide it
		var target = e.target;
		while (target) {
		    if (target.className == 'auto-completeForm') {return;}
			if (target.id == 'create-station') {
				if (showingAutocomplete) {
					hideAutocomplete();
				} else {
					showAutocomplete();
				}
				return;
			}
			target = target.parentNode;
		}
		hideAutocomplete();
	});


	// Finished setting up auto complete ---------------------------------------------------------

	sp.trackPlayer.addEventListener("playerStateChanged", playerStateChanged);
	sp.core.addEventListener("loginModeChanged", loginModeChanged);


	var seed = "", tracks = [], history = [],
	pipe = null, recent = {}, curTrack = null, curTrackUri = null, skips = 0;
	var stationTimeout = null, trackCache = {};

	r.fromDOMEvent(dom.queryOne("#hide-first-time"), 'click').subscribe(function (e) {
		dom.queryOne("#first-time").style.display = "none";
	});

	r.fromDOMEvent(dom.queryOne("#station-error"), 'click').subscribe(function (e) {
		dom.queryOne("#station-error").style.visibility = "hidden";
		window.clearTimeout(stationTimeout);
	});

	function parseTracksHermes(reply, seed, startPlaying, source, context, element, target) {
		var newTracks;
    	newTracks = sp.core.parseHermesReply("Tracks", reply);
        console.log("[RADIO] source: ", newTracks.source);
        console.log("[RADIO] identity: ", newTracks.identity);
        sp.core.logClientEvent("", "loadstation", "1", "1",
            {"source": source, "context": context, "element": element, "target": target, "targetsource": newTracks.source });
		stationAvailable(seed, newTracks, startPlaying, newTracks.source);
	}

	function stationNotFound(seed) {
		dom.queryOne("#station-error").style.visibility = "visible";
		stationTimeout = window.setTimeout(
				'document.getElementById("station-error").style.visibility = "hidden";', 5000);
	}

	function artistFallback(seed, startPlaying, source, context, element) {
		console.log("[RADIO] Track seed not found - trying to create station for artist.");
		sp.core.getMetadata(seed, {
			onSuccess: function (metadata) {
                var artistSeed = metadata.artists[0].uri;
                var target = artistSeed.replace("spotify", "spotify:radio");

				_hermes("GET", _seedToPath(artistSeed), [], {
					onSuccess: function(s) {
						// TODO: This may not be needed anymore since onFailure is wired up
						if (s === undefined) {
							stationNotFound(seed);
							return;
						}
						parseTracksHermes(s, seed, startPlaying, source, context, element, target);
					},
					onFailure: function (_) {
						console.log('[RADIO] Failed to load fallback station for : ', seed, ': hermes failure', arguments);
                        sp.core.logClientEvent("", "loadstationerror", "1", "1",
                            {"source": source, "context": context, "element": element, "target": target });
						stationNotFound(seed);
					}
				});
			},
			onFailure: function(_) {
				stationNotFound(seed);
			}
		});
	}

	function showLoadingScreen() {
		var loading = dom.queryOne('#loading');
		loading.style.display = 'block';
		var img = dom.queryOne('#loading-throbber');
		img.style.display = 'block';
		img.style.backgroundPositionX = '0px';
		function animate() {
			if (loading.style.display != 'none') {
				var bpx = parseInt(img.style.backgroundPositionX.replace('px', ''));
				img.style.backgroundPositionX = ((bpx + 30) % 360) + 'px';
				setTimeout(animate, 80);
			}
		};
		animate();
		var playButton = dom.queryOne('#playing-covers>li>a>div>span');
		if (playButton != null) {
			playButton.style.display = 'none';
		}
		dom.queryOne('#playing-skip>a').style.display = "none";
	}
	function hideLoadingScreen() {
		dom.queryOne('#loading').style.display = 'none';
		dom.queryOne('#loading-throbber').style.display = 'none';
		var playButton = dom.queryOne('#playing-covers>li>a>div>span');
		if (playButton != null) {
			playButton.style.display = 'block';
		}
		dom.queryOne('#playing-skip>a').style.display = "block";
	}

	var stationLoaded = false;
	function loadStation(newSeed, source, context, element, startPlaying) {

        // If the source is the radio, then we fixup the context to have a proper Spotify URI
        // The seed will be spotify:artist:xxx, spotify:track:yyy, or spotify:genre:zzz,
        // We use the current seed to show what station they are coming from
        // Colon come in as ^s if coming from the stitch arguments.
        var target = newSeed.replace("spotify", "spotify:radio");
        source = source.replace(/\^/g, ":");
        context = context.replace(/\^/g, ":");
        element = element.replace(/\^/g, ":");

        if (source == "spotify:app:radio" && context == "") {
            context = seed.replace("spotify", "spotify:radio");
        }

        console.log("[radio] load station, seed: [" + seed + "], source: [" + source +
                "], context: [" + context + "], element: [" + element + "], target: " + target + "]");

		for (var y = window.pageYOffset, i = 1; y > -100; y -= 100, ++i) {
			setTimeout("window.scrollTo(window.pageXOffset, " + Math.max(y, 0).toString() + ")", 10 * i);
		}

		_event(window, 'radioPlayLoading');
		stationLoaded = true;

		function handleFail(context, element, target) {
            sp.core.logClientEvent("", "loadstationerror", "1", "1",
                {"source": source, "context": context, "element": element, "target": target });
			if (newSeed.search("spotify:track:") == 0) {
				artistFallback(newSeed, startPlaying, source, context, element, target);
			} else {
				stationNotFound(newSeed);
			}
		}

		showLoadingScreen();
		_hermes("GET", _seedToPath(newSeed), [], {
			onSuccess: function(s) {
				// TODO: This may not be needed anymore since onFailure is wired up
				if (s === undefined) {
					handleFail(context, element, target);
					return;
				}
				parseTracksHermes(s, newSeed, startPlaying, source, context, element, target);
			},
			onFailure: function(_) {
				console.log('[RADIO] Failed to load station for : ', newSeed, ': hermes failure', arguments);
				hideLoadingScreen();
				handleFail(context, element, target);
			}
		});
	}

	function stationAvailable(newSeed, newTracks, startPlaying, trackSource) {
		console.log("Station available for: " + newSeed);
		console.log('Tracks in the station: ', newTracks)

		trackCache = {};

		dom.queryOne('#playing').style.display = 'block';

		// Skip Echo Nest attribution for genre seeds.
		if (trackSource === "en") {
			dom.queryOne("#echonest").style.display = "block";
		    setTimeout(function() { dom.queryOne('#echonest').style.display = "none"; }, 3000);
		}

		// Clear out the covers, and the name of the currently playing track
		var covers = document.getElementById('playing-covers');
		while (covers.hasChildNodes()) {
			covers.removeChild(covers.lastChild);
		}

		replaceLink(dom.queryOne('#radio-track'), "", "");
		replaceLink(dom.queryOne('#radio-artist'), "", "");

		tracks = [];

		for (var i in newTracks.gids) {
			var entry = {};
			entry.trackId = newTracks.gids[i];
			entry.trackName = "";
			entry.albumId = "";
			entry.albumName = "";
			entry.artistId = "";
			entry.artistName = "";
			entry.coverUri = "";
			entry.starred = false;
			entry.hasMetadata = false;
			tracks.push(entry);
		}

		seed = newSeed;

		function start(metadata) {
			pipe = pipes.getDefaultPipe(tracks, metadata);
        	var temporaryPlaylist = getTemporaryPlaylist();
			while (temporaryPlaylist.length > 0) {
				temporaryPlaylist.remove(temporaryPlaylist.length - 1);
			}
			findNextTrack(startPlaying);
		}
		
		var seedLink = dom.queryOne('#radio-seed');

		var seedId = seed.replace('spotify:genre:', '');
		if (seedId in genreDict) {
			// genre station
			var metadata = {
				uri: seed,
				name: genreDict[seedId][0],
				genre: true,
				img: 'genre-images/genre-' + seedId + '.png'
			}
			dom.queryOne('span', seedLink).style.backgroundImage = "url(" + metadata.img + ")";
			dom.queryOne('h2', seedLink).innerHTML = lang.format(_("Current genre station"), metadata.name);
			addRecentStation(metadata.name,
			                 metadata.uri,
			                 "",
			                 "",
			                 metadata.img);
			start(metadata);
			return;
		}
		sp.core.getMetadata(seed, {
			onSuccess: function (metadata) {
				seedLink.style.display = 'block	';

				if (metadata.type == "track") {
					var trackHTML = "<a class='outgoing' href='" + metadata.uri + "?action=browse'>" + metadata.name + "</a>";
					var artistHTML = "<a class='outgoing' href='" + metadata.artists[0].uri + "'>" + metadata.artists[0].name + "</a>";
					dom.queryOne('h2', seedLink).innerHTML = lang.format(_("Current track station"), trackHTML, artistHTML);
				} else {
					var artistHTML = "<a class='outgoing' href='" + metadata.uri + "'>" + metadata.name + "</a>";
					dom.queryOne('h2', seedLink).innerHTML = lang.format(_("Current artist station"), artistHTML);
				}

				// If we're not supposed to start playing this station, then just show
				// the station image in the current track picture. TODO: May want to show first track?

				if (metadata.type === "track") {
					addRecentStation(metadata.artists[0].name,
									 metadata.artists[0].uri,
									 metadata.name,
									 metadata.uri,
									 metadata.album.cover);
					dom.queryOne('span', seedLink).style.backgroundImage = "url(" + metadata.album.cover + ")";
				}
				else {
					addRecentStation(metadata.name,
									 metadata.uri,
									 "",
									 "",
									 metadata.portrait);
					var seedImg = (metadata.portrait != "") ? metadata.portrait : "sp://import/img/placeholders/64-artist.png";
					dom.queryOne('span', seedLink).style.backgroundImage = "url(" + seedImg + ")";
				}

				console.log("pipes = " + pipes);
				start(metadata);
			},
			onFailure: function () {
				console.log("[RADIO] Failed to fetch metadata for: ", seed);
				hideLoadingScreen();
			}
		});
	}

	function findNextTrack(startPlaying) {
        var temporaryPlaylist = getTemporaryPlaylist();

		console.log('[RADIO] Finding next track', startPlaying, temporaryPlaylist.length);
		function play(start, elm) {
			if (!elm) {
				console.log("[RADIO] No tracks available");
				// TODO: for whatever reason - show error!
				return;
			}
			addTrackToTempList(start, elm);
			if (start) {
				if (temporaryPlaylist.get(0) !== "spotify:track:" + elm.trackId) {
					temporaryPlaylist.remove(0);
				}
				playTrack(true);
			} else {
				playTrack(false);
			}
			if (temporaryPlaylist.length < 2) {
				pipe.next(partial(play, false));
			}
		}
		if (temporaryPlaylist.length < 2) {
			pipe.next(partial(play, startPlaying));
		} else if (startPlaying) {
			temporaryPlaylist.remove(0);
			playTrack(startPlaying);
			findNextTrack(false);
		}
	}

	function trackUsage() {
		var entry = {}, d = new Date();
		entry.trackId = curTrackUri;
		entry.albumId = "spotify:album:" + curTrack.albumId;
		entry.artistId = "spotify:track:" + curTrack.artistId;

		entry.timestamp = Math.round(d.getTime() / 1000);	 // seconds since 1970

		history.push(entry);
	}

	var covers = document.getElementById('playing-covers');
	function _deleteCover() {
		if (getComputedStyle(this).opacity === '0') {
			covers.removeChild(this);
		}
	}
	function rotateCovers(newTrackLink, newCoverSrc, trackName) {
		var firstItem = dom.queryOne('li', covers),
			newItem = document.createElement('li');
		if (newCoverSrc == "") { 
			newCoverSrc = "sp://import/img/placeholders/300-album.png";
		}
		newItem.addEventListener('webkitTransitionEnd', _deleteCover);
		newItem.innerHTML = '<a class="outgoing" href="' + newTrackLink +
			'?action=browse"><img src="' + newCoverSrc + '"/><div><span class="playButton"></span></div></a>';
		console.log("[RADIO] " + trackName, newItem);
		newItem.firstChild.title = trackName;
		covers.insertBefore(newItem, firstItem);
	}


	function addTrackToTempList(startPlaying, track) {
		var trackUri = 'spotify:track:' + track.trackId;
		trackCache[trackUri] = track;
		getTemporaryPlaylist().add(trackUri);
	}
	
	// Function to play the next song, will update the previous
	// song displays, as well as save to history. The current track
	// has already been updated to point to the track to play
	function playTrack(startPlaying) {
        var temporaryPlaylist = getTemporaryPlaylist();
		var nextUri = temporaryPlaylist.getTrack(0).uri;
		console.log('[RADIO] playTrack', curTrack, nextUri, temporaryPlaylist.length, startPlaying);
		if (nextUri === null || (curTrack && nextUri === curTrackUri)) {
			return;
		}
		var nextTrack = trackCache[nextUri];
		console.log('[RADIO] playing', nextTrack) 
		
		curTrack = nextTrack;
		curTrackUri = "spotify:track:" + curTrack.trackId;
		
		replaceLink(dom.queryOne('#radio-track'),
			curTrack.trackName, curTrackUri + "?action=browse");
		replaceLink(dom.queryOne('#radio-artist'),
			curTrack.artistName, "spotify:artist:" + curTrack.artistId);

		dom.queryOne('#radio-star').className = curTrack.starred ? "starred" : "";

		var text = lang.format(lang.getString(catalog, "Misc", "Item by artists"),
				curTrack.trackName, curTrack.artistName);

		rotateCovers(curTrackUri, curTrack.coverUri, text);
			dom.queryOne("#radio-star").style.display = 'block';
			console.log("[RADIO] Play: " + curTrackUri);
		hideLoadingScreen();

		if (startPlaying) {
			playCurrentTrack();
		} else {
			// Because the radio needs to consider outside songs playing before coming here
			updatePlayPauseControls();
		}


		// TODO: This should be triggered when we've played 30 seconds of a song
		trackUsage();
	}

	// Tell the C++ client to play the current track. This function skips most of
	// the UI updates that happen when transitioning from one track to the next.
	function playCurrentTrack() {
		// Disable the skip button until the track starts playing completely
		var skip = dom.queryOne('#playing-skip>a');
		skip.className += "disabled";

		var temporaryPlaylist = getTemporaryPlaylist();
		sp.trackPlayer.playTrackFromContext(temporaryPlaylist.uri, 0, "", {
			onSuccess: function (s) {
				console.log("[RADIO] play ok");
															},
			onError: function(_) { console.log("[RADIO] play error"); },
			onComplete: function(_) { 
				var check = function() {
					// Enable the skip button when the global skip button is enabled.
					// Prevents "track not found" errors when the user skips very fast.
					var playingTrack = sp.trackPlayer.getNowPlayingTrack();
					if (typeof playingTrack === 'undefined' || 
						playingTrack === null ||
						playingTrack.track.uri !== curTrackUri) {
						setTimeout(check, 500);
					} else {
						skip.className = skip.className.replace(/disabled/g, '');
						updatePlayPauseControls();
					}
				};
				check();
				console.log("[RADIO] play complete"); 
			}
		});
	}

  // TODO(djlee): globals :( Refactor this file to keep state on a RadioPlayer
	// object or similar.
	var previousContext = [];
	var currentContext = [];

	function playerStateChanged(event) {
		// If the current track & play state changed
		// the track started or ended, we then
		// check what's playing, and if nothing, the track ended
		console.log("playerStateChanged event", event);
		if (event.data.curcontext) {
			previousContext = currentContext;
			currentContext = sp.trackPlayer.getPlayingContext();
			console.log("context changed, previousContext: ", previousContext);
		}

		if (!event.data.playstate)
			return;

		var temporaryPlaylist = getTemporaryPlaylist();
		console.log("[RADIO] temp list is", temporaryPlaylist);

		if (event.data.curtrack) {
			console.log("[RADIO] Track ended or skipped.");

			var playingContext = sp.trackPlayer.getPlayingContext();
			console.log("[RADIO] playing context: ", playingContext);
			if (playingContext.length && playingContext[0] === temporaryPlaylist.uri) {
				console.log("[RADIO] In radio. Did new track already start?.");
				if (!sp.trackPlayer.getNowPlayingTrack()) {
					console.log("[RADIO] No new track started, playing next.");
					findNextTrack(true);
				} else {
					console.log("[RADIO] Next track started. Update UI.");
					while(temporaryPlaylist.length > 0 &&
						temporaryPlaylist.getTrack(0).uri !== sp.trackPlayer.getNowPlayingTrack().track.uri) {
						temporaryPlaylist.remove(0);
					}
					playTrack(false);
					findNextTrack(false);
				}
			} else {
				// If playingContext doesn't match, either user switched to a different
				// playlist or we hit the race condition from JIRA ticket 3478. We can
				// tell based on whether a song is playing.
				if (playingContext.length == 0 && previousContext[0] == temporaryPlaylist.uri
						&& !sp.trackPlayer.getIsPlaying()) {
					console.log('[RADIO] working around temp playlist race condition');
					playCurrentTrack();
				}
			}
		}
		updatePlayPauseControls();
	}

	function addRecentStation(artistName, artistUri, trackName, trackUri, imageUri) {
		var newStation = {};
		newStation.artistName = artistName;
		newStation.artistUri = artistUri;
		newStation.trackName = trackName;
		newStation.trackUri = trackUri;
		newStation.imageUri = imageUri;
		newStation.seed = trackUri || artistUri;
		// If this station is already in the recent station list, remove it
		var cut = 0;
		for (; cut < recent.stations.length && recent.stations[cut].seed != newStation.seed; cut += 1) {
		}

		recent.stations.splice(cut, 1);
		recent.stations.splice(0, 0, newStation);
        recent.stations = recent.stations.slice(0, 21);     // Keep max 20 stations
		localStorage.setItem("RecentStations", JSON.stringify(recent.stations));
		fillRecentStationList();
	}

	function fillRecentStationList() {
		var MAX_ITEMS = 21;
		recent.imageCarousel.clear();
		if (recent.stations.length <= 1) {
			dom.queryOne('#recent').style.display = 'none';
			return;
		}
		for (var i = 1; i < MAX_ITEMS && i < recent.stations.length; i++) {
			var station = recent.stations[i];
			var title;
            if (station.artistUri.indexOf("spotify:genre:") == 0) {
                title = {name: station.artistName, link: ""};
            } else {
                title = {name: station.artistName, link: station.artistUri};
            }
			var subtitles = [];
			if (station.trackName) {
				subtitles.push({name: station.trackName, link: station.trackUri});
			}
			var imgUri = isValidImageUri(station.imageUri) ? station.imageUri : "";
			recent.imageCarousel.addItem(station.seed, imgUri, title, subtitles);
		}
		dom.queryOne('#recent').style.display = 'block';
		recent.imageCarousel.handleResize();
		recent.imageCarousel.scrollTo(0);
	}

	function loginModeChanged() {

		// All values except 1 (= logged in against access point) is treated as not online
		if (sp.core.getLoginMode() == 1) {
			dom.queryOne('#offline-panel').style.visibility = "hidden";
			dom.queryOne('#offline-error').style.visibility = "hidden";
		}
		else {
			dom.queryOne('#offline-panel').style.visibility = "visible";
			dom.queryOne('#offline-error').style.visibility = "visible";
		}
	}

	function playPause() {
		var playing = sp.trackPlayer.getNowPlayingTrack();
		if (!playing || playing.track.uri != curTrackUri) {
			// If there is nothing playing, or something is playing, but
			// it's not coming from the radio, then, if we have a track
			// we play that, otherwise, go look for the next one
			if (curTrack != null) {
				var skip = dom.queryOne('#playing-skip>a');
				skip.className += "disabled";

				sp.trackPlayer.playTrackFromContext(getTemporaryPlaylist().uri, 0, "", {
					onSuccess: function (s) {
						console.log("[RADIO] play ok");
					},
					onError: function(_) { console.log("[RADIO] play error"); },
					onComplete: function(_) {
						var check = function() {
							// Enable the skip button when the global skip button is enabled.
							// Prevents "track not found" errors when the use skips very fast.
							var playingTrack = sp.trackPlayer.getNowPlayingTrack();
							if (typeof playingTrack === 'undefined' ||
								playingTrack === null ||
								playingTrack.track.uri !== curTrackUri) {
								setTimeout(check, 500);
							} else {
								skip.className = skip.className.replace(/disabled/g, '');
								updatePlayPauseControls();
							}
						};
						check();
						console.log("[RADIO] play complete");
					}
				});
			}
			else {
				findNextTrack(true);
			}
		}
		else {
			// It's a radio song, flip it's play state
			sp.trackPlayer.setIsPlaying(!sp.trackPlayer.getIsPlaying());
		}
	}

	function updatePlayPauseControls() {
		// If we are playing a song from the radio, we are considered playing,
		// all other cases (including playing a track from someplace else),
		// we are considered pause
		var playing = sp.trackPlayer.getIsPlaying() &&
			sp.trackPlayer.getNowPlayingTrack().track.uri == curTrackUri;
		dom.queryOne('#playing-covers>li>a>div>span').className = playing ? "playButton playing" : "playButton paused";
		dom.queryOne('#playing-speaker').className = playing ? "playButton" : "playButton paused";
	}

	function starredChanged() {
		// Something changed. We have to check if the currently playing track's starring changed.
		if (!curTrack)
			return;

		sp.core.getMetadata(curTrackUri, {
			onSuccess: function(metadata) {
				if (curTrack && metadata.uri == curTrackUri) {
					curTrack.starred = metadata.starred;
					dom.queryOne('#radio-star').className = curTrack.starred ? "starred" : "";
				}
			},
			onFailure: function(_) {}
		    });
	}

    function loadStationFromArguments() {
        // Arguments will be: <artist/track>:uri, source:<view>, context:<spotify URI or blank>,
        // element:<contextmenu/button>
        // If we come from an external link (or if somebody put the radio uri in the search,
        // we have no additional arguments
        var args = sp.core.getArguments();
		var seed_type = unescape(args[0]), seed_id = unescape(args[1]);

		if (seed_type == "genre" && !isNaN(+seed_id)) {
			var old_genre = +seed_id;
			seed_id = "pop";
			for (var genre in genreDict) {
				if (old_genre & genreDict[genre][1]) {
					seed_id = genre;
					break;
				}
			}
		}

        if (args.length >= 8) {
            loadStation("spotify:" + seed_type + ":" + seed_id,
                    unescape(args[3]), unescape(args[5]), unescape(args[7]), true);
            return(true);
        } else if(args.length >= 2) {
            loadStation("spotify:" + seed_type + ":" + seed_id, "", "", "externallink", true);
            return(true);
        }
        return(false);
    }

    function loadStationFromLinksChanged() {
		var link = sp.core.getLinks()[0];
		console.log("[RADIO] Drop link ", link);
		loadStation(link, "spotify:app:radio", "", "drop", true);
    }

	function _unload() {
		sp.trackPlayer.removeEventListener("playerStateChanged", playerStateChanged);
		sp.core.removeEventListener("loginModeChanged", loginModeChanged);
        sp.core.removeEventListener("argumentsChanged", loadStationFromArguments);
		sp.core.getStarredPlaylist().removeEventListener("change", starredChanged);
		sp.core.removeEventListener("linksChanged", loadStationFromLinksChanged);
	}

    function getTemporaryPlaylist() {
	var temporaryPlaylist = sp.core.getTemporaryPlaylist(seed.substring("spotify:".length));
	sp.trackPlayer.setContextCanSkipPrev(temporaryPlaylist.uri, false);
	sp.trackPlayer.setContextCanRepeat(temporaryPlaylist.uri, false);
	sp.trackPlayer.setContextCanShuffle(temporaryPlaylist.uri, false);
	return temporaryPlaylist;
    }

	// Startup code
	window.addEventListener("beforeunload", _unload);
	sp.core.getStarredPlaylist().addEventListener("change", starredChanged);
	sp.core.addEventListener("argumentsChanged", loadStationFromArguments);
	sp.core.addEventListener("linksChanged", loadStationFromLinksChanged);

	recent.stations = []
	try {
		recent.stations = JSON.parse(localStorage.getItem("RecentStations")) || [];
	} catch(e) {}
	recent.imageCarousel = new ic.ImageCarousel('#recent', _('Recent Stations'));

	// Only bring up a station if we are online
	if (sp.core.getLoginMode() == 1) {
        if (!loadStationFromArguments()) {
    		if (recent.stations.length > 0) {
	    		loadStation(recent.stations[0].seed, "spotify:app:radio", "", "autostartrecent", false);
		    } else {
    			dom.queryOne('#first-time').style.display = 'block';
    			hideLoadingScreen();
    		}
        }
	}

	adjustHeaderWidth();
	loginModeChanged();
	fillRecentStationList();
	fillTopArtists();
	fillPopularStations();
	fillGenres();
}

/**
 * Adjusts width for radio seed header.
 */
function adjustHeaderWidth() {
	var header = dom.queryOne('#playing-header');
	var left = dom.queryOne('#radio-seed');
	var right = dom.queryOne('#right-header');
	left.style.width = (header.offsetWidth - right.offsetWidth - 34) + "px";
}

/**
 * Returns true if element is within auto-complete form.
 */
function isInAutoComplete(elem) {
	var autocompleteForm = dom.queryOne('.auto-completeForm');
	while (elem) {
		if (elem === autocompleteForm) {
			return true;
		}
		elem = elem.parentNode;
	}
	return false;
}

/**
 * Returns true if image uri is valid.  Uris of the form spotify:image:0000
 * are considered invalid.
 */
function isValidImageUri(uri) {
	if (uri.length > 0) {
		var gid = uri.substr(uri.lastIndexOf(':') + 1);
		return (gid != 0);
	}
	return false;
}

/**
 * Triggers a DOM event on the specified element.
 * @param {Element} eventTarget The element to trigger the event on.
 * @param {string} eventName The name of the event to trigger.
 * @param {boolean=false} opt_canBubble Whether the event will bubble up.
 * @param {boolean=false} opt_cancelable Whether the side-effect of the event
 *                                       can be prevented.
 * @return {Event} The event that was created.
 */
function _event(eventTarget, eventName, opt_canBubble, opt_cancelable) {
	var e = document.createEvent('Event');
	e.initEvent(eventName, !!opt_canBubble, !!opt_cancelable);
	eventTarget.dispatchEvent(e);
	return e;
}

function _hermes(method, path, args, callbacks) {
	if (path[0] != '/') {
		throw Error('Hermes path must be absolute');
	}
	console.log('[RADIO] calling ' + path);
	sp.core.getHermes(method, 'hm://radio' + path, args, callbacks);
}

/**
 * Convert seed URI to a Hermes URI.
 * @param {string} uri A Spotify URI.
 * @return {string} A Hermes absolute path to call for the specified URI.
 */
function _seedToPath(uri) {
	var allowedTypes = ['album', 'artist', 'track', 'genre'];

	var pieces = uri.split(':');
	if (pieces[0] != 'spotify' || allowedTypes.indexOf(pieces[1]) == -1) {
		throw Error('Radio seed has to be a Spotify URI of one of the following types: ' + allowedTypes);
	}

	return '/' + pieces.slice(1).join('/');
}

function loadRules() {
	_hermes('GET', '/rules', [], {
		onSuccess: function (s) {
			var rules = sp.core.parseHermesReply('Rules', s);
			console.log('[RADIO] rules:', rules)

			// TODO: eval in the rules
		},
		onFailure: function (_) {
			console.log('[RADIO] rules: getHermes onFailure', arguments);
		}
	});
}

function replaceLink(linkParent, contents, url) {
	var element = dom.Element('a', {text: contents.decodeForText(), href: url, className: 'outgoing'});
	while (linkParent.hasChildNodes()) {
		linkParent.removeChild(linkParent.lastChild);
	}
	linkParent.appendChild(element);
}


