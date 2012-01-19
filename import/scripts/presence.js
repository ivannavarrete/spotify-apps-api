"use strict";

sp = getSpotifyApi(1);

exports.observePresence = observePresence;
exports.subscribeToPresence = _subscribeToUsers;

var hermes = sp.require('sp://import/scripts/hermes');
var dom = sp.require('sp://import/scripts/dom');
var storage = sp.require('sp://import/scripts/storage');

var cachedPresences = {};
var observedUsers = {};
var resubscribers = {};
var initialized = false;

function _init()
{
	cachedPresences = storage.getWithDefault('cachedPresences', {});
	initialized = true;
	dom.listen(sp.core, 'hermes', _presenceUpdated);
}

function _resubscribeToUsers()
{
	_subscribeToUsers(Object.keys(resubscribers));
	observedUsers = resubscribers;
}

function _subscribeToUsers(usernames)
{
	sp.core.getHermes("SUB", "hm://presence/user/", usernames,
	{
		onSuccess:  function(event) {},
		onFailure:  function(event) {},
		onComplete: function(event) {}
	});
}

function _presenceUpdated(event, callback)
{
	var uri = event.data[0];
	if (uri.indexOf("hm://presence/user/") !== -1)
	{
		var username = uri.slice("hm://presence/user/".length, -1);
		var state = sp.core.parseHermesReply("PresenceState", event.data[1]);
		_handlePresenceUpdate(username, state);
	}
}

function _handlePresenceUpdate(username, state)
{
	cachedPresences[username] = state;
	storage.set("cachedPresences", cachedPresences);
	hermes.stringFromPresenceState(state, function(string) {
		if (observedUsers[username])
			observedUsers[username](username, string);
	});
}

function observePresence(user, callback)
{
	if (initialized == false)
		_init();

	var username = user.canonicalUsername;
	if (username == "")
		return;

	var observedUser = observedUsers[username];
	observedUsers[username] = callback;

	var cached = cachedPresences[username];
	if (cached && Object.keys(cached).length != 0)
		_handlePresenceUpdate(username, cached);

	resubscribers[username] = true;
	if (observedUser || cached)
		return;

	sp.core.getHermes("GET", "hm://presence/user/", [username],
	{
		onSuccess: function(event)
		{
			var state = sp.core.parseHermesReply("PresenceState", arguments[0]);
			_handlePresenceUpdate(username, state);
		},
		onFailure:  function(event) {},
		onComplete: function(event) {}
	});

	//_subscribeToUsers([username]);
}
