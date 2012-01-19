"use strict";

sp = getSpotifyApi(1);

exports.init = init;

var storage = sp.require('sp://import/scripts/storage'),
	schema = sp.require('sp://import/hermes/discovery'),
	util = sp.require('sp://import/scripts/util'),
	dom = sp.require('sp://import/scripts/dom'),
	array = sp.require('sp://import/scripts/array'),
	fx = sp.require('sp://import/scripts/fx'),
	ui = sp.require('sp://import/scripts/ui'),
	cf = sp.require('sp://import/scripts/coverflow'),
	lang = sp.require('sp://import/scripts/language'),
	catalog = lang.loadCatalog('cef_views'),
	_ = partial(lang.getString, catalog, "What's New"),
	p = sp.require('sp://import/scripts/pager'),
	r = sp.require('sp://import/scripts/react'),
	m = sp.require("sp://import/scripts/api/models"),
	v = sp.require("sp://import/scripts/api/views"),
	logger = sp.require("sp://import/scripts/logger"),
	presence = sp.require("sp://import/scripts/presence");


var headings = {
	FriendsPlaylists: _('sFriendsPlaylistsA')+' <span>'+_('sFriendsPlaylistsB')+'</span>',
	RegionPlaylists: _('sRegionPlaylistsA')+' <span>'+_('sRegionPlaylistsB')+'</span>',
	FriendsTracks: _('sFriendsTracksA')+' <span>'+_('sFriendsTracksB')+'</span>',
	RegionTracks: _('sRegionTracksA')+' <span>'+_('sRegionTracksB')+'</span>',
	NewFriends: _('sNewFriendsA')+' <span>'+_('sNewFriendsB')+'</span>',
	NewReleases: _('sNewReleases'),
	CountryTracks: _('sCountryTracks'),
	CountryPlaylists: _('sCountryPlaylists')
};

var loadingEl = null, hiddenSections = {}, currentStep = -1, currentLayout = 0,
	playlistToplists, trackToplists, playlistWrappers, trackWrappers,
	failures = [];

/**
 * Initiate the page
 */
function init()
{
	loadingEl = dom.queryOne('.loading');
	if (!navigator.onLine) {
		goOffline();
		return;
	}
	playlistToplists = [FriendsPlaylists, RegionPlaylists, CountryPlaylists];
	trackToplists = [FriendsTracks, RegionTracks, CountryTracks];
	playlistWrappers = [
		dom.queryOne('#topToplists .playlists'),
		dom.queryOne('#bottomToplists .playlists')
	];
	trackWrappers = [
		dom.queryOne('#topToplists .tracks'),
		dom.queryOne('#bottomToplists .tracks')
	];

	setLayoutType();

	dom.listen(window, 'resize', function() {
		setLayoutType();
	});

	Data.init();
	Discovery.init();
	NewReleases.init();
	//CountryTracks.init();
	CountryPlaylists.init();
	Ads.init();
	Banners.init();
}



/**
 *
 */
function goOffline()
{
	// If we go online again, reboot the page
	dom.listen(window, 'online', function(e) {
		window.location.reload();
	});
	dom.destroy(loadingEl);
	dom.id('wrapper').style.display = 'none';

	var offlineEl = new dom.Element('p', {id: 'offline', text: _('sUnavailableOffline').decodeForText()});
	dom.inject(offlineEl, document.body);
}



/**
 *
 */
function triggerFailure(key)
{
	if (failures.indexOf(key) === -1) {
		failures.push(key);
	}

	if (failures.length === 3) {
		goOffline();
	}
}



/**
 *
 */
function hasVScroll()
{
	if (window.scrollY > 0) {
		return true;
	}
	return window.innerHeight < document.height;
}



/**
 *
 */
function setLayoutType()
{
	var scrollWidth = hasVScroll() ? 14 : 0,
		w = window.innerWidth - scrollWidth, newLayout = currentLayout;
	if (w > 800) {
		newLayout = 1;
	} else if (w > 650 && w <= 800) {
		newLayout = 2;
	} else if (w <= 650) {
		newLayout = 3;
	}

	if (currentLayout !== newLayout) {
		currentLayout = newLayout;
		new dom.Event('layout.switch', true).dispatch(window);
	}
}



/**
 *
 */
function checkMPU(cb)
{
	if (Ads.isLoaded()) {
		cb.call(null, Ads.hasMPU());
	} else {
		dom.listen(window, 'ads.load', function() {
			cb.call(null, Ads.hasMPU());
		});
	}
}



/**
 *
 */
