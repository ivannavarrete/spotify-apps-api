"use strict";

/**
 * Buddy feed
 */

sp = getSpotifyApi(1);

exports.FriendsList = FriendsList;
exports.Friend = Friend;

exports.updateList = updateList;
exports.updateFriend = updateFriend;
exports.setActivity = setActivity;
exports.setFriendState = setFriendState;

exports.showPlaceholder = showPlaceholder;
exports.hidePlaceholder = hidePlaceholder;

exports.Feed = Feed;

exports.addItem     = addItem;
exports.removeItem  = removeItem;
exports.storeFeed   = storeFeed;
exports.restoreFeed = restoreFeed;

// Max items to display in feed
// TODO: Set to something based on window size?
var MAX_ITEMS = 100;
// How often to update timestamps
var UPDATE_INTERVAL = 10000;
// How often to remove items from feed
var CLEAN_INTERVAL = 20000;

var api = sp.require("sp://import/scripts/api/models");
var dt  = sp.require("sp://import/scripts/datetime");
var arr = sp.require("sp://import/scripts/array");
var kbd = sp.require("sp://import/scripts/keyboard");
var log = sp.require("sp://import/scripts/logger");
var r   = sp.require("sp://import/scripts/react");
var dom = sp.require("sp://import/scripts/dom");
var hermes  = sp.require("sp://import/scripts/hermes");
var storage = sp.require("sp://import/scripts/storage");
var md      = sp.require("sp://import/scripts/metadata");
var ui      = sp.require("sp://import/scripts/ui");
var popover = sp.require("sp://import/scripts/popover");
var social  = sp.require("sp://import/scripts/social");

var lang    = sp.require("sp://import/scripts/language");
var catalog = lang.loadCatalog("cef_views");
var _p      = partial(lang.getString, catalog, "Presence");
var _       = partial(lang.getString, catalog, "Buddy list");

var PRESENCE_TYPES = {
    UNKNOWN: -1,
    FACEBOOK_ACTIVITY: 0,
    TRACK_FINISHED_PLAYING: 1,
    PLAYLIST_PUBLISHED: 2,
    PLAYLIST_TRACK_ADDED: 3,
    PLAYLIST_TRACK_STARRED: 4
};

var SHARABLE_LINK_TYPES = {
	1: 1, // Artist
	2: 1, // Album
	4: 1, // Track
	5: 1  // Playlist
};

/**
 * Favorites section.
 */
function throttle(f, t) {
	var toID = null;
	return function(/*args...*/) {
		var args = arguments;
		if (toID) {
			clearTimeout(toID);
		}
		toID = setTimeout(function() {
			f.apply(f, args);
			toID = null;
		}, t);
	}
}

/**
 * @constructor
 */
function FriendsList() {
	var fl = this;
	var el = document.createElement("div");
	el.classList.add("droppable");
	el.classList.add("friends");
	el.tabIndex = 0;
	fl.node = el;
	fl.selectedItem = null;
	fl.items = [];

	r.fromDOMEvent(el, "dragenter").subscribe(function(e) {
		var uri = e.dataTransfer.getData("text");
		var linkType = sp.core.getLinkType(uri);
		var notFavorite = !social.isFavoriteUser(uri);
		if (notFavorite && (10 === linkType || 22 === linkType)) {
			e.currentTarget.classList.add("drag-over");
			e.stopPropagation();
		}
	});

	r.merge(r.fromDOMEvent(el, "drop"), r.fromDOMEvent(el, "dragleave")).subscribe(function(e) {
		e.target.classList.remove("drag-over");
	});

	r.fromDOMEvent(fl.node, "dragover").subscribe(function(e) {
		var uri = e.dataTransfer.getData("text");
		var linkType = sp.core.getLinkType(uri);
		if (!social.isFavoriteUser(uri) && (10 === linkType || 22 === linkType)) {
			e.preventDefault();
		} else {
			e.dataTransfer.dropEffect = "none";
		}
	});

	r.fromDOMEvent(fl.node, "drop").subscribe(function(e) {
		var uri = e.dataTransfer.getData("text");
		var linkType = sp.core.getLinkType(uri);
		if (10 === linkType || 22 === linkType) {
			social.addFavoriteUser(uri);
		} else {
			e.preventDefault();
			sp.core.showClientMessage(0, lang.format(_("unsupportedDropType"), sp.core.user.name.decodeForText()));
		}
	});

	//el.addEventListener("keydown", partial(onKeyDown, fl));
}

/**
 * @param {FriendsList} fl
 * @param {Event} e
 * @return {FriendsList}
 */
