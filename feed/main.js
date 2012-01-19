"use strict";

sp = getSpotifyApi(1);

var dom = sp.require("sp://import/scripts/dom");
var kbd = sp.require("sp://import/scripts/keyboard");
var dnd = sp.require("sp://import/scripts/dnd");
var arr = sp.require("sp://import/scripts/array");
var r   = sp.require("sp://import/scripts/react");
var fd  = sp.require("feed");

var social = sp.require("sp://import/scripts/social");
var lang  = sp.require("sp://import/scripts/language");
var storage = sp.require("sp://import/scripts/storage");
var hermes = sp.require("sp://import/scripts/hermes");

var catalog = lang.loadCatalog("cef_views");
var _ = partial(lang.getString, catalog, "Generic");

// How often to show a Facebook friend
var FACEBOOK_ACTIVITY_INTERVAL = 300000;

var keyDowns = r.fromDOMEvent(window, "keydown");
var withMeta = r.filter(function(e) { return true === e[kbd.metaKey]; }, keyDowns);
var escapes = r.filter(function(e) { return 27 === e.keyCode; }, keyDowns);
var searchShortcut = r.filter(function(e) { return 70 === e.keyCode; }, withMeta);

var socialDataUpdate = r.fromDOMEvent(sp.social.relations, "change");
var favoritesUpdate = r.fromDOMEvent(social.favorites, "change");
var presenceEvents = r.fromDOMEvent(sp.core, "hermes");
var loginModeChanged = r.fromDOMEvent(sp.core, "loginModeChanged");
var loggedIn = r.fromDOMEvent(sp.core, "login");

function interval(ms) {
	var es = new r.EventStream();
	setInterval(partial(r.publish, es, null), ms);
	return es;
}

var friendsList = new fd.FriendsList();

var feed = new fd.Feed();

function fyShuffle(xs) {
	var i = xs.length;
	var j, tmpi, tmpj;
	if (0 === i) return xs;
	while (--i) {
		j = ~~(Math.random() * (i + 1));
		tmpi = xs[i];
		tmpj = xs[j];
		xs[i] = tmpj;
		xs[j] = tmpi;
	}
	return xs;
}

var feedStream = new r.EventStream();
var throttledStream = r.throttle(feedStream, 500);

throttledStream.subscribe(function(v) {
	fd.addItem(v, feed, true);
});

function getPresence(usernames) {
	if (null === usernames) {
		usernames = social.getUsernames();
	} else if (0 === usernames.length) {
		return;
	}

	var start = 0;
	var bsize = 50;
	while (start < usernames.length) {
		var batch = usernames.slice(start, start + bsize);
		getPresenceBatch(batch);
		start += bsize;
	}
}

function getPresenceBatch(usernames) {
	sp.core.getHermes("GET", "hm://presence/user/",
		usernames, {
			onSuccess: function(_) {
				var stateData;
				var state;
				for (var i = 0, l = arguments.length; i < l; ++i) {
					stateData = arguments[i];
					state = getMostRecentPresence(sp.core.parseHermesReply("PresenceState", stateData));
					if (!state) continue;
					state.user = social.getUserByUsername(usernames[i]);
					fd.addItem(state, feed, true);
					fd.setFriendState(friendsList, usernames[i], state);
				}
			},
			onFailure: function(_) { /* console.log("GET: getHermes onFailure", arguments); */ },
			onComplete: function(_) { /* console.log("GET: getHermes onComplete", arguments); */ }
		}
	);
}

function getMostRecentPresence(state) {
	var categories = ["playlist_published", "playlist_track_added", "track_finished_playing", "facebook_activity"];
	var cat, ts, s;
	for (var i = 0; i < categories.length; ++i) {
		cat = categories[i];
		if (state[cat]) {
			ts = state[cat].timestamp;
			if (ts === undefined) continue;
			s = { timestamp: ts };
			s[cat] = state[cat];
		}
	}
	return s;
}

// Make friends, yay!
function makeFriend(data) {
	return new fd.Friend(data);
}

var resetCounter = 0;
function onFacebookActivity() {
	var allFbUsers = sp.social.relations.allFacebookUsers();
	var winner = null;
	var found = false;

	setTimeout(onFacebookActivity,
		FACEBOOK_ACTIVITY_INTERVAL + FACEBOOK_ACTIVITY_INTERVAL * Math.random());

	if (resetCounter < 9) {
		return;
	} else {
		resetCounter = 0;
	}
	if (!allFbUsers.length) return;

	fyShuffle(allFbUsers);

	for (var i = 0; i < allFbUsers.length; ++i) {
		found = false;
		for (var j = 0; j < feed.items.length; ++j) {
			if (allFbUsers[i] === feed.items[j].data.user.facebookUid) {
				found = true;
				break;
			}
		}
		if (!found) {
			sp.social.getUserByFacebookUid(allFbUsers[i], { onSuccess: function(user) {
				var state = {
					facebook_activity: {
						timestamp: Date.now() / 1000
					},
					user: user
				};
				r.publish(throttledStream, state);
			}, onFailure: id });
			break;
		}
	}
}