function step(sectionLoaded)
{
	// console.log('STEP: ', currentStep, sectionLoaded);

	switch (currentStep) {
		case -1:
			currentStep++;
			NewAlbums.next();
			break;
		case 0: // NewAlbums
			if (!sectionLoaded) {
				dom.destroy(dom.id('NewAlbums'));
			}
			currentStep++;
			playlistToplists.shift().next();
			break;
		case 1: // Top toplists, left
			if (!sectionLoaded && !playlistToplists.length) {
				dom.destroy(playlistWrappers.shift());
			}
			if (!sectionLoaded && playlistToplists.length) {
				playlistToplists.shift().next();
			} else {
				checkMPU(function(hasMPU) {
					currentStep++;
					if (!hasMPU) {
						trackToplists.shift().next();
					} else {
						dom.listen(window, 'ads.build', function() {
							step(true);
						});
					}
					Ads.next();
				});
			}
			break;
		case 2: // Top toplists, right
			if (!sectionLoaded && !trackToplists.length) {
				dom.destroy(trackWrappers.shift());
			}
			if (!sectionLoaded && trackToplists.length) {
				trackToplists.shift().next();
			} else {
				currentStep++;
				NewFriends.next();
			}
			break;
		case 3: // New friends
			if (!sectionLoaded) {
				dom.destroy(dom.id('NewFriends'));
			}
			currentStep++;
			NewReleases.next();
			break;
		case 4: // New releases
			if (!sectionLoaded) {
				dom.destroy(dom.id('NewReleases'));
			}
			if(playlistToplists.length) {
				currentStep++;
				playlistToplists.shift().next();
			}
			else {
				currentStep++;
			}
			break;
		case 5: // Bottom toplists, left
			if (!sectionLoaded && !playlistToplists.length) {
				dom.destroy(playlistWrappers.shift());
			}
			if (!sectionLoaded && playlistToplists.length) {
				playlistToplists.shift().next();
			} else {
				if(trackToplists.length) {
					currentStep++;
					trackToplists.shift().next();
				}
				else {
					currentStep++;
					step(false)
				}
			}
			break;
		case 6: // Bottom toplists, right
			if (!sectionLoaded && !trackToplists.length) {
				dom.destroy(trackWrappers.shift());
			}
			if (!sectionLoaded && trackToplists.length) {
				trackToplists.shift().next();
			} else {
				console.log('Done loading! GREAT SUCCESS!');
			}
			break;
	}
}



/**
 *
 */
var Data = {

	_cachedData: {},
	_liveData: {},

	/**
	 *
	 */
	init: function()
	{
		// this._cachedData = storage.getWithDefault('whatsnewData', {});
	},

	/**
	 *
	 */
	set: function(key, value)
	{
		this._liveData[key] = value;
		//this.store();
	},

	/**
	 * Get data by key
	 */
	get: function(key)
	{
		if (this._liveData[key]) {
			return this._liveData[key];
		} else if (this._cachedData[key]) {
			return this._cachedData[key];
		}
		return false;
	},

	/**
	 * Check if data exists for a key
	 */
	has: function(key)
	{
		if (this._liveData[key] || this._cachedData[key]) {
			return true;
		}
		return false;
	},

	/**
	 * Merge cached and live data and cache it
	 */
	store: function()
	{
		storage.set('whatsnewData', util.merge({}, this._cachedData, this._liveData));
	}
};



/**
 *
 */
var Discovery = {

	_loaded: false,
	_loadEvent: null,

	/**
	 *
	 */
	init: function()
	{
		this._loadEvent = new dom.Event('discovery.load', true);

		var useCache = setTimeout(function() {
			triggerFailure('Discovery');
		}, 2000);

		var self = this;
		var postObj = {
			"user_info": {
				"country": sp.core.country
			}
		};

		sp.core.getHermes('GET', 'hm://discovery/get-whats-new-data/',
			[
				["WhatsNewRequest", postObj]
			],
			{
				onSuccess: function(message)
				{
					clearTimeout(useCache);
					var data = sp.core.parseHermesReply('WhatsNewReply', message);

					NewAlbums.init(data.new_albums);
					FriendsPlaylists.init(data.friends_playlists);
					FriendsTracks.init(data.friends_tracks);
					RegionPlaylists.init(data.region_playlists);
					RegionTracks.init(data.region_tracks);
					NewFriends.init(data.new_friends);

					self._loaded = true;
					self._loadEvent.dispatch(window);
					step(true);
				},
				onFailure: function(errorCode)
				{
					triggerFailure('Discovery');
				}
			}
		);
	},

	/**
	 *
	 */
	isLoaded: function()
	{
		return this._loaded;
	}
};



/**
 *
 */