function onKeyDown(fl, e) {
	var item = null;
	var candidate = null;
	var selected = fl.selectedItem;
	var dir;
	var i;

	if (38 === e.keyCode)
		dir = -1;
	else if (40 === e.keyCode)
		dir = 1;
	// Backspace or delete
	else if (8 === e.keyCode || 46 === e.keyCode)
		social.removeFavoriteUser(selected.data.uri);
	else
		return fl;

	if (1 === dir) {
		if (null === selected) {
			i = 0;
		} else {
			i = fl.items.indexOf(selected) + dir;
		}
		while (i < fl.items.length) {
			candidate = fl.items[i];
			if (!isHidden(candidate)) {
				item = candidate;
				break;
			}
			++i;
		}
	} else if (-1 === dir) {
		if (null === selected) {
			i = fl.items.length - 1;
		} else {
			i = fl.items.indexOf(selected) + dir;
		}
		while (i >= 0) {
			candidate = fl.items[i];
			if (!isHidden(candidate)) {
				item = candidate;
				break;
			}
			--i;
		}
		if (-1 !== i) {
			i = fl.items.length - 1;
		}
	}
	if (null !== item) {
		setSelectedItem(fl, item);
		throttledNavigateTo(item.data.uri);
		e.preventDefault();
	}
	return fl;
};

/**
 * @param {FriendsList} friendsList
 * @param {Friend} item
 * @return {FriendsList}
 */
function setSelectedItem(friendsList, item) {
	if (friendsList.selectedItem) {
		friendsList.selectedItem.node.classList.remove("selected");
	}
	friendsList.selectedItem = item;
	item.node.classList.add("selected");
	dom.reveal(friendsList.node, item.node);
	return friendsList;
}

// Helper functions for matching friends
var wordRe = /(\S+)/g;
function unique(xs) {
	var a = [];
	var l = xs.length;
	for (var i = 0; i < l; ++i) {
		for (var j = i + 1; j < l; ++j) {
			if (xs[i] === xs[j])
			j = ++i;
		}
		a.push(xs[i]);
	}
	return a;
};

// Set the friend state if friend is in list
function setFriendState(friendsList, username, state) {
	//console.log(lang.format("Setting friend {0}'s state to {1}", username, JSON.stringify(state)));
	var items = friendsList.items;
	for (var i = 0; i < items.length; ++i) {
		if (username === items[i].data.canonicalUsername) {
			setActivity(items[i], state);
			break;
		}
	}
}

function friendIndex(fl, item) {
    var match = filter(function(otherItem) {
        return friendEquals(item, otherItem);
    }, fl.items);

    return 0 === match.length ? -1 :
        fl.items.indexOf(match[0]);
}

var PLACEHOLDER_TIMEOUT = 3000;
// Lazily init this when placeholder is needed
var noFavoritesPlaceholder = null;
var placeholderNode = null;
var placeholderTimer = null;

/**
 * @param {FriendsList} fl
 * @param {Array.<Friend>} newItems
 * @return {FriendsList}
 */
function updateList(fl, newItems) {
	var found;
	var toRemove = [];
	var i = 0;
	newItems = sortByName(newItems);
	while (i < fl.items.length) {
		found = false;
		for (var j = 0, m = newItems.length; j < m; ++j) {
			if (friendEquals(fl.items[i], newItems[j])) {
				found = true;
			}
		}
		if (false === found) {
		    toRemove.push(fl.items[i]);
		}
		++i;
	}

    // Remove obsolete items
	for (var i = 0; i < toRemove.length; ++i) {
		removeFriend(toRemove[i]);
		fl.items.splice(fl.items.indexOf(toRemove[i]), 1);
	}

	// Update existing items
	for (var i = 0, l = newItems.length, ix; i < l; ++i) {
		ix = friendIndex(fl, newItems[i]);
		if (-1 === ix) {
			for (var j = 0, m = fl.items.length; j < m; ++j) {
				if (newItems[i].data.name.toLowerCase() < fl.items[j].data.name.toLowerCase()) {
					ix = j;
					break;
				}
			}
            newItems[i].parent = fl;
			if (-1 === ix) {
				ix = fl.items.length;
			}
			fl.items.splice(ix, 0, newItems[i]);
			fl.node.insertBefore(newItems[i].node,
				ix === fl.node.childNodes.length ? null : fl.node.childNodes[ix]);
			showFriend(newItems[i]);
		} else {
			updateFriend(fl.items[ix], newItems[i].data);
		}
	}

	// Show placeholder when there are no friends
	if (placeholderTimer) clearTimeout(placeholderTimer);
	if (0 === fl.items.length) {
		if (null === noFavoritesPlaceholder) {
			noFavoritesPlaceholder =
				lang.format("<h1>{0}</h1><p>{1}</p><a class=\"button\" href=\"spotify:app:people\">{2}</a>",
				_("No favorites"),
				_("Add people"),
				_("Show people"));
		}
		placeholderTimer = setTimeout(partial(showPlaceholder, fl, noFavoritesPlaceholder), PLACEHOLDER_TIMEOUT);
	} else {
		hidePlaceholder(fl);
	}

	return fl;
};

function showPlaceholder(fl, content) {
	if (null === placeholderNode) {
		placeholderNode = document.createElement("div");
		placeholderNode.className = "placeholder droppable";
		placeholderNode.innerHTML = noFavoritesPlaceholder;
		placeholderNode.style.opacity = 0;
		fl.node.insertBefore(placeholderNode, fl.node.firstChild);
		placeholderNode.offsetWidth;
		placeholderNode.style.opacity = 1;
	}
	return fl;
}

