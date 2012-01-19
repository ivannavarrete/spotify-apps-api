"use strict";

sp = getSpotifyApi(1);

var dom  = sp.require("sp://import/scripts/dom");
var lang = sp.require("sp://import/scripts/language");
var _    = partial(lang.getString, lang.loadCatalog("cef_views"), 'Search Dropdown');

var lastQuery = { str: null, startTime: 0, responseTime: 0 };
var relations = sp.social.relations;
var userCache = [];

var NONE  =  -1;
var POOR  =   0;
var GOOD  =   1;
var EXACT =   2;

var MIN_SEARCH_TIMEOUT = 100;
var MAX_SEARCH_TIMEOUT = 1000;

var RESULT_COUNT = 9;
var RESULT_ORDER = [
	'tracks',
	'playlists',
	'artists',
	'albums',
	'users'
];

/*
 * Matches a name against a search query and determines the
 * quality of the match. Used for getting the top hit in suggestions.
 */
function match(name, query){
	if (name == query)
		return EXACT;
	if (name && name.toLowerCase().indexOf(query.toLowerCase()) != -1)
		if (name.length - query.length < name.length / 2)
			return GOOD;
		else
			return POOR;
	return NONE;
}

/*
 * Prepares a search result for displaying it as suggestions.
 */
function prepareResult(r, query) {
	var top    = { value : NONE, item : null };
	var result = {};

	for (var i in RESULT_ORDER) {
		result[RESULT_ORDER[i]] = [];
	}

	// Insert users into result
	r['users'] = filter(function(user){
		return match(user.canonicalUsername, query) != NONE || match(user.name, query) != NONE;
	}, userCache);

	// Aggregate different results into final result
	var count = 0;

	while (count < RESULT_COUNT) {
		for (var i in RESULT_ORDER) {
			var key = RESULT_ORDER[i];
			if (r[key].length) {
				++count;
				result[key].push(r[key].shift());
			}
		}

		if (!r['tracks'].length &&
				!r['playlists'].length &&
				!r['artists'].length &&
				!r['albums'].length &&
				!r['users'].length) {
			break;
		}
	}

	// Find the top result hit
	var v = NONE;

	for (var i in RESULT_ORDER) {
		var key = RESULT_ORDER[i];
		for (var j = 0; j < result[key].length; j++) {
			if (key == 'users' && (v = match(result[key][j].canonicalUsername, query)) > top.value) {
				top.item       = result[key][j];
				top.item.image = result[key][j].picture;
				top.value      = v;
			}
			if ((v = match(result[key][j].name, query)) > top.value) {
				top.item       = result[key][j];
				top.item.image = result[key][j].portrait;
				top.value      = v;
			}
		}
	}

	result.top = top;

	return result;
}

function autoComplete(query) {
	lastQuery.str       = query;
	lastQuery.startTime = Date.now();

	sp.core.suggestSearch(query, {
		onSuccess: function(result) {
			if (lastQuery.str === query) {
				lastQuery.responseTime = Date.now() - lastQuery.startTime;
				//console.log("Suggest: " + lastQuery.responseTime);
				searchResultHandler(prepareResult(result, query));
			}
		}
	});
}

function autoCompleteHoldOff() {
	return Math.min(Math.max(MIN_SEARCH_TIMEOUT, lastQuery.responseTime), MAX_SEARCH_TIMEOUT);
}

function searchResultHandler(r) {
	var div = dom.queryOne("#suggest");

	if (null === r || (0 === r.tracks.length && 0 === r.artists.length && 0 === r.albums.length && 0 === r.playlists.length && 0 === r.users.length)) {
		div.innerHTML = lang.format(
			"<a href=\"spotify:search:{0}\" class=\"selected\"><img src=\"sp://import/img/show-all.png\" class=\"all\" />{1}</a>",
			encodeURIComponent(lastQuery.str), _("sDropdownShowAllResults")
		);
	}
	else {
		div.innerHTML = resultToHtml(r);
	}

	var links = dom.query("a");
	links.forEach(function(link) {
		link.addEventListener("mouseover", function(e) {
			moveSelectionTo(link);
		});

		link.addEventListener("click", function(e) {
			sp.desktop.dropdown.openLink(decodeURIComponent(link.href));
		});
	});

	var selected = dom.queryOne("a.selected");
	sp.desktop.dropdown.setLink(decodeURIComponent(selected.href));
	sp.desktop.dropdown.show(div.offsetHeight);
}

function getImage(data) {
	var type = data.type || ((data.canonicalUsername || data.facebookUid) ? "user" : "");

	switch	(type) {
		case "artist":
			return data.portrait ? data.portrait : "sp://import/img/placeholders/20-artist.png";
		case "album":
			return data.cover ? data.cover : "sp://import/img/placeholders/20-album.png";
		case "track":
			return data.album.cover ? data.album.cover : "sp://import/img/placeholders/20-track.png";
		case "playlist":
			if (data.cover) {
				return data.cover.replace(/spotify:mosaic:([^;]{40}?).*/, "spotify:image:$1");
			}
			else {
				return "sp://import/img/placeholders/20-playlist.png";
			}
		case "user":
			return data.picture ? data.picture : "sp://import/img/placeholders/20-artist.png";
		default:
			return data.image ? data.image : "";
	}
}