var NewAlbums = {

	_key: 'NewAlbums',
	_loaded: false,
	_loadEvent: null,

	/**
	 *
	 */
	init: function(data)
	{
		this._loadEvent = new dom.Event(this._key+'.load', true);
		if (!data || !data.albums) {
			data = {albums: []};
		}
		this.data = data;
		this.padAlbums = [];
		this.pad();
	},

	/**
	 *
	 */
	pad: function()
	{
		var self = this;
		sp.social.getToplist("album", sp.core.country, sp.core.user.canonicalUsername, {
			onSuccess: function(result) {
				if (result.albums && result.albums.length) {
					for (var i = 0; i < 50; i++) {
						var tmp = {};
						tmp["album_uri"] = result.albums[i].uri;
						tmp.isRecommended = false;
						self.data.albums.push(tmp);
					}
				}
				self.extend(self.data.albums);
			},
			onFailure: function() {
				self._loaded = true;
				self._loadEvent.dispatch(window);
			}
		});
	},

	/**
	 * Extend data received from discovery
	 */
	extend: function(data)
	{
		var self = this, uris = [];
		data.forEach(function(album) {
			uris.push(album.album_uri);
		});
		var count = 0;
		var recommendedCount = 0;
		var toplistCount = 0;

		if (!uris.length) {
			this._loaded = true;
			this._loadEvent.dispatch(window);
			return;
		}

		sp.core.getMetadata(uris, {
			onSuccess: function(md)
			{
				var filteredMetadata = [], artists = [];
				for(var i=0;i<md.length;i++) {
					var d = md[i];
					//Make sure we only include unique and available albums
					if(!array.contains(artists,d.artist.name) && d.artist.name !== "Various Artists" && d.availableForPlayback) {
						artists.push(d.artist.name);
						//Set isRecommended or not
						data.forEach(function(aData,index) {
							if(aData.album_uri == d.uri) {
								if(aData.isRecommended !== false) {
									d.isRecommended = true;
									recommendedCount++;
								}
								else {
									d.isRecommended = false;
									toplistCount++;
								}
							}
						});
						//Clone and delete album tracks array
						var clonedAlbum = clone(d);
						clonedAlbum.tracks = [];
						filteredMetadata.push(clonedAlbum);
						if(count == 4) {
							break;
						}
						count++;
					}
				}
				filteredMetadata = array.shuffle(filteredMetadata);
				if(!filteredMetadata[2].isRecommended) {
					for(var i = 0;i<filteredMetadata.length;i++){
						if(filteredMetadata[i].isRecommended) {
							var tempI = filteredMetadata[i];
							var tempJ = filteredMetadata[2];
							filteredMetadata[2] = tempI;
							filteredMetadata[i] = tempJ;
							break;
						}
					}
				}
				Data.set(self._key,filteredMetadata);
				self._loaded = true;
				self._loadEvent.dispatch(window);
			},
			onFailure: function()
			{
				self._loaded = true;
				self._loadEvent.dispatch(window);
			}
		});
	},

	/**
	 *
	 */
	next: function()
	{
		if (this._loaded) {
			this.build();
		} else {
			dom.listen(window, this._key+'.load', this.build.bind(this));
		}
	},

	/**
	 *
	 */
	build: function()
	{
		if (!Data.has(this._key)) {
			step(false);
			return;
		}
		if (loadingEl) {
			dom.destroy(loadingEl);
		}

		var coverflow = new cf.Coverflow(this, {itemCount: 5,context: 'newAlbums'});
		dom.inject(coverflow.node, dom.id('NewAlbums'));
		if(dom.id('Banners') != null) {
			dom.id('Banners').classList.remove('hidden');
		}
		step(true);
	},

	/**
	 *
	 */
	count: function()
	{
		return Data.get(this._key).length;
	},

	/**
	 *
	 */
	makeNode: function(index)
	{
		var data = Data.get(this._key)[index],
			li = new dom.Element('li'),
			badge = new dom.Element('div', {className: 'badge', textContent: (data.isRecommended ? 'Recommended' : 'Top list')}),
			md = new dom.Element('div', {className: 'metadata'}),
			album = new dom.Element('a', {className: 'album', href: data.uri, html: data.name}),
			artist = new dom.Element('a', {className: 'artist', href: data.artist.uri, html: data.artist.name});


		logger.logClick(album,'newAlbums album link');
		logger.logClick(artist,'newAlbums artist link');

		m.Album.fromURI(data.uri, function(context) {
			var player = new v.Player();
			player.context = context;
			var playerbutton = player.node.querySelector("button");
			var oldchild = player.node.removeChild(playerbutton);
			dom.adopt(md, oldchild, album, document.createElement("br"), artist);
			dom.adopt(player.node, badge, md);
			dom.adopt(li, player.node);
			dom.listen(dom.queryOne('.sp-image', li),'click',function(evt){
				logger.logClientEvent('newAlbums cover','click','1','1',{'uri':evt.target.href});
			});
			dom.listen(dom.queryOne('.sp-player-button', li),'click',function(evt){
				logger.logClientEvent('newAlbums play button','click','1','1',{'uri':data.uri});
			});
		});

		return li;
	}
};



/**
 *
 */
var FriendsPlaylists = {

	_key: 'FriendsPlaylists',
	_loaded: false,
	_loadEvent: null,

	/**
	 *
	 */
	init: function(data)
	{
		this._loadEvent = new dom.Event(this._key+'.load', true);

		if (!data || !data.playlists) {
			this._loaded = true;
			this._loadEvent.dispatch(window);
			return;
		}

		this.extend(data.playlists);
	},

	/**
	 *
	 */
	extend: function(data)
	{
		var final = [];
		for (var i = 0; i < data.length; i++) {
			if (data[i].name) {
				final.push(data[i]);
			}
		}

		array.shuffle(final);

		Data.set(this._key, final);
		this._loaded = true;
		this._loadEvent.dispatch(window);
	},

	/**
	 *
	 */
	next: function()
	{
		if (this._loaded) {
			this.build();
		} else {
			dom.listen(window, this._key+'.load', this.build.bind(this));
		}
	},

	/**
	 *
	 */
	build: function()
	{
		if (!Data.has(this._key)) {
			step(false);
			return;
		}
		if (loadingEl) {
			dom.destroy(loadingEl);
		}

		buildPlaylistPager(this._key, Data.get(this._key), playlistWrappers.shift(), function() {
			step(true);
		});
	}
};



/**
 *
 */