function hidePlaceholder(fl) {
	var pNode = placeholderNode;
	if (null !== pNode) {
		placeholderNode = null;
		pNode.offsetWidth;
		r.fromDOMEvent(pNode, "webkitTransitionEnd")
			.subscribe(function(e) {
			    fl.node.removeChild(pNode);
			});
		pNode.style.opacity = 0;
	}
	return fl;
}

// @constructor
function Friend(data) {
	var friend = this;
	var el = document.createElement("a");
	el.href = data.uri;
	el.title = data.name;
	el.classList.add("droppable");
	el.classList.add("no-activity");
	el.classList.add("friend");

	friend.node = el;
	friend.presence = null;
	//friend.node.draggable = true;

	r.fromDOMEvent(el, "dragenter").subscribe(function(e) {
		var linkType = sp.core.getLinkType(e.dataTransfer.getData("text"));
		if (SHARABLE_LINK_TYPES[linkType]) {
			e.target.classList.add("drag-over");
			e.stopPropagation();
		}
	});

	r.merge(r.fromDOMEvent(el, "drop"), r.fromDOMEvent(el, "dragleave")).subscribe(function(e) {
		e.target.classList.remove("drag-over");
	});

    /*
	r.fromDOMEvent(friend.node, "mousedown").subscribe(function(e) {
		setSelectedItem(friend.parent, friend);
	});
	*/

	r.fromDOMEvent(friend.node, "click").subscribe(function(e) {
		e.preventDefault();
		e.stopPropagation();
		if (popover.popover && popover.popover.targetNode === e.target) {
			popover.popover.hide(false);
			return;
		}
		showFeedPopover(friend.presence ? friend.presence : {user: data}, friend.node, friend.node.parentNode);
	});

	r.fromDOMEvent(friend.node, "dragover").subscribe(function(e) {
		var linkType = sp.core.getLinkType(e.dataTransfer.getData("text"));
		if (SHARABLE_LINK_TYPES[linkType]) {
			e.preventDefault();
			e.stopPropagation();
		} else {
			e.dataTransfer.dropEffect = "none";
		}
	});

	r.fromDOMEvent(friend.node, "drop").subscribe(function(e) {
		var uri = e.dataTransfer.getData("text");
		var linkType = sp.core.getLinkType(uri);
		e.stopPropagation();

		if (popover.popover && popover.popover.targetNode === e.target) {
			popover.popover.hide(true);
		}

		if (SHARABLE_LINK_TYPES[linkType]) {
			//popover.sharePopup(friend.data, uri, friend.node);
			popover.sharePopup(friend.data, uri, friend.node, {
				relativeNode: friend.parent.node
			});
		} else {
			e.preventDefault();
		}
	});

	updateFriend(this, data);
}

/**
 * @param {Friend} friend
 * @param {Object} state
 */
function setActivity(friend, state) {
	var uri = getUriFromPresenceState(state);
	md.getMetadata(uri, function(metadata) {
		if (!metadata || metadata.isInvalid) return;
		friend.presence = state;
		hermes.stringFromPresenceState(state, function(str) {
			friend.node.lastChild.innerHTML = str;
			friend.node.classList.remove("no-activity");
		});
	});
}

/**
 * @param {Friend} friend
 * @param {Object} data
 * @return {FriendsList}
 */
function updateFriend(friend, data) {
	var el = friend.node;
	var nameEl;
	var image;
	var imageEl;
	if (!el.innerHTML) {
		el.innerHTML = lang.format("{0}{1}{2}",
			"<div class=\"picture\"></div>",
			"<div class=\"name\"></div>",
			"<div class=\"activity\"></div>");
	}
	if (!friend.data || (friend.data.name !== data.name)) {
		nameEl = dom.queryOne(".name", el);
		nameEl.textContent = data.name;
	}
	if (!friend.data || (friend.data.icon !== data.icon)) {
		image = new ui.SPImage(data.icon);
		imageEl = dom.queryOne(".picture", el);
		dom.empty(imageEl);
		imageEl.appendChild(image.node);
	}
	friend.data = data;
	return friend;
}

function showFriend(friend, noAnim) {
	noAnim = !!noAnim;
	friend.node.classList.remove("hide");
	if (noAnim) {
		friend.node.classList.remove("show");
		friend.node.classList.remove("hidden");
		return friend;
	}
	friend.node.classList.add("show");
	return friend;
}

function hideFriend(friend, noAnim) {
	noAnim = !!noAnim;
	friend.node.classList.remove("show");
	if (noAnim) {
		friend.node.classList.remove("hide");
		friend.node.classList.add("hidden");
		return friend;
	}
	friend.node.classList.add("hide");
	return friend;
}

function removeFriend(friend) {
	var node = friend.node;
	r.takeFirst(r.fromDOMEvent(node, "webkitAnimationEnd")).subscribe(function(e) {
		node.parentNode.removeChild(node);
	});
	node.classList.add("hide");
	return friend;
}

function isHidden(friend) {
	return friend.node.classList.contains("hidden");
}

function friendEquals(friend, otherFriend) {
	return friend.data.uri === otherFriend.data.uri;
}

