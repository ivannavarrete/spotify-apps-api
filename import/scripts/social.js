"use strict";

sp = getSpotifyApi(1);

exports.getFavoriteUsers     = getFavoriteUsers;
exports.getUserBy            = getUserBy;
exports.getUserByUsername    = getUserByUsername;
exports.getUserByFacebookUid = getUserByFacebookUid;
exports.getUsernames         = getUsernames;
exports.addFavoriteUser      = addFavoriteUser;
exports.removeFavoriteUser   = removeFavoriteUser;
exports.toggleFavoriteUser   = toggleFavoriteUser;
exports.isFavoriteUser       = isFavoriteUser;

var _relations = null;
Object.defineProperty(exports, "relations", {
    get: function() {
        return _relations;
    }
})

var react   = sp.require("sp://import/scripts/react");
var storage = sp.require("sp://import/scripts/storage");

var RELATIONS_CACHE_KEY = "socialRelationsCache";
var favorites = exports.favorites = sp.social.getFavorites();

react.fromDOMEvent(sp.social.relations, "change").subscribe(function(e) {
	_relations = _getAllUsers();
	//console.log("Social data update, calling sp.social.relations.getAll() " + JSON.stringify(_relations));
	storage.set(RELATIONS_CACHE_KEY, _relations);
});

function _getAllUsers()
{
	var all = [];
	var rel = sp.social.relations;
	for (var i = 0; i < rel.length; i++)
		all[i] = rel.getUserInfo(i);
	return all;
}

_relations = storage.getWithDefault(RELATIONS_CACHE_KEY, _getAllUsers());

/**
 * Get user by predicate function
 * @param {function(Object):boolean} p
 * @return {Object|null}
 */
function getUserBy(p) {
	var users = filter(p, _relations);
	return 0 === users.length ? null : users[0];
}

function getUserByUsername(cun) {
	return getUserBy(partial(comparing, getCanonicalUsername, cun));
}

function getUserByFacebookUid(uid) {
	return getUserBy(partial(comparing, getFacebookUid, uid));
}

function getUserByUri(uri) {
	return getUserBy(partial(comparing, getUri, uri));
}

function getUsernames() {
	var userNames = [];
	var name;
	for (var i = 0, l = _relations.length; i < l; ++i) {
		name = _relations[i].canonicalUsername;
		if (name.length && 0 !== name.indexOf("spotify:user:facebook:"))
			userNames.push(name);
	}
	return userNames;
}

function getFavoriteUsers() {
	return filter(compose(not, partial(eq, null)),
		map(getUserByUri, favorites.all()));
}

/**
 * @param {Object} userData
 * @return {boolean}
 */
function isFavoriteUser(uri) {
	return -1 !== favorites.all().indexOf(uri);
}

function addFavoriteUser(uri) {
	if (!isFavoriteUser(uri)) {
		favorites.add(uri);
		return true;
	}
	return false;
}

// @return {boolean} true if relation changed, false otherwise
function removeFavoriteUser(uri) {
	if (isFavoriteUser(uri)) {
		favorites.remove(uri);
		return true;
	}
	return false;
}

// @return {boolean} true if user is now a favorite, false otherwise
function toggleFavoriteUser(uri) {
	var isFav = isFavoriteUser(uri);
	if (isFav) {
		removeFavoriteUser(uri);
	} else {
		addFavoriteUser(uri);
	}
	return !isFav;
}

function on(f, g, x, y) {
	return f(g(x), g(y));
}

var comparing = function(f, x, userData) { return eq(x, f(userData)); };

function getKey(key, obj) { return obj[key]; }
var getCanonicalUsername = partial(getKey, "canonicalUsername");
var getFacebookUid = partial(getKey, "facebookUid");
var getUri = partial(getKey, "uri");