var FriendsTracks = {

	_key: 'FriendsTracks',
	_loaded: false,
	_loadEvent: null,

	/**
	 *
	 */
	init: function(data)
	{
		this. _loadEvent = new dom.Event(this._key+'.load', true);

		if (!data || !data.tracks) {
			this._loaded = true;
			this._loadEvent.dispatch(window);
			return;
		}

		this.extend(data.tracks);
	},

	/**
	 *
	 */
	extend: function(data)
	{
		var self = this;
		sp.core.getMetadata(map(function(track) { return track.uri; }, data), {
			onSuccess: function(metadata) {
				for (var i = 0; i < data.length; i++) {
					data[i].metadata = metadata[i];
				}
				array.shuffle(data);

				Data.set(self._key, data);
				self._loaded = true;
				self._loadEvent.dispatch(window);
			},
			onFailure: function() {
				self._loaded = true;
				self._loadEvent.dispatch(window);
			}
		});
	},

	/**
	 *
	 */
	next: function()
	{
		if (this._loaded) {
			this.build();
		} else {
			dom.listen(window, this._key+'.load', this.build.bind(this));
		}
	},

	/**
	 *
	 */
	build: function()
	{
		if (!Data.has(this._key)) {
			step(false);
			return;
		}
		if (loadingEl) {
			dom.destroy(loadingEl);
		}

		buildTracksTable(this._key, Data.get(this._key), trackWrappers.shift(), function() {
			step(true);
		});
	}
};



/**
 *
 */
var NewFriends = {

	_key: 'NewFriends',
	_loaded: false,
	_loadEvent: null,

	/**
	 *
	 */
	init: function(data)
	{
		this._loadEvent = new dom.Event(this._key+'.load', true);

		if (!data || !data.friends) {
			if (!data) {
				data = {};
			}
			data.friends = [];
		}

		this.extend(data.friends);
	},

	/**
	 *
	 */
	extend: function(data)
	{
		var existingUserNames = [];
		var filteredData = [];
		data.forEach(function(username,index) {
			var userExists = false;
			for (var i=0;i<existingUserNames.length;i++) {
				if (existingUserNames[i] == username) {
					userExists = true;
				}
			}
			if (!userExists) {
				existingUserNames.push(username);
				filteredData.push(username);
			}
		});

		this._data = filteredData;
		array.shuffle(filteredData);
		Data.set(this._key, filteredData);
		this._loaded = true;
		this._loadEvent.dispatch(window);
	},

	/**
	 *
	 */
	next: function()
	{
		if (this._loaded) {
			this.build();
		} else {
			dom.listen(window, this._key+'.load', this.build.bind(this));
		}
	},

	/**
	 *
	 */
	build: function()
	{
		if (!Data.has(this._key) || !this._data.length) {
			step(false);
			return;
		}
		if (loadingEl) {
			dom.destroy(loadingEl);
		}

		var self = this;

		var wrapper = dom.id(this._key),
			allFriends = Data.get(this._key),
			data = [],
			friendsAvailable = allFriends.length,
			friendsLoaded = 0;

		if (!wrapper || !allFriends) {
			return;
		}

		var _friendsLoadEvent = new dom.Event('newfriendsdata.load', true);

		//When all friends are loaded, build:
		dom.listen(window,'newfriendsdata.load',function(evt) {
			if(!data || data.length < 1) {
                step(false);
                return;
            }

			var perPage = 4;

			//Finally, shuffle the people
			array.shuffle(data);

			switch (currentLayout) {
				case 1: perPage = 4; break;
				case 2: perPage = 3; break;
				case 3: perPage = 2; break;
			}

			var newFriendsDS = new newFriendsDataSource(data);
			newFriendsDS.subscribeToPresence();

			var pager = new p.Pager(newFriendsDS, {
				perPage: perPage,
				hidePartials: false,
				orientation: 'horizontal',
				pagingLocation: 'top',
				bullets: false,
				context: 'newFriends'
			});
			if (loadingEl) {
				dom.destroy(loadingEl);
			}
			pager.h2.innerHTML = headings[self._key];
			dom.adopt(wrapper, pager.node);

			step(true);

			dom.listen(window, 'layout.switch', function() {
				var perPage = null
				switch (currentLayout) {
					case 1: perPage = 4; break;
					case 2: perPage = 3; break;
					case 3: perPage = 2; break;
				}
				if (perPage) {
					pager.setOptions({perPage: perPage});
					pager.reflow();
				}
			});
		});

		//Loop through allFriends and only get those with a facebook UID
		if(allFriends.length > 0) {
			allFriends.forEach(function(friend) {
				sp.social.getUserByUsername(friend, {
					onSuccess: function(user) {
						if (user.facebookUid) {
							friendsLoaded++;
							data.push(user);
						}
						else {
							friendsAvailable--;
						}
						if(friendsAvailable == friendsLoaded) {
							_friendsLoadEvent.dispatch(window);
						}
					},
					onFailure:function(){
						friendsAvailable--;
						if(friendsAvailable == friendsLoaded) {
							_friendsLoadEvent.dispatch(window);
						}
					}
				});
			});
		}
		else {
			//Go straight to padding
			_friendsLoadEvent.dispatch(window);
		}
	}
};



/**
 *
 */