function sortByName(friends) {
	return friends.sort(function(f1, f2) {
		return compare(f1.data.name.toLowerCase(),
			f2.data.name.toLowerCase());
	});
}

// Navigate somewhere
function navigateTo(uri) {
	if (uri !== window.location.href) {
		window.location = uri;
	}
}

// Navigate somewhere, but not too fast!
var throttledNavigateTo = throttle(navigateTo, 300);

/**
 * Feed section.
 */
var topTrack = '';

function getTopTrack(favorites) {
	for (var favorite in favorites) {
		if (favorites[favorite].length) {
			return favorites[favorite].shift().uri;
		}
	}
}

function getGlobalTopTrack() {
	sp.social.getToplist("tracks", "everywhere", sp.core.user.canonicalUsername, {
		onSuccess: function(result) {
			topTrack = getTopTrack(result);
		},
		onFailure: function() {},
		onComplete: function() {}
	});
}
// Possible TODO: First try presence for last listened song and THEN try
// social if presence comes up empty. Check with Mattias.
sp.social.getToplist("tracks", "user", sp.core.user.canonicalUsername, {
	onSuccess: function(result) {
		if (result.tracks && result.tracks.length) {
			topTrack = getTopTrack(result);
		} else {
			getGlobalTopTrack();
		}
	},
	onFailure: function(error) {
		getGlobalTopTrack();
	},
	onComplete: function () {}
});

// Get the type of presence based on content of data
function getPresenceType(state) {
    if (hasKey("playlist_published", state))
        return PRESENCE_TYPES.PLAYLIST_PUBLISHED;
    else if (hasKey("playlist_track_added", state)) {
        if (isStarredPlaylist(state.playlist_track_added.playlist_uri))
            return PRESENCE_TYPES.PLAYLIST_TRACK_STARRED;
        return PRESENCE_TYPES.PLAYLIST_TRACK_ADDED;
    }
    else if (hasKey("track_finished_playing", state))
        return PRESENCE_TYPES.TRACK_FINISHED_PLAYING;
    else if (hasKey("facebook_activity", state))
        return PRESENCE_TYPES.FACEBOOK_ACTIVITY;
    else
        return PRESENCE_TYPES.UNKNOWN;
}

// Get the Most Interesting URI from a presence state, so we can play it
function getUriFromPresenceState(state) {
	var type = getPresenceType(state);
	var uri;
	switch (type) {
		case PRESENCE_TYPES.PLAYLIST_PUBLISHED:
			uri = state["playlist_published"]["uri"];
			break;
		case PRESENCE_TYPES.PLAYLIST_TRACK_ADDED:
		case PRESENCE_TYPES.PLAYLIST_TRACK_STARRED:
			uri = state["playlist_track_added"]["track_uri"];
			break;
		case PRESENCE_TYPES.TRACK_FINISHED_PLAYING:
			uri = state["track_finished_playing"]["uri"];
			break;
		default:
			uri = null;
			break;
	}
	return uri;
}

/**
 * @constructor
 */
function Feed() {
	this.items = [];
	this.node = document.createElement("div");
	this.node.className = "feed";
	setInterval(partial(cleanFeed, this), CLEAN_INTERVAL);
	//setInterval(partial(map, updateTime, this.items), UPDATE_INTERVAL);
}

function addItem(state, feed, animate) {
    var event_categories = ['playlist_published', 'playlist_track_added', 'track_finished_playing', 'facebook_activity'];
    var cat, ts, s;
    for (var i = 0; i < event_categories.length; ++i) {
        cat = event_categories[i];
        if (hasKey(cat, state)) {
            ts = state[cat].timestamp;
            if (ts === undefined) continue;
            s = { timestamp: ts, user: state.user };
            s[cat] = state[cat];
            _addItem(s, feed, animate);
        }
    }
    return feed;
}

/**
 * Add an Item to a Feed
 * Wrapper for _addItem, split state of each category and feed to _addItem
 * @param {Object} state Hermes presence state
 * @param {Feed} feed
 * @param {boolean} animate
 * @return {Feed}
 */
function _addItem(state, feed, animate) {
    if (popover.popover && popover.popover.visible) return {};
    var type = getPresenceType(state);
    var needsArtwork = type === PRESENCE_TYPES.PLAYLIST_TRACK_ADDED ||
                       type === PRESENCE_TYPES.PLAYLIST_TRACK_STARRED;
    return new Item(state, type === PRESENCE_TYPES.UNKNOWN ? id :
        compose(partial(showItem, animate),
            needsArtwork ? partial(getArtwork, state["playlist_track_added"]["track_uri"]) : id,
            partial(findSlotAndInsert, feed)));
}

/**
 * A type which holds all the data needed for an Item
 * @param {Object} state Presence state
 * @param {Object} user User object
 * @constructor
 */
function ItemData(state, user) {
	this.type = getPresenceType(state);
}

/**
 * Find a nice slot for this item, below sticky items, newer items, etc
 * @param {Feed} feed
 * @param {Item} item
 * @return {number}
 */
