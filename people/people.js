"use strict";

sp = getSpotifyApi(1);
exports.init = preInit;

var hermes = sp.require('sp://import/scripts/hermes');
var dnd = sp.require('sp://import/scripts/dnd');
var ui = sp.require('sp://import/scripts/ui');
var lang = sp.require('sp://import/scripts/language');
var catalog = lang.loadCatalog('cef_views');
var _ = partial(lang.getString, catalog, 'People');
var storage = sp.require('sp://import/scripts/storage');
var g = sp.require('sp://import/scripts/grid');
var pf = sp.require('peopleFilter');

var peopleFilter;
var social = sp.social;
var relations = social.relations;
var favorites = social.getFavorites();
var cachedPresences = {};
var observedUsers = {};
var grid;
var gridContainer;
var done = false;
var facebookEnabled = false;
var socialServiceStates = social.serviceStates;

function tabUpdate(po) {
    var arg = sp.core.getArguments()[0];
    peopleFilter.reCache(arg);
    init();
}

function preInit(gridId, inputId, clearId)
{
    gridContainer = document.getElementById(gridId);
	_showLoadingThrobber();
	facebookEnabled = _isFacebookEnabled();
	social.addEventListener('socialStateUpdate', _relationsLoaded);
	relations.addEventListener('load', _relationsLoaded);
    if (relations.loaded) {
      var arg = sp.core.getArguments()[0];
      peopleFilter = pf.PeopleFilter(inputId, clearId, _rebuildGrid, arg);
      _relationsLoaded();
      sp.core.addEventListener("argumentsChanged", tabUpdate);
    }
}

function init()
{
	cachedPresences = storage.getWithDefault('cachedPresences', {});

    gridContainer.innerHTML = '';
	grid = new g.Grid('people', new PeopleDataSource(), gridContainer);
	grid.node.classList.add('fill');
	if (1 === sp.core.getLoginMode()) {
		setTimeout(partial(_subscribeToUsers, relations.allSpotifyUsers()), 100);
	}

	grid.rebuild();

	window.addEventListener('resize', _resizeGrid);
	favorites.addEventListener('change', _favoritesUpdated);
	relations.addEventListener('change', _relationsChanged);
	sp.core.addEventListener('login', _isLoggedIn);
	sp.core.addEventListener('hermes', _presenceUpdated);
}

function _isFacebookEnabled()
{
	for (var i = 0, l = socialServiceStates.length; i < l; i++) {
		if ("facebook" === socialServiceStates[i].servicename) {
			return socialServiceStates[i].enabled;
		}
	}
}

function _socialStateUpdate()
{
	gridContainer.innerHTML = "";
	facebookEnabled = _isFacebookEnabled();
	if (!relations.length) {
		_userHasNoFriends();
	} else {
		init();
	}
}

function _relationsLoaded()
{
	if (!relations.length) {
		_userHasNoFriends();
	} else {
		init();
	}
	_hideLoadingThrobber();
}

function _userHasNoFriends()
{
	var frag = document.createDocumentFragment();
	var article = document.createElement("article");
	var placeholder = document.createElement("image");
	var h1 = document.createElement("h1");
	var h2 = document.createElement("h2");

	placeholder.src = "sp://import/img/people-light.png";
	h1.textContent = _("sPeopleSpotifyIsMoreFun");
	h2.textContent = _("sPeopleShareMusic");

	article.appendChild(placeholder);
	article.appendChild(h1);
	article.appendChild(h2);

	if (facebookEnabled) {
		var anchor = document.createElement("a");
		anchor.classList.add('new-button');
		anchor.textContent = _("sPeopleFindFriends");
		anchor.href = "http://www.facebook.com";
		article.appendChild(anchor);
	} else {
		var button = document.createElement("button");
		button.classList.add('new-button');
		button.textContent = _("sPeopleGetStarted");
		article.appendChild(button);
		button.addEventListener('click', function() { sp.social.connectToFacebook(); });
	}

	frag.appendChild(article);
	document.body.appendChild(frag);
}

function _resizeGrid()
{
	grid.resize();
}

function _rebuildGrid()
{
	grid.rebuild();
}

function _filterUsers(user)
{
	return !observedUsers[user];
}

function _relationsChanged()
{
	var newUsers = filter(_filterUsers, relations.allSpotifyUsers());

	_subscribeToUsers(newUsers);
	_rebuildGrid();
}

function _isLoggedIn()
{
	_subscribeToUsers(relations.allSpotifyUsers());
	_rebuildGrid();
}