var NewReleases = {

	_key: 'NewReleases',
	_loaded: false,
	_loadEvent: null,

	/**
	 *
	 */
	init: function()
	{
		this._loadEvent = new dom.Event(this._key+'.load', true);

		var self = this, artists = [], albums = [];

		var useCache = setTimeout(function() {
			triggerFailure('Search');
		}, 2000);

		sp.core.search('tag:new', {
			onSuccess: function (result) {
				clearTimeout(useCache);
				// Make sure artists are unique
				result.albums.forEach(function(album) {
					if (album.artist.name !== "Various Artists" && artists.indexOf(album.artist.name) === -1) {
						artists.push(album.artist.name);
						albums.push(album);
					}
				});
				array.shuffle(albums);

				Data.set(self._key, albums);
				self._loaded = true;
				self._loadEvent.dispatch(window);
			},
			onFailure: function() {
				triggerFailure('Search');
				self._loaded = true;
				self._loadEvent.dispatch(window);
				// step(false);
			}
		});
	},

	/**
	 *
	 */
	next: function()
	{
		if (this._loaded) {
			this.build();
		} else {
			dom.listen(window, this._key+'.load', this.build.bind(this));
		}
	},

	/**
	 *
	 */
	build: function()
	{
		if (!Data.has(this._key)) {
			step(false);
			return;
		}
		if (loadingEl) {
			dom.destroy(loadingEl);
		}

		var wrapper = dom.id(this._key), perPage = 10;

		switch (currentLayout) {
			case 1: perPage = 10; break;
			case 2: perPage = 8; break;
			case 3: perPage = 6; break;
		}

		var pager = new p.Pager(new newReleasesDataSource(), {
			perPage: perPage,
			hidePartials: true,
			pagingLocation: 'top',
			bullets: false,
			context:'newReleases'
		});
		pager.h2.innerHTML = headings[this._key];

		dom.adopt(wrapper, pager.node);

		dom.listen(window, 'layout.switch', function() {
			var perPage = null;
			switch (currentLayout) {
				case 1: perPage = 10; break;
				case 2: perPage = 8; break;
				case 3: perPage = 6; break;
			}
			if (perPage) {
				pager.setOptions({perPage: perPage});
				pager.reflow();
			}
		});

		step(true);
	}
};



/**
 *
 */
var RegionPlaylists = {

	_key: 'RegionPlaylists',
	_loaded: false,
	_loadEvent: null,

	/**
	 *
	 */
	init: function(data)
	{
		this._loadEvent = new dom.Event(this._key+'.load', true);

		if (!data || !data.playlists) {
			this._loaded = true;
			this._loadEvent.dispatch(window);
			return;
		}

		this.extend(data.playlists);
	},

	/**
	 *
	 */
	extend: function(data)
	{
		var final = [];
		for (var i = 0; i < data.length; i++) {
			if (data[i].name) {
				final.push(data[i]);
			}
		}
		array.shuffle(final);
		Data.set('RegionPlaylists', final);
		this._loaded = true;
		this._loadEvent.dispatch(window);
	},

	/**
	 *
	 */
	next: function()
	{
		if (this._loaded) {
			this.build();
		} else {
			dom.listen(window, this._key+'.load', this.build.bind(this));
		}
	},

	/**
	 *
	 */
	build: function()
	{
		if (!Data.has(this._key)) {
			step(false);
			return;
		}
		if (loadingEl) {
			dom.destroy(loadingEl);
		}

		buildPlaylistPager(this._key, Data.get(this._key), playlistWrappers.shift(), function() {
			step(true);
		});
	}
};



/**
 *
 */
var RegionTracks = {

	_key: 'RegionTracks',
	_loaded: false,
	_loadEvent: null,

	/**
	 *
	 */
	init: function(data)
	{
		this._loadEvent = new dom.Event(this._key+'.load', true);

		if (!data || !data.tracks) {
			this._loaded = true;
			this._loadEvent.dispatch(window);
			return;
		}

		this.extend(data.tracks);
	},

	/**
	 *
	 */
	extend: function(data)
	{
		var self = this;
		sp.core.getMetadata(map(function(track) { return track.uri; }, data), {
			onSuccess: function(metadata) {
				for (var i = 0; i < data.length; i++) {
					data[i].metadata = metadata[i];
				}
				array.shuffle(data);
				Data.set('RegionTracks', data);
				self._loaded = true;
				self._loadEvent.dispatch(window);
			},
			onFailure: function() {
				self._loaded = true;
				self._loadEvent.dispatch(window);
			}
		});
	},

	/**
	 *
	 */
	next: function()
	{
		if (this._loaded) {
			this.build();
		} else {
			dom.listen(window, this._key+'.load', this.build.bind(this));
		}
	},

	/**
	 *
	 */
	build: function()
	{
		if (!Data.has(this._key)) {
			step(false);
			return;
		}
		if (loadingEl) {
			dom.destroy(loadingEl);
		}

		buildTracksTable(this._key, Data.get(this._key), trackWrappers.shift(), function() {
			step(true);
		});
	}
};



/**
 *
 */