function findSlot(feed, item) {
    var feedItems = feed.items;
    for (var ix = 0, l = feedItems.length; ix < l; ++ix) {
        if (1 === compareItems(item, feedItems[ix]))
            break;
    }
    return ix;
}

/**
 * @param {Feed} feed
 * @param {Item} item
 * @param {number} ix
 * @return {Item}
 */
function insertAtIndex(feed, item, ix) {
    feed.items.splice(ix, 0, item);
    feed.node.insertBefore(item.node, feed.node.childNodes[ix]);
    return item;
}

/**
 * @param {Feed} feed
 * @param {Item} item
 * @return {Item}
 */
function findSlotAndInsert(feed, item) {
    return containsItem(feed, item.data) ? item :
        insertAtIndex(feed, item, findSlot(feed, item));
}

/**
 * Remove an Item from a Feed, by index
 * @param {Feed} feed
 * @param {number} ix
 * @return {Feed}
 */
function removeItem(feed, ix) {
	//console.log(lang.format("Removing feed item {0} of {1}", ix + 1, feed.items.length));
	var item = feed.items.splice(ix, 1)[0];
	feed.node.removeChild(item.node);
	return feed;
}

/**
 * Clean up old Items in a Feed
 * @param {Feed} feed
 * @return {Feed}
 */
function cleanFeed(feed) {
	var toRemove = feed.items.length - MAX_ITEMS;
	var i = toRemove;// - toRemove % 2; // Hack to not ruin the CSS zebra striping
	if (i > 0) {
		//console.log(lang.format("Cleaning feed from {0} items out of {1}", i, feed.items.length));
		do {
			removeItem(feed, feed.items.length - 1);
		}
		while (--i);
	}
	return feed;
}

/**
 * Compare items based on date and stickiness multiplier
 * @param {Item} itemA
 * @param {Item} itemB
 * @return {number}
 */
function compareItems(itemA, itemB) {
	return compare(getStickyness(itemA),
		getStickyness(itemB));
}

/**
 * Check if feed contains a presence state already
 * @param {Feed} feed
 * @param {Object} state
 * @return {boolean}
 */
function containsItem(feed, state) {
	var found = false;
	for (var i = 0, l = feed.items.length; i < l; ++i) {
		if (equalStates(state, feed.items[i].data)) {
			found = true;
			break;
		}
	}
	return found;
}

// @return {boolean}
function equalStates(stateA, stateB) {
	return stateA.user.uri === stateB.user.uri &&
		stateA.timestamp === stateB.timestamp;
}

/**
 * @param {Object} data
 * @param {function(Item):*} callback
 * @constructor
 */
function Item(data, callback) {
	var item = this;
	var node = item.node = document.createElement("a");
	var text = document.createElement("span");
	var image = new ui.SPImage(data.user.icon);
	var type = getPresenceType(data);

	item.data = data;
	item.type = type;
	//item.date = new ItemDate(item);

	node.className = "item type-" + type;
	node.title = data.user.name;
	node.href = data.user.uri;

	node.appendChild(image.node);
	node.appendChild(text);
	//node.appendChild(item.date.node);

	stringFromState(data, compose(callback/*, updateTime*/, function(s) {
		text.innerHTML = s;
		return item;
	}), false);

	r.fromDOMEvent(node, "dragover").subscribe(function(e) {
		var linkType = sp.core.getLinkType(e.dataTransfer.getData("text"));
		if (SHARABLE_LINK_TYPES[linkType]) {
			e.preventDefault();
		}
	});

	r.fromDOMEvent(node, "dragenter").subscribe(function(e) {
		var linkType = sp.core.getLinkType(e.dataTransfer.getData("text"));
		if (SHARABLE_LINK_TYPES[linkType]) {
			e.target.classList.add("drag-over");
		} else {
			e.dataTransfer.dropEffect = "none";
		}
	});

	r.merge(r.fromDOMEvent(node, "drop"), r.fromDOMEvent(node, "dragleave")).subscribe(function(e) {
		e.target.classList.remove("drag-over");
	});

	// Show info popover
	r.fromDOMEvent(item.node, "click").subscribe(function(e) {
		e.preventDefault();
		e.stopPropagation();
		if (popover.popover && popover.popover.targetNode === e.target) {
			popover.popover.hide(false);
			return;
		}
		showFeedPopover(item.data, item.node, item.node.parentNode.parentNode);
	});

	r.fromDOMEvent(node, "drop").subscribe(function(e) {
		var uri = e.dataTransfer.getData("text");
		var linkType = sp.core.getLinkType(uri);

		if (SHARABLE_LINK_TYPES[linkType]) {
			if (popover.popover && popover.popover.targetNode === e.target) {
				popover.popover.hide(true);
			}
			popover.sharePopup(data.user, uri, node, {
				relativeNode: item.node.parentNode.parentNode
			});
		} else {
			sp.core.showClientMessage(0, lang.format(_("unsupportedDropType"), sp.core.user.name));
		}
	});
}

/**
 * @param {string} uri
 * @param {Item} item
 * @return {Item}
 */