function _showLoadingThrobber()
{
	setTimeout(function()
	{
		if (!done)
		{
			var loading = document.createElement('div');
			loading.id = 'loading';
			loading.classList.add('throbber');
			loading.classList.add('visible');
			loading.appendChild(document.createElement('div'));
			document.body.appendChild(loading);
		}
	}, 500);
}

function _hideLoadingThrobber()
{
	var loading = document.getElementById('loading');
	if (loading)
	{
		loading.classList.remove('visible');
		setTimeout(function() { loading.parentNode.removeChild(loading); }, 500);
	}
	done = true;
}

function PeopleDataSource()
{
	this.size = function()
	{
		return [170, 200];
	};

	this.padding = function()
	{
		return [0, 0, 10, 0];
	};

	this.count = function()
	{
          return peopleFilter.matchCount();
	};

	this.makeNode = function(index)
	{
		var node = _makeUserNode(peopleFilter.getUser(index));
		return node;
	};

	this.dropNode = function(node)
	{

	};
}

function _makeUserNode(user)
{
	var node = document.createElement("div");
	node.classList.add("user");
	if (user.canonicalUsername != "")
		node.id = user.canonicalUsername;

	var link = document.createElement("a");
	link.title = user.name;
	link.classList.add("userlink");
	link.setAttribute("href", user.uri);

	var profilePic = new ui.SPImage(user.picture);
	link.appendChild(profilePic.node);

	var favoriteButton = document.createElement("button");
	favoriteButton.classList.add("button");
	favoriteButton.classList.add("favorite-button");
	favoriteButton.user = user;
	_updateFavoriteButton(favoriteButton);

	favoriteButton.addEventListener('click', function(event)
	{
		event.preventDefault();
		_toggleFavoriteState(user);
	});

	profilePic.node.appendChild(favoriteButton);
	node.appendChild(link);

	var labelLink = document.createElement("a");
	labelLink.classList.add("userlink");
	labelLink.setAttribute("href", user.uri);
	labelLink.textContent = user.name;

	var label = document.createElement("span");
	label.classList.add("username");
	label.appendChild(labelLink);
	node.appendChild(label);

	var presence = document.createElement("span");
	presence.classList.add("presence");
	presence.textContent = "";
	node.appendChild(presence);

	// Don't subscribe to the presence events right away, because those method
	// calls might take some time to execute, and this method is invoked many
	// times when scrolling in the window, and we don't want to make that slow.
	setTimeout(function() { _observePresence(user) }, 100);

	return node;
}

function _updateFavoriteButton(button)
{
	var user = button.user;
	var isFavorite = (favorites.all().indexOf(user.uri) != -1);
	button.innerHTML = (isFavorite? _("sPeopleRemoveFromFavourites"): _("sPeopleAddToFavourites"));
}

function _toggleFavoriteState(user)
{
	var uri = user.uri;
	if (favorites.all().indexOf(user.uri) != -1)
		favorites.remove(uri);
	else
		favorites.add(uri);
}

function _updatePresenceNode(username, state)
{
	hermes.stringFromPresenceState(state, function(string)
	{
		var node = document.getElementById(username);
		if (node)
		{
			var presenceElements = node.getElementsByClassName("presence");
			presenceElements[0].innerHTML = string;
		}
	});
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

function _observePresence(user)
{
	var username = user.canonicalUsername;
	if (username == "")
		return;

	var cached = cachedPresences[username];
	if (cached && Object.keys(cached).length != 0)
		_updatePresenceNode(username, cached);

	if (observedUsers[username])
		return;

	sp.core.getHermes("GET", "hm://presence/user/", [username],
	{
		onSuccess: function(event)
		{
			var state = sp.core.parseHermesReply("PresenceState", arguments[0]);
			_updatePresenceNode(username, state);

			cachedPresences[username] = state;
			storage.set("cachedPresences", cachedPresences);
		},
		onFailure:  function(event) {},
		onComplete: function(event) {}
	});

	observedUsers[username] = true;
}

function _presenceUpdated(event)
{
	var uri = event.data[0];
	if (uri.indexOf("hm://presence/user/") !== -1)
	{
		var username = uri.slice("hm://presence/user/".length, -1);
		var state = sp.core.parseHermesReply("PresenceState", event.data[1]);
		_updatePresenceNode(username, state);

		cachedPresences[username] = state;
		storage.set("cachedPresences", cachedPresences);
	}
}

function _favoritesUpdated(event)
{
	var buttons = document.getElementsByClassName("favorite-button");
	for (var i = 0; i < buttons.length; i++)
		_updateFavoriteButton(buttons[i]);
}