var CountryPlaylists = {

	_key: 'CountryPlaylists',
	_loaded: false,
	_loadEvent: null,

	/**
	 *
	 */
	init: function(data)
	{
		this._loaded = true;

		/*
		this._loadEvent = new dom.Event(this._key+'.load', true);

		if (!data || !data.playlists) {
			this._loaded = true;
			this._loadEvent.dispatch(window);
			return;
		}

		this.extend(data.playlists);
		*/
	},

	/**
	 *
	 */
	extend: function(data)
	{
		/*
		var final = [];
		for (var i = 0; i < data.length; i++) {
			if (data[i].name) {
				final.push(data[i]);
			}
		}

		Data.set('RegionPlaylists', final);
		this._loaded = true;
		this._loadEvent.dispatch(window);
		*/
	},

	/**
	 *
	 */
	next: function()
	{
		if (this._loaded) {
			this.build();
			// if (Data.has(this._key)) {
			// } else {
			// }
		} else {
			step(false);
			//dom.listen(window, this._key+'.load', this.build.bind(this));
		}
	},

	/**
	 *
	 */
	build: function()
	{
		if (!Data.has(this._key)) {
			step(false);
			return;
		}
		if (loadingEl) {
			dom.destroy(loadingEl);
		}

		/*
		This element is currently empty because of missing Discovery data
		We're manually adding the key as a class to the wrapper so we can adjust the margin
		*/
		if(playlistWrappers.length > 0) {
			playlistWrappers[0].classList.add('CountryPlaylists')
		}
		//playlistWrappers.shift().classList.add('CountryPlaylists');
		//dom.id(playlistWrappers.shift())
		step(true);
		/*
		buildPlaylistPager(this._key, Data.get(this._key), playlistWrappers.shift(), function() {
			step(true);
		});
		*/
	}
};



/**
 *
 */
var CountryTracks = {

	_key: 'CountryTracks',
	_loaded: false,
	_loadEvent: null,

	/**
	 *
	 */
	init: function()
	{
		var self = this;
		this._loadEvent = new dom.Event(this._key+'.load', true);

		var useCache = setTimeout(function() {
			triggerFailure('Country');
		}, 2000);

		sp.social.getToplist("track", sp.core.country, sp.core.user.canonicalUsername, {
			onSuccess: function(result) {
				clearTimeout(useCache);

				if(result.tracks && result.tracks.length) {
					array.shuffle(result.tracks);
					Data.set(self._key, result.tracks);
					self._loaded = true;
					self._loadEvent.dispatch(window);
				}
				else {
					self._loaded = true;
					self._loadEvent.dispatch(window);
				}
			},
			onFailure: function() {
				self._loaded = true;
				self._loadEvent.dispatch(window);
				triggerFailure('Country');
			}
		});
	},

	/**
	 *
	 */
	next: function()
	{
		if (this._loaded) {
			this.build();
		} else {
			dom.listen(window, this._key+'.load', this.build.bind(this));
		}
	},

	/**
	 *
	 */
	build: function()
	{
		if (!Data.has(this._key)) {
			step(false);
			return;
		}
		if (loadingEl) {
			dom.destroy(loadingEl);
		}

		var d = Data.get(this._key);
		d.forEach(function(track,index){
			track.metadata = track;
		})

		buildTracksTable(this._key, d, trackWrappers.shift(), function() {
			step(true);
		});
	}
};



/**
 *
 */
var Ads = {

	_loaded: false,
	_loadEvent: null,
	ad: null,
	partner: null,

	/**
	 *
	 */
	init: function()
	{
		var self = this;
		self._loadEvent = new dom.Event('ads.load', true);

		var partner = sp.whatsnew.getPartner();
		if (partner && partner === 'telia') {
			this.partner = partner;
		}

		sp.whatsnew.fetchAd({
			onSuccess: function(ad)
			{
				self.ad = ad;

				// Let things know we're done loading
				self._loaded = true;
				self._loadEvent.dispatch(window);
			},
			onFailure: function(errorCode) {
				self._loaded = true;
				self._loadEvent.dispatch(window);
			}
		});
	},

	/**
	 *
	 */
	isLoaded: function()
	{
		return this._loaded;
	},

	/**
	 *
	 */
	hasMPU: function()
	{
		if (this.ad) {
			if (!this.ad.bg) {
				return true;
			}
			return false;
		}

		if (this.partner) {
			return true;
		}
	},

	/**
	 *
	 */
	next: function()
	{
		if (this._loaded) {
			this.build();
		} else {
			dom.listen(window, 'ads.load', this.build.bind(this));
		}
	},

	/**
	 *
	 */
	build: function()
	{
		var hasAd = false;
		// Ad
		if (this.ad) {
			// A background at least means it's shown at the top
			if (this.ad.bg) {
				hasAd = true;
				if (this.ad.bg.target && this.ad.bg.target !== '') {
					var bg = new dom.Element('a', {href: this.ad.bg.target.decodeForLink()});
					var target = this.ad.bg.target.decodeForText();
					dom.listen(bg,'click',function(evt){
						evt.preventDefault();
						sp.whatsnew.reportAdClicked();
						window.open(target);
					});
				} else {
					var bg = new dom.Element('div');
				}
				bg.style.backgroundImage = 'url('+this.ad.bg.image_uri+')';
				bg.style.backgroundColor = this.ad.bg.bgcolor;
				bg.className = 'ad-bg';
				dom.adopt(document.body, bg);
				document.body.classList.add('has-ad-bg');
			}

			if (this.ad.mpu && (this.ad.mpu.html || this.ad.mpu.image)) {
				hasAd = true;
				var mpuWrapper = new dom.Element('div');
				var frameWrapper = new dom.Element('div',{className:'adWrapper'});

				if (this.ad.mpu.html) {
					var frame = new dom.Element('iframe');
					frame.src = "http://ad-data.spotify.com/" + btoa(this.ad.mpu.html.decodeForText());
					frame.scrolling = "no";
					dom.inject(frame, frameWrapper);
				}

				else if (this.ad.mpu.image) {
					if (this.ad.mpu.image.target && this.ad.mpu.image.target !== '') {
						var imgHolder = new dom.Element('a', {href: this.ad.mpu.image.target.decodeForLink()});
						var target = this.ad.mpu.image.target.decodeForText();
						dom.listen(imgHolder,'click',function(evt){
							evt.preventDefault();
							sp.whatsnew.reportAdClicked();
							window.open(target);
						});

					} else {
						var imgHolder = new dom.Element('div');
					}
					var frameWrapper = new dom.Element('div',{className:'adWrapper'});
					var img = new Image();
					img.src = this.ad.mpu.image.image_uri;
					dom.inject(img, imgHolder);
					dom.inject(imgHolder, frameWrapper);
				}
				dom.inject(frameWrapper, mpuWrapper);

				if (bg) {
					mpuWrapper.className = 'topWrapper';
					dom.inject(mpuWrapper, dom.id('wrapper'), 'top');
					document.body.classList.add('has-ad-top');
				} else {
					mpuWrapper.className = 'mpuWrapper';
					dom.inject(mpuWrapper, trackWrappers.shift());
					document.body.classList.add('has-ad-mpu');
				}
			}

			if (hasAd) {
				sp.whatsnew.reportAdStarted();

				sp.core.addEventListener('activate',function(){
					sp.whatsnew.reportAdStarted();
				});

				sp.core.addEventListener('deactivate',function(){
					sp.whatsnew.reportAdStopped();
				});
			}
		}

		// Partner
		else if (this.partner) {
			hasAd = true;
			var mpuWrapper = new dom.Element('div', {className: 'mpuWrapper'}),
				imgHolder = new dom.Element('div'),
				link = new dom.Element('a', {href: 'http://www.telia.se/spotify'}),
				img = new Image();
			img.src = '/img/telia.png';
			dom.inject(img, link);
			dom.inject(link, imgHolder);
			dom.inject(imgHolder, mpuWrapper);
			dom.inject(mpuWrapper, trackWrappers.shift());
		}

		if (hasAd) {
			new dom.Event('ads.build', true).dispatch(window);
		}
	}
};