function getArtwork(uri, item) {
    var image;
    md.getMetadata(uri, function(metadata) {
        if (!metadata) return;
        image = new ui.SPImage(metadata.album.cover, uri + "?action=browse",
            lang.format(lang.getString(catalog, "Misc", "Item by artists"),
                metadata.name, stringFromArtistsArray(metadata.artists)));
        image.node.classList.add("cover");
        item.node.appendChild(image.node);
    });
    return item;
}

/**
 * @param {boolean} animate
 * @param {Item} item
 * @return {Item}
 */
function showItem(animate, item) {
	var node = item.node;
	var intrinsicHeight = node.offsetHeight;
	node.style.zIndex = getStickyness(item); // Reverse stacking order
	if (animate) {
		node.style.marginTop = -intrinsicHeight + "px";
		node.offsetWidth;
		node.classList.add("show");
		node.style.marginTop = "0";
	}
	return item;
}

/**
 * A date for feed items which can be updated
 * @param {Object} data
 * @constructor
 */
function ItemDate(data) {
	var ts = data.timestamp;
	this.date = new Date(ts * 1000);
	this.node = document.createElement("time");
	this.node.classList.add("sp-text-truncate");
}

/**
 * @param {Item} item
 * @return {Item}
 */
function updateTime(item) {
	item.date.node.textContent = dt.timeAgo(item.date.date);
	return item;
}

/**
 * @param {Item} item
 * @return {number}
 */
function getStickyness(item) {
	// Somewhat arbitrary
	return item.data.timestamp + item.type * 120;
}

/**
 * Serialize a Feed so it can be put in storage and restored
 * @param {Feed} feed
 * @return {string}
 */
function storeFeed(feed) {
	//console.log(lang.format("Storing feed with {0} items", feed.items.length));
	var itemData = map(function(item) { return item.data; }, feed.items);
	return storage.set("feedItemData", itemData);
}

/**
 * Restore a Feed
 * @param {Feed} feed
 * @return {Feed}
 */
function restoreFeed(feed) {
	var itemData = storage.getWithDefault("feedItemData", []);
	map(function(data) { return _addItem(data, feed, false); }, itemData);
	return feed;
}

/**
 * Lots of overlap with hermes.js here, TODO: make it nicer
 */
function hasKey(k, obj) {
	return obj.hasOwnProperty(k);
}

/**
 * @param {string} uri
 * @return {boolean}
 */
function isStarredPlaylist(uri) {
	return /:starred$/.test(uri) && !/:playlist:/.test(uri); // Gross
}

function formatPlaylistPublished(state, callback) {
	var uri = state.playlist_published.uri;
	md.getMetadata(uri, function(metadata) {
		if (!metadata) {
//			console.log("Uninitialized result for: " + uri);
			return;
		}
		callback(lang.format(_p("Playlist published"),
			lang.format("<strong>{0}</strong>", state.user.name.decodeForHTML()),
			lang.truncate(metadata.name.decodeForHTML(), 40)));
	});
}

function formatPlaylistTrackAdded(state, callback) {
	var uri = state.playlist_track_added.track_uri;
	//console.log("Track added to playlist", uri);
	if (isStarredPlaylist(state.playlist_track_added.playlist_uri)) {
		md.getMetadata(uri, function(metadata) {
			if (!metadata || metadata.isInvalid) {
				//console.log("Uninitialized result for: " + uri);
				return;
			}
			callback(lang.format(_p("Playlist track starred"), lang.format("<strong>{0}</strong>", state.user.name.decodeForHTML()),
				metadata.name.decodeForHTML(), stringFromArtistsArray(metadata.artists)));
		});
	} else {
		md.getMetadata([uri, state.playlist_track_added.playlist_uri], function(metadata) {
			if (null === metadata || !metadata[0]) return;
			var track = metadata[0];
			var playlist = metadata[1];

			callback(lang.format(_p("Playlist track added"), lang.format("<strong>{0}</strong>", state.user.name.decodeForHTML()),
			track.name.decodeForHTML(), playlist ? playlist.name.decodeForHTML() : _p("A playlist")));
		});
	}
}

function formatTrackFinishedPlaying(state, callback) {
	var uri = state.track_finished_playing.uri;
	md.getMetadata(uri, function(md) {
		if (!md || md.isInvalid) {
			return;
		}
		callback(lang.format(_p("Track finished playing"), lang.format("<strong>{0}</strong>",
			state.user.name.decodeForHTML()),
			md.name.decodeForHTML(), stringFromArtistsArray(md.artists)));
	});
}

function formatFacebookActivity(state, callback) {
	callback(lang.format("{0}<br><button class=\"share-button\">{2}</button>",
		lang.format(_p("Facebook activity"),
			lang.format("<strong>{0}</strong>", state.user.name.decodeForHTML())),
		state.user.uri.decodeForHTML(),
		_p("Send music")));
}