function topHitToHtml(data) {
	var type = data.type || ((data.canonicalUsername || data.facebookUid) ? "user" : "");

	switch	(type) {
		case "artist":   return artistToHtml(data);
		case "album":    return albumToHtml(data);
		case "track":    return trackToHtml(data);
		case "playlist": return playlistToHtml(data);
		case "user":     return userToHtml(data);
		default:
			return "";
	}
}

function artistToHtml(artist) {
	return lang.format(
		"<a href=\"{0}\"><img src=\"{1}\" />{2}</a>",
		artist.uri, getImage(artist), artist.name.decodeForHTML()
	);
}

function albumToHtml(album) {
	return lang.format(
		"<a href=\"{0}\"><img src=\"{1}\" />{2} <span>{3} {4}</span></a>",
		album.uri, getImage(album), album.name.decodeForHTML(), _("sDropdownBy"), album.artist.name.decodeForHTML()
	);
}

function trackToHtml(track) {
	return lang.format(
		"<a href=\"{0}\"><img src=\"{1}\" />{2} <span>{3} {4}</span></a>",
		track.uri, getImage(track), track.name.decodeForHTML(), _("sDropdownBy"),
		map(function(artist){ return artist.name.decodeForHTML(); }, track.artists).join(', ')
	);
}

function playlistToHtml(playlist) {
	if (playlist.owner.uri === sp.core.user.uri) {
		return lang.format(
			"<a href=\"{0}\"><img src=\"{1}\" />{2}</a>",
			playlist.uri, getImage(playlist), playlist.name.decodeForHTML()
		);
	}
	else {
		return lang.format(
			"<a href=\"{0}\"><img src=\"{1}\" />{2} <span>{3} {4}</span></a>",
			playlist.uri, getImage(playlist), playlist.name.decodeForHTML(), _("sDropdownBy"), playlist.owner.name.decodeForHTML()
		);
	}
}

function userToHtml(user) {
	return lang.format("<a href=\"{0}\"><img src=\"{1}\" />{2}</a>", user.uri, getImage(user), user.name.decodeForHTML());
}

function resultToHtml(r) {
	var html = lang.format(
    "<a href=\"spotify:search:{0}\" class=\"selected\"><img src=\"sp://import/img/show-all.png\" class=\"all\" />{1}</a>",
    encodeURIComponent(lastQuery.str), _("sDropdownShowAllResults")
  );

  if (r.top.item !== null) {
		html += lang.format("<div class=\"tophit\">{0}</div>{1}", _("sDropdownTopHit"), topHitToHtml(r.top.item));
  }

	for (var i in RESULT_ORDER) {
		var key = RESULT_ORDER[i];
		if (r[key].length) {
			switch (key) {
				case 'tracks':    html += lang.format("<div class=\"tracks\">{0}</div>{1}",    _("sDropdownTracks"),    map(trackToHtml,    r.tracks).join(""));    break;
				case 'playlists': html += lang.format("<div class=\"playlists\">{0}</div>{1}", _("sDropdownPlaylists"), map(playlistToHtml, r.playlists).join("")); break;
				case 'artists':   html += lang.format("<div class=\"artists\">{0}</div>{1}",   _("sDropdownArtists"),   map(artistToHtml,   r.artists).join(""));   break;
				case 'albums':    html += lang.format("<div class=\"albums\">{0}</div>{1}",    _("sDropdownAlbums"),    map(albumToHtml,    r.albums).join(""));    break;
				case 'users':     html += lang.format("<div class=\"users\">{0}</div>{1}",     _("sDropdownUsers"),     map(userToHtml,     r.users).join(""));     break;
			}
		}
	}

	return html;
}

var DIRECTION_UP   = 0;
var DIRECTION_DOWN = 1;

function moveSelectionTo(element) {
	var current = dom.queryOne("a.selected");

	if(current != null){
		current.className = "";
	}

	if(element != null){
		element.className = "selected";
	}

	sp.desktop.dropdown.setLink(decodeURIComponent(element.href));
}

function moveSelection(dir) {
	var links = dom.query("a");
	var current, next, previous;

	for(var i = 0; i < links.length; i++){
		if(links[i].className == "selected"){
			previous = links[i - 1] || links[links.length - 1];
			current  = links[i];
			next     = links[i + 1] || links[0];
		}
	}

	if(dir == DIRECTION_UP && current !== null && previous !== null){
		current.className  = "";
		previous.className = "selected";

	  sp.desktop.dropdown.setLink(decodeURIComponent(previous.href));
	}
	else if(dir == DIRECTION_DOWN && current !== null && next !== null){
		current.className = "";
		next.className    = "selected";

	  sp.desktop.dropdown.setLink(decodeURIComponent(next.href));
	}
}