/**
 *
 */
var Banners = {

	wrapper: null,
	bannerCount: 0,

	init: function()
	{
		var self = this;
		self.wrapper = dom.id('Banners');
		self.bannerCount = 0;
		var availableBanners = ['finder','radio'];
		var bannersClosed = storage.getWithDefault('bannersClosed',{});
		availableBanners.forEach(function(b,index) {
			if (bannersClosed[b] == null) {
				var a = new dom.Element('a',{className:'image',href:'spotify:app:'+b,text:b})
				var banner = new dom.Element('div',{
					className:'banner',
					id:b+'-push'
				});
				dom.adopt(banner,a);
				var bannerClose = new dom.Element('button',{innerText:'Close'});
				dom.listen(bannerClose,'click',function(evt){
					bannersClosed[b] = true;
					dom.destroy(banner);
					storage.set('bannersClosed',bannersClosed);
					self.bannerCount--;
					self.updateWrapper();
				},false);
				dom.adopt(banner,bannerClose);
				dom.adopt(self.wrapper,banner);
				self.bannerCount++;
			}
		});
		self.updateWrapper();
	},

	updateWrapper:function(){
		var self = this;
		if (self.bannerCount < 1) {
			dom.destroy(self.wrapper);
		}
		else if (self.bannerCount < 2) {
			self.wrapper.classList.add('single');
		}
	}
}








function newToplistPlaylistsDataSource(data,showFriends,context)
{
	var data = data, showFriends = showFriends || false, context = context || '';

	this.count = function()
	{
		return data.length;
	};

	this.makeNode = function(index)
	{
		var d = data[index], li = new dom.Element('li');

		var uri = d.uri,
		name = d.name,
		creator = d.uri.split(':')[2],
		creator = d.creator ? d.creator : creator,
		creatorUri = 'spotify:user:'+d.uri.split(':')[2];

		var nameColumn = new dom.Element('div',{
			className:'nameColumn',
			html:'<div class="nameColumn"><a href="'+uri+'" class="name">'+name+'</a> '+_('sBy')+' <a href="'+creatorUri+'" class="creator">'+creator+'</a>'
		});

		logger.logClick(dom.queryOne('.name',nameColumn),context+' playlist link',{'uri':uri});
		logger.logClick(dom.queryOne('.creator',nameColumn),context+' playlist creator link',{'uri':creatorUri});

		dom.adopt(li, nameColumn);
		if (showFriends) {
			var friendsColumn = new dom.Element('div', {className: 'friendsColumn'});
			if (d.friends && d.friends.length > 0) {
			d.friends.forEach(function(f) {
				sp.social.getUserByUsername(f, {
					onSuccess: function(fd) {
						if (fd.facebookUid) {
							var friendImage = new ui.SPImage('https://graph.facebook.com/'+fd.facebookUid+'/picture', 'spotify:user:'+fd.canonicalUsername, fd.name);
							dom.adopt(friendsColumn, friendImage.node);
							logger.logClick(friendImage.node,context+' friend picture',{'uri':creatorUri});
						}
					}
				});
			});
			}
			dom.adopt(li,friendsColumn);
		}
		return li;
	};
}