var onReady = compose(hideThrobber, partial(getPresence, null), updateFriendsList);

function init(e) {
	var loginMode = sp.core.getLoginMode();
	var friendSection = dom.queryOne("#friends")
	var feedSection = dom.queryOne("#feed");
	var feedSeparator = document.createElement("div");

	feedSeparator.classList.add("separator");
	friendSection.style.height = storage.getWithDefault("friendSectionHeight", 248) + "px";

	friendSection.appendChild(friendsList.node);
	document.body.insertBefore(feedSeparator, feedSection);
	feedSection.appendChild(feed.node);

	// Set optimal height on double click
	feedSeparator.addEventListener("dblclick", function(e) {
		friendSection.style.height = (friendsList.items.length * 34 + 10) + "px";
	});

    function onMouseDown(e) {
        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
    }

    function onMouseMove(e) {
        friendSection.style.height = e.clientY + "px";
    }

    function onMouseUp(e) {
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
        storage.set("friendSectionHeight", friendSection.offsetHeight);
    }

    feedSeparator.addEventListener("mousedown", onMouseDown);

    fd.restoreFeed(feed);

    window.addEventListener("beforeunload", function() {
        fd.storeFeed(feed);
    });

	if (sp.social.relations.loaded) {
		onReady();
	} else {
		r.takeFirst(r.filter(function(v) {
			return sp.social.relations.loaded;
		}, socialDataUpdate)).subscribe(onReady);
	}

	return e;
}

function updateFriendsList(e) {
	var favFriends = social.getFavoriteUsers();
	if (0 === favFriends.length) {
		favFriends = storage.getWithDefault("favoriteFriendsCache", []);
	}
	fd.updateList(friendsList, map(makeFriend, favFriends));
	return e;
}

function subscribeToPresence(e) {
	var usernames = social.getUsernames();
	if (0 === usernames.length) {
		return e;
	}
	sp.core.getHermes("SUB", "hm://presence/user/", usernames, {
		onSuccess: function(_) { /* console.log("SUB: getHermes onSuccess " + JSON.stringify(map(partial(sp.core.parseHermesReply, "Subscription"), arguments))); */ },
		onFailure: function(_) { /* console.log("SUB: getHermes onFailure", arguments); */ },
		onComplete: function(_) { /* console.log("SUB: getHermes onComplete", arguments); */ }
	});
	return e;
}

// Hermes event received, update buddy list and/or feed
presenceEvents.subscribe(function(e) {
	var uri = e.data[0];
	var username;
	var state;
	if (uri.indexOf("hm://presence/user/") !== -1) {
		username = uri.slice("hm://presence/user/".length, -1); // Removes last slash
		state = sp.core.parseHermesReply("PresenceState", e.data[1]);
		fd.setFriendState(friendsList, username, state);
		// TODO: make a nicer type which contains user + state
		// Could check link type when constructing it etc
		state.user = social.getUserByUsername(username);
		r.publish(throttledStream, state);
		resetCounter++;
	}
});

function cacheFavorites(e) {
	var favorites = social.getFavoriteUsers();
	storage.set("favoriteFriendsCache", favorites);
	return e;
}

// SUB to Hermes PresenceStates when any of these events happen, and update buddy list
r.merge(r.takeFirst(loggedIn), r.merge(socialDataUpdate, favoritesUpdate))
	.subscribe(compose(subscribeToPresence, partial(getPresence, null), updateFriendsList, cacheFavorites));

favoritesUpdate.subscribe(function(e) {
	var favoriteUsernames = map(function(u) { return u.canonicalUsername; },
		social.getFavoriteUsers());
	getPresence(favoriteUsernames);
});

function showThrobber() {
	var node = document.createElement("div");
	var label = document.createElement("span");
	var spinner = node.cloneNode();
	label.textContent = _("sGenericLoading");
	node.appendChild(label);
	node.appendChild(spinner);
	node.className = "throbber";
	dom.queryOne("#friends").appendChild(node);
}

function hideThrobber() {
	var node = dom.queryOne(".throbber");
	if (node) {
		node.style.opacity = 0;
		setTimeout(function() {
			node.parentNode.removeChild(node);
		}, 400);
	}
}

exports.init = compose(onFacebookActivity, init, showThrobber);