function showRecentSearches(data) {
	var div = dom.queryOne("#suggest");

	div.innerHTML = lang.format("<div class=\"recent\">{0}</div>{1}<hr /><a href=\"spotify:internal:clear-recent-searches\">{2}</a>",
		_("sDropdownRecentSearches"), map(function(query) {
			return lang.format("<a href=\"spotify:search:{0}\">{0}</a>", query);
		}, filter(function(query) { return query.length > 0; }, data)).join(""), _("sDropdownClearRecentSearches")
	);

	var links = dom.query("a");
	links.forEach(function(link, index) {
    if(index == 0){
      link.className = "selected";
    }

		link.addEventListener("mouseover", function(e) {
			moveSelectionTo(link);
		});

		link.addEventListener("click", function(e) {
			sp.desktop.dropdown.openLink(decodeURIComponent(link.href));
		});
	});

	var selected = dom.queryOne("a.selected");
	sp.desktop.dropdown.setLink(decodeURIComponent(selected.href));
	sp.desktop.dropdown.show(div.offsetHeight);
}

function close() {
	dom.queryOne("#suggest").innerHTML = "";
	sp.desktop.dropdown.hide();
}

function AdaptiveThrottler(func, throttleTimeFunc) {
	this.toID      = null;
	this.prevTs    = null;
	this.f         = func;
	this.tf        = throttleTimeFunc;
	this.delayNext = false;
}

AdaptiveThrottler.prototype.call = function() {
	var self    = this
	var args    = arguments;
	var ts      = Date.now();
	var elapsed = ts - (this.prevTs || 0);

	if (self.delayNext) {
		//console.log("delaying..");
		elapsed = 0;
		self.delayNext = false;
	}

	var t = self.tf();
	var f = self.f;
	self.cancel();

	if (elapsed >= t) {
		//console.log("calling f directly");
		self.prevTs = ts;
		f.apply(f, args);
	}
	else {
		//console.log("calling f in " + (t - elapsed) + " ms");
		self.toID = setTimeout(function() {
			self.prevTs = ts;
			//console.log("calling f throttled");
			f.apply(f, args);
		}, t - elapsed);
	}
}

AdaptiveThrottler.prototype.cancel = function() {
	if (this.toID) {
		//console.log("cancel throttled call");
		clearTimeout(this.toID);
		this.toID = null;
	}
}

AdaptiveThrottler.prototype.delayNextCall = function() {
	this.delayNext = true;
}

function isAdvancedSearch(s) {
  var p = /:|(^|\s)[\+-]/g;
	return p.test(s);
}

function onText() {
	var throttler = new AdaptiveThrottler(autoComplete, autoCompleteHoldOff);
	return function(e) {
		//console.log("data: \"" + e.data + "\"")
		if(e.data.length == 0 || isAdvancedSearch(e.data)) {
			//console.log("cancel search");
			throttler.cancel(); // cancel delayed searches
			lastQuery.str = null; // make sure we throw away search responses
			close();
		} else {
			if (e.data.length < 3)
				throttler.delayNextCall();
			throttler.call(e.data.decodeForText());
		}
	}
}

// log all "commit" actions in the instant search dropdown
function onBrowseToLink() {
	return function(e) {
		sp.core.logClientEvent('', 'onBrowseToLink', '1', '1', {'search_query' : lastQuery.str, 'uri' : e.data});
	}
}

function loadRelations() {
	userCache = [];

	for (var i = 0; i < relations.length; i++) {
		userCache.push(relations.getUserInfo(i));
	}
}

exports.init = function() {
	document.body.oncontextmenu = function() {
		return sp.core.isDebugMode;
	};

	var platform = window.navigator.platform;

	if (platform.match(/Win/)) {
		document.body.classList.add("windows");
	}
	else if (platform.match(/Mac/)) {
		document.body.classList.add("mac");
	}
	else if (platform.match(/Linux/) || platform.match(/X11/)) {
		document.body.classList.add("linux");
	}

	relations.addEventListener("load", loadRelations);
	relations.addEventListener("change", loadRelations);

	if (relations.loaded) {
		window.setTimeout(loadRelations, 0);
	}

	sp.desktop.dropdown.addEventListener("text",     onText());
	sp.desktop.dropdown.addEventListener("recent",   function(e) { showRecentSearches(e.data);    });
	sp.desktop.dropdown.addEventListener("moveup",   function(e) { moveSelection(DIRECTION_UP);   });
	sp.desktop.dropdown.addEventListener("movedown", function(e) { moveSelection(DIRECTION_DOWN); });
	sp.desktop.dropdown.addEventListener("browsetolink", onBrowseToLink());
};