function newFriendsDataSource(data)
{
	var data = data;

	this.count = function()
	{
		return data.length;
	};

	this.makeNode = function(index)
	{
		var d = data[index], li = new dom.Element('li');

		if(d.facebookUid != null) {
			var picture = 'https://graph.facebook.com/'+d.facebookUid+'/picture';
		}

		li.innerHTML = '<a href="spotify:user:'+d.canonicalUsername+'" class="image" '
			+'style="background-image: url('+picture+')"></a>'
			+'<span class="text"><a href="spotify:user:'+d.canonicalUsername+'" class="user">'+d.name+'</a>'
			+'<span class="presence"></span></span>';

		presence.observePresence(d, function(user, presenceString){
			dom.queryOne('.presence', li).innerHTML = presenceString;
		});

		logger.logClick(dom.queryOne('a.image', li),'newFriends picture');
		logger.logClick(dom.queryOne('a.user', li),'newFriends link');

		return li;
	};

	this.subscribeToPresence = function()
	{
		presence.subscribeToPresence(data);
		return data;
	};
}

function newReleasesDataSource()
{
	var data = Data.get('NewReleases');

	this.count = function()
	{
		return data.length;
	};

	this.makeNode = function(index)
	{
		var d = data[index], li = new dom.Element('li');

		var albumLink = new dom.Element('a', {className: 'name', href: d.uri, text: d.name.decodeForText()});
		var artistLink = new dom.Element('a', {className: 'artist', href: d.artist.uri, text: d.artist.name.decodeForText()});
		logger.logClick(albumLink,'newReleases album link');
		logger.logClick(artistLink,'newReleases artist link');
		var album = m.Album.fromURI(d.uri, function(a) {
			var albumPlayer = new v.Player();
			albumPlayer.track = a.get(0);
			albumPlayer.context = a;
			logger.logClick(dom.queryOne('.sp-image',albumPlayer.node),'newReleases album cover');
			logger.logClick(dom.queryOne('.sp-player-button',albumPlayer.node),'newReleases play button',{'uri':d.uri});
			dom.inject(albumPlayer.node, li, 'top')
		});
		dom.adopt(li, albumLink, artistLink);
		return li;
	};
}

/**
 *
 */
function buildPlaylistPager(key, data, wrapper, callback) {
	var callback = callback || function() {};

	if (!data || !wrapper) { return; }

	var showFriends = data[0].friends ? true : false;

	var ds = new newToplistPlaylistsDataSource(data,showFriends,key)
	var pager = new p.Pager(ds, {
		perPage: 5,
		hidePartials: true,
		orientation: 'vertical',
		pagingLocation: 'top',
		bullets: false,
		listType: 'list',
		context: key
	});


	pager.h2.innerHTML = headings[key];
	var border = new dom.Element('div',{className:'border'});
	dom.adopt(pager.node,border);
	dom.adopt(wrapper,pager.node)

	callback.call()

	return pager;
}

function buildTracksTable(key, data, wrapper, callback) {
	var callback = callback || function() {};

	if (!data || !wrapper) { return; }

	data = data.slice(0, 8);

	var tempPlaylist = new m.Playlist();
	data.forEach(function(d){
		var t = new m.Track(d);
		tempPlaylist.add(t);
	})
	var tracksList = new v.List(tempPlaylist, function(track) {
	    return new v.Track(track, v.Track.FIELD.STAR | v.Track.FIELD.NAME | v.Track.FIELD.ARTIST);
	});
	tracksList._itemHeight = 25;
	tracksList.node.classList.add('sp-light');

	var h2 = new dom.Element('h2',{html:headings[key]});
	var tableHeading = new dom.Element('div',{
		className:'window',
		html:'<table><tr class="heading"><th class="headingStarred">'
			+'</th><th class="headingTitle">'+_('sTitle')+'</th>'
			+'<th class="headingArtist">'+_('sArtist')+'</th></tr></table>'});


	dom.listen(tracksList.node,'click',function(evt) {
		evt.preventDefault();
		if(evt.target.tagName === 'A' && evt.target.parentNode.classList.contains('sp-track-field-artist')) {
			logger.logClientEvent(key+' track artist','click','1','1',{'uri':evt.target.href});
			window.location = evt.target.href;
		}
		else if(evt.target.tagName === 'SPAN' && evt.target.classList.contains('sp-icon-star')) {
			logger.logClientEvent(key+' star','click','1','1',{'uri':evt.target.parentNode.parentNode.href});
		}
	});

	dom.listen(tracksList.node,'dblclick',function(evt) {
		if(evt.target.tagName === 'SPAN' && evt.target.classList.contains('sp-track-field-name')) {
			logger.logClientEvent(key+' track','doubleclick','1','1',{'uri':evt.target.parentNode.href});
		}
	});

	dom.adopt(tableHeading,tracksList.node)
	dom.adopt(wrapper, h2,tableHeading);
	wrapper.classList.add(key)
	callback.call();
}

function clone(obj) {
	if(null == obj || 'object' != typeof obj) {
		return obj;
	}
	else if(obj instanceof Array) {
		var copy = [];
		for(var i = 0; i < obj.length; i++) {
			copy[i] = clone(obj[i]);
		}
		return copy;
	}
	else if(obj instanceof Object) {
		var copy = {};
		for(var attr in obj) {
			if(obj.hasOwnProperty(attr)) {
				copy[attr] = clone(obj[attr]);
			}
		}
		return copy;
	}
	else {
		console.log('Unable to clone object of type',typeof obj);
		return obj;
	}
}