function stringFromState(state, callback) {
	var format = constant;
	//console.log(lang.format("stringFromState {0}", JSON.stringify(state)));
	var type = getPresenceType(state);
	if (type === PRESENCE_TYPES.PLAYLIST_PUBLISHED)
		format = formatPlaylistPublished;
	else if (type === PRESENCE_TYPES.PLAYLIST_TRACK_ADDED || type === PRESENCE_TYPES.PLAYLIST_TRACK_STARRED)
		format = formatPlaylistTrackAdded;
	else if (type === PRESENCE_TYPES.TRACK_FINISHED_PLAYING)
		format = formatTrackFinishedPlaying;
	else if (type === PRESENCE_TYPES.FACEBOOK_ACTIVITY)
		format = formatFacebookActivity;
	else if (type === PRESENCE_TYPES.UNKNOWN)
		format = formatFacebookActivity;
//	console.log(lang.format("Unknown presence state type: {0}", JSON.stringify(state)));
	return format(state, callback);
}

function linksFromArtistsArray(artists) {
	return map(function(a) { return linkString(a.uri, lang.truncate(a.name.decodeForHTML(), 20)); },
		artists).join(", ");
}

function stringFromArtistsArray(as) {
    return lang.truncate(map(function(a) { return a.name.decodeForHTML(); }, as).join(", "), 20);
}

function linkString(uri, text) {
	return lang.format("<a href=\"{0}\">{1}</a>", uri.decodeForHTML(), lang.truncate(text.decodeForHTML(), 20));
}

/**
 * Show more info about a feed item
 * @param {Item} item
 * @param {Node} node
 * @param {Node} relNode
 */
function showFeedPopover(data, node, relNode) {
	var contentNode = document.createElement("div");
	var relativeNode = relNode || node.parentNode.parentNode;
	var text = contentNode.cloneNode();
	var type = getPresenceType(data);

	var uri = getUriFromPresenceState(data);
	var date = new ItemDate(data);

	var player = new MiniPlayer();
	var timerId = -1;

	if (type === PRESENCE_TYPES.TRACK_FINISHED_PLAYING) {
		text.innerHTML = lang.format(_p("Listened to"), lang.format("<strong>{0}</strong>",
			linkString(data.user.uri, data.user.name)));
		player.loadURI(uri);
	} else if (type === PRESENCE_TYPES.FACEBOOK_ACTIVITY) {
		md.getMetadata(topTrack, function(md) {
			var prependElem = document.createElement("span");
			prependElem.className = "optional-message";
			prependElem.innerHTML = lang.format(_p("Most listened track"),
				linkString(md.uri, md.name),
				linkString(data.user.uri, data.user.name));
			popover.sharePopup(data.user, topTrack, node, {
				relativeNode: relativeNode,
				sharePopoverPrependElem: prependElem
			});
		});
		return;
	} else if (type === PRESENCE_TYPES.PLAYLIST_PUBLISHED) {
		text.innerHTML = lang.format(_p("User published playlist"),
			lang.format("<strong>{0}</strong>", linkString(data.user.uri, data.user.name)));
		player.loadURI(data["playlist_published"]["uri"]);
	} else if (type === PRESENCE_TYPES.PLAYLIST_TRACK_ADDED) {
		md.getMetadata(data["playlist_track_added"]["playlist_uri"], function(md) {
			if (md === null) {
				//console.log("getMetadata: bad metadata for " + uri);
				return;
			}
			text.innerHTML = lang.format(_p("User added track"),
				lang.format("<strong>{0}</strong>", linkString(data.user.uri, data.user.name)),
				lang.format("<strong>{0}</strong>", linkString(md.uri, md.name)));
		});
		player.loadURI(data["playlist_track_added"]["track_uri"]);
	} else if (type === PRESENCE_TYPES.PLAYLIST_TRACK_STARRED) {
		text.innerHTML = lang.format(lang.format("<strong>{0}</strong>", linkString(data.user.uri, data.user.name)));
		player.loadURI(data["playlist_track_added"]["track_uri"]);
	} else {
		// Show the no presence popover
		// We need to request the user data, or pics won't show
		var image = new ui.SPImage(data.user.picture);
		text.className = "no-presence";
		text.innerHTML = lang.format("<strong class=\"sp-text-truncate\">{0}</strong>",
			lang.format("<a href=\"{0}\">{1}</a>", data.user.uri.decodeForHTML(), data.user.name.decodeForHTML()));
		text.innerHTML += lang.format("<a href=\"{0}\">{1}</a>", data.user.uri.decodeForHTML(), _("View profile"));
		text.insertBefore(image.node, text.firstChild);
		date = null;
	}

	contentNode.className = "feed-popover";
	contentNode.appendChild(text);

	if (uri) {
		contentNode.appendChild(player.node);
	}

	var popupId = +new Date();
	log.logClientEvent("feed popover", "open", "1", "1", {
		popupId: popupId,
		uri: uri});
	contentNode.addEventListener("click", function (e) {
		if (e.target.tagName !== "A" || !e.target.href) return;
		log.logClientEvent("feed popover", "link", "1", "1", {
			popupId: popupId,
			uri: e.target.href});
	});
	contentNode.addEventListener("playstatechange", function (e) {
		log.logClientEvent("feed popover", e.playing ? "play" : "pause", "1", "1", {
			popupId: popupId,
			uri: e.resource.uri});
	});

	if (date) {
		contentNode.appendChild(date.node);
	}

	var feedPopover = popover.showPopover({
		contentNode: contentNode,
		relativeNode: relativeNode
	});

	feedPopover.show(node);

	if (date) {
		// Update time until popover is gone
		timerId = setInterval((function update() {
			date.node.textContent = dt.timeAgo(date.date);
			if (true !== feedPopover.visible)
			    clearInterval(timerId);
			return update;
		}()), UPDATE_INTERVAL);
	}
}

/**
 * @constructor
 */
function MiniPlayer() {
	var player      = this;
	player.resource = null
	player.node     = document.createElement("div");
	player.playing  = false;

	player.button   = document.createElement("a");
	player.nameNode = player.node.cloneNode();
	player.infoNode = player.node.cloneNode();

	player.node.className = "player paused";
	player.nameNode.className = "name sp-text-truncate";
	player.infoNode.className = "info sp-text-truncate";

	function onPlayerStateChanged(e) {
		if (e.data.playstate) {
			sp.trackPlayer.getIsPlaying() && player.isCurrentlyPlaying() ?
				player.play(false) : player.pause(false);
		}
	}

	player.node.addEventListener("DOMNodeInsertedIntoDocument", function(e) {
		sp.trackPlayer.addEventListener("playerStateChanged", onPlayerStateChanged);
	});

	player.node.addEventListener("DOMNodeRemovedFromDocument", function(e) {
		sp.trackPlayer.removeEventListener("playerStateChanged", onPlayerStateChanged);
	});

    player.button.addEventListener("click", function(e) {
		e.preventDefault();
		player.toggle(true);
    });

	player.button.classList.add("play");

	player.node.appendChild(player.button);
	player.node.appendChild(player.nameNode);
	player.node.appendChild(player.infoNode);
}

MiniPlayer.prototype.toggle = function(perform) {
	return true === this.playing ? this.pause(perform) : this.play(perform);
};

function triggerPlayerEvent(player, playing) {
	var e = document.createEvent("Event");
	e.initEvent("playstatechange", true, true);
	e.playing = playing;
	e.resource = player.resource;
	return player.node.dispatchEvent(e);
}

MiniPlayer.prototype.play = function(perform) {
	if (perform && !triggerPlayerEvent(this, true)) return;

	var player = this;
	player.playing = true;
	player.node.classList.remove("paused");
	if (false === perform)
		return player;
	// Already on this song
	if (player.onSameSong()) {
		sp.trackPlayer.setIsPlaying(player.playing);
	} else {
		sp.trackPlayer.playTrackFromUri(player.resource.uri, {
			onSuccess: id,
			onFailure: function() {
				player.pause();
			}
		});
	}
	return player;
};

MiniPlayer.prototype.pause = function(perform) {
	if (perform && !triggerPlayerEvent(this, false)) return;

	this.playing = false;
	this.node.classList.add("paused");
	if (true === perform)
		sp.trackPlayer.setIsPlaying(this.playing);
	return this;
};

MiniPlayer.prototype.loadURI = function(uri) {
	var player = this;
	var linkType = sp.core.getLinkType(uri);
	var image = null;
	// Load track
	if (4 === linkType) {
		api.Track.fromURI(uri, partial(playTrack, player));
		// Set current state
		if (player.isCurrentlyPlaying()) {
			player.play(false);
		}
	} else if (5 === linkType) {
		// Playlist
		api.Playlist.fromURI(uri, partial(playPlaylist, player));
		// Set current state
		if (player.isCurrentlyPlaying()) {
			player.play(false);
		}
	}
	player.button.title = player.resource.name;
	player.button.href = uri;
};

function playTrack(player, track) {
	var image;
	player.resource = track;
	if (null !== track.image) {
		image = new ui.SPImage(track.image);
		player.node.appendChild(image.node);
	}
	player.nameNode.innerHTML = lang.format("<a href=\"{0}\">{1}</a>", track.uri.decodeForHTML() + "?action=browse", track.name.decodeForHTML());
	player.infoNode.innerHTML = linksFromArtistsArray(track.data.artists || []);
	return track;
}

function playPlaylist(player, pl) {
	var image;
	player.resource = pl;
	if (null !== pl.image) {
		image = new ui.SPImage(pl.image);
		player.node.appendChild(image.node);
	}
	player.nameNode.innerHTML = lang.format("<a href=\"{0}\">{1}</a>", pl.uri.decodeForHTML(), pl.name.decodeForHTML());
	player.infoNode.textContent = pl.data.owner.name;
	return pl;
}

// Check if the "real" player is currently playing this player's resource
MiniPlayer.prototype.isCurrentlyPlaying = function() {
	return sp.trackPlayer.getIsPlaying() && this.onSameSong();
};

MiniPlayer.prototype.onSameSong = function() {
	var currentlyPlaying = sp.trackPlayer.getNowPlayingTrack();
	var uri;
	if (null === this.resource || null === currentlyPlaying) {
		return false;
	}
	uri = this.resource.uri;
	if (uri === currentlyPlaying.track.uri ||
		currentlyPlaying.source === uri) {
			return true;
		}
	return false;
};
