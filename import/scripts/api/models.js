/**
 * @module models
 * @property {Social}  social   See {@link Social}
 * @property {Library} library  See {@link Library}
 * @property {Player}  player   See {@link Player}
 */

"use strict";

sp = getSpotifyApi(1);

// Interfaces
exports.Collection = Collection;
exports.Observable = Observable;

// Constructors
exports.Album    = Album;
exports.Artist   = Artist;
exports.Link     = Link;
exports.Playlist = Playlist;
exports.Search   = Search;
exports.Track    = Track;
exports.User     = User;

// Functions
exports.search  = search;

// Properties
exports.AVAILABILITY = null;
exports.EVENT = null;

/** @typedef {(Array.<Track>)} */
var Tracks;

var _session = null;
var _player  = null;
var _library = null;
var _social  = null;

Object.defineProperties(exports, {
    library: {
        get: function() {
            if (!_library) _library = new Library();
            return _library;
        }
    },
    player: {
        get: function() {
            if (!_player) _player = new Player();
            return _player;
        }
    },
    session: {
        get: function() {
            if (!_session) _session = new Session();
            return _session;
        }
    },
    social: {
        get: function() {
            if (!_social) _social = new Social();
            return _social;
        }
    }
});

var l    = sp.require("sp://import/scripts/language");
var md   = sp.require("sp://import/scripts/metadata");

var cat = l.loadCatalog("cef_views");
var _   = partial(l.getString, cat, "Misc");

/**
 * @ignore
 * @enum {number}
 */
var AVAILABILITY = exports.AVAILABILITY = {
    AVAILABLE:             0,  // Resource available
    NOT_IN_REGION:         1,  // Resource cannot be played in user's current region
    NOT_AVAILABLE:         2,  // All other "not available" states
    PREMIUM:               3,  // Available in premium
    BANNED:                4,  // The artist chose to make it not available
    LOCAL_NO_FILE:         5,  // Track is unavailable because it cannot be found on disk
    LOCAL_FILE_NOT_FOUND:  6,  // Track is unavailable because it cannot be found on disk
    LOCAL_FILE_BAD_FORMAT: 7,  // Track is unavailable because it has the wrong encoding
    PURCHASE:              8,  // Available if you purchase.
    NO_STREAM:             9,  // This is a non-local track, and you're not allowed to stream from Spotify.
    CAP_REACHED:           10, // Capping is reached
    DRM_PROTECTED:         11, // The local file was parsed but is DRM protected (and cannot be played)
    TRACK_CAP_REACHED:     13  // Track has been played too many times for track capped accounts
};

/**
 * @ignore
 * @enum {number}
 */
var EVENT = exports.EVENT = {
    LOAD:          1 << 0,
    UNLOAD:        1 << 1,
    CHANGE:        1 << 2,
    ITEMS_ADDED:   1 << 3,
    ITEMS_REMOVED: 1 << 4,
    ITEMS_MOVED:   1 << 5,
    RENAME:        1 << 6
};

// Map to C++ event names.
var _EVENT = {};
_EVENT[EVENT.LOAD]          = "load";
_EVENT[EVENT.UNLOAD]        = "unload";
_EVENT[EVENT.CHANGE]        = "change";
_EVENT[EVENT.ITEMS_ADDED]   = "itemsAdded";
_EVENT[EVENT.ITEMS_REMOVED] = "itemsRemoved";
_EVENT[EVENT.ITEMS_MOVED]   = "itemsMoved";
_EVENT[EVENT.RENAME]        = "rename";

// Interfaces

/**
 * Collection interface.
 *
 * @interface
 * @constructor
 * @property {*}      data
 * @property {number} length
 */
function Collection() {
    this.data = [];
}

/**
 * Add an item to the Collection.
 *
 * @param {*} item Item which is to be added to the collection.
 * @return {number}
 */
Collection.prototype.add = function(item) {
    return this.data.push(item);
};

/**
 * Remove an item from the Collection.
 *
 * @param {*} item  Item which is to be removed from the collection.
 * @return {*}
 */
Collection.prototype.remove = function(item) {
    var index = this.data.indexOf(item);
    if (-1 === index) {
        return null
    }
    return this.data.splice(index, 1);
};

/**
 * @throws {RangeError}   If index is out of range.
 * @param {number} index  Index of item to get.
 * @return {*}
 */
Collection.prototype.get = function(index) {
    if (index >= this.length) {
        throw new RangeError("Index out of range");
    }
    return this.data[index];
};

/**
 * Get the items from start to start + length. It is inclusive.
 *
 * @param {number} start   Index of first item to get.
 * @param {number} length  Number of items to get.
 * @return {Array}
 */
Collection.prototype.getRange = function(start, length) {
    var end = (start + length >= this.length ? this.length : start + length) - 1;
    var range = new Array(end - start);
    for (var i = 0, j = start; j <= end; ++i, ++j) {
        range[i] = this.get(i);
    }
    return range;
};

/**
 * Get the index of an item, or -1 if not found.
 *
 * @param {*} item  The item to look for.
 * @return {number}
 */
Collection.prototype.indexOf = function(item) {
    return this.data.indexOf(item);
};

Collection.prototype.clear = function() {
    this.data.length = 0;
};

Object.defineProperty(Collection.prototype, "length", {
    get: function() {
        return this.data.length;
    }
});

/**
 * Observable interface.
 *
 * @interface
 * @constructor
 * @property {Object} observers
 */
function Observable() {
    this.observers = {};
}

/**
 * Register an observer.
 *
 * @param {*}        event     The event name.
 * @param {function} observer  The observer function.
 */
Observable.prototype.observe = function(event, observer) {
    if (!this.observers[event])
        this.observers[event] = [];
    this.observers[event].push(observer);
    return this;
};

/**
 * Remove observer(s).
 * If the observer parameter is not provided, all observers for the given event will be removed.
 *
 * @param {*}         event     The event name.
 * @param {function=} observer  The observer function.
 */
Observable.prototype.ignore = function(event, observer) {
    var index = -1;
    // Remove all observers
    if (1 === arguments.length) {
        delete this.observers[event];
        return this;
    }
    // Remove one observer
    if (this.observers[event]) {
        index = this.observers[event].indexOf(observer);
        if (-1 !== index)
            this.observers[event][index] = null; // Can't splice it out, that messes up notify()
    }
    return this;
};

/**
 * @param {*} event
 * @param {*} data
 */
Observable.prototype.notify = function(event, data) {
    var observers = this.observers[event];
    if (!observers) return this;
    for (var i = 0; i < observers.length; ++i) {
        if (null !== observers[i])
            observers[i](data);
    }
    for (var i = 0; i < observers.length; ++i) {
        if (null === observers[i])
            observers.splice(i, 1);
    }
    if (0 === observers.length)
        delete this.observers[event];
    return this;
};

// Constructors

/**
 * An object which represents a link to a Spotify resource.
 *
 * @param {string} uri The URI.
 * @throws {Error} If the URI is invalid.
 * @property {number} type  The Link type.
 * @property {string} uri   The URI of the Link.
 * @constructor
 */
function Link(uri) {
    var linkType = Link.getType(uri.toString());
    if (Link.TYPE.EMPTY === linkType) {
        throw new Error(l.format("Invalid URI: {0}", uri));
    }
    this.type = linkType;
    this.uri  = uri;
}

/** @return {string} URI as string */
Link.prototype.toString = function() {
    return this.uri;
};

/** @return {string} URI as string */
Link.prototype.valueOf = function() {
    return this.uri;
};

/** @return {string} HTTP URL as string */
Link.prototype.toURL = function() {
    return sp.core.spotifyUriToHttpLink(this.uri);
};

/**
 * Create a Link from an HTTP URL.
 *
 * @param {string} url  The HTTP URL.
 * @return {Link}
 */
Link.fromURL = function(url) {
    return new Link(sp.core.spotifyHttpLinkToUri(url));
};

/**
 * Get the link type from a string.
 *
 * @param {string} uri  The link type, which is a value from the {@link Link.TYPE} enum.
 * @return {Link.TYPE}
 */
Link.getType = function(uri) {
    return sp.core.getLinkType(uri);
};

/**
 * @enum {number}
 */
Link.TYPE = {
    /** @desc A link that has not yet been initialized */
    EMPTY           : 0,
    /** @desc A link to an artist */
    ARTIST          : 1,
    /** @desc A link to an album */
    ALBUM           : 2,
    /** @desc A link to a search result */
    SEARCH          : 3,
    /** @desc A link to a track */
    TRACK           : 4,
    /** @desc A link to a playlist */
    PLAYLIST        : 5,
    /** @desc A link that contains nothing that just brings spotify to the front */
    ACTIVATE        : 6,
    /** @desc A link to an internal view */
    INTERNAL_VIEW   : 7,
    /** @desc A link in the spotify:internal: namespace */
    INTERNAL        : 8,
    /** @desc A link to a local track */
    LOCAL_TRACK     : 9,
    /** @desc A link to a profile page */
    PROFILE         : 10,
    /** @desc A link to a user's starred list */
    STARRED         : 11,
    /** @desc A link to a specific ad */
    AD              : 12,
    /** @desc A link to a user's toptracks list */
    TOPLIST         : 13,
    /** @desc A link to recently played */
    RECENTLY_PLAYED : 14,
    /** @desc A link to the radio view */
    RADIO           : 15,
    /** @desc A link to an image */
    IMAGE           : 16,
    /** @desc A link to a partner page */
    PARTNER         : 17,
    /** @desc A link to a list of tracks */
    TRACK_SET       : 18,
    /** @desc A link that is opened when spotify is autostarted */
    AUTOSTART       : 19,
    /** @desc A link that delays login view (also offline login) */
    LOGIN_DELAY     : 20,
    /** @desc A link to an application */
    APPLICATION     : 21,
    /** @desc A link to a Facebook user */
    FACEBOOK_USER   : 22
};

/**
 * Construct an Album from an Object.
 * You should rarely need to use this directly, instead the fromURI static method should be used.
 *
 * Implements {@link Collection}.
 *
 * @implements {Collection}
 * @param {Object}             data       The data object used to construct the Album.
 * @property {Artist|null}     artist     The Artist of the Album.
 * @property {boolean|null}    playable   Indicates whether the Album is available for playback or not.
 * @property {string|null}     cover      URI for the cover art of the Album.
 * @property {number|null}     length     The number of tracks.
 * @property {string|null}     name       The name of the Album.
 * @property {Tracks|null}     tracks     The tracks of the Album.
 * @property {string|null}     uri        The URI of the Album.
 * @constructor
 */
function Album(data) {
    this.loaded = true;
    this.data = data;
    this.observers = {};
}

/**
 * Get an Album object for the given URI.
 * If provided, the callback parameter will be called when the Album has loaded.
 *
 * @param {Link|string} uri       A Link or a string containing a Spotify URI for the album.
 * @param {function=}   callback  Function to call once the Album has loaded.
 */
Album.fromURI = function(uri, callback) {
    var album;
    var link = Link.getType(uri.toString());
    if (Link.TYPE.ALBUM !== link) {
        throw new Error(l.format("Invalid album URI: {0}", uri));
    }
    album = new Album({ uri: uri });
    album.loaded = false
    callback = callback || id;
    sp.core.browseUri(uri, {
        onSuccess: function(data) {
            if (null !== data) {
                album.data = data.album;
                album.data["tracks"] = data.tracks;
                album.loaded = true;
                album.notify(EVENT.CHANGE);
                album.notify(EVENT.LOAD);
            }
            callback(album);
        },
        onFailure: function(error) {
            callback(album);
        }
    });
    return album;
};

Object.defineProperties(Album.prototype, {
    artist: {
        get: function() { return new Artist(this.data.artist); }
    },
    image: {
        get: function() {
            return this.data.cover || null;
        }
    },
    length: {
        get: function() {
            return this.loaded ? this.data.tracks.length : 0;
        }
    },
    name: {
        get: function() {
            return this.data.name || null;
        }
    },
    playable: {
        get: function() {
            return this.loaded ? this.data.availableForPlayback : null;
        }
    },
    tracks: {
        get: function() {
            return this.loaded ?
                map(function(track) { return new Track(track); },
                    this.data.tracks) : null;
        }
    },
    uri: {
        get: function() {
            return this.data.uri || null;
        }
    }
});

/**
 * Get a single Track object from the Album.
 *
 * @param {number} index  A positive integer not greater than the length of the Album.
 * @throws {RangeError}
 * @return {Track}
 */
Album.prototype.get = function(index) {
    if (index >= this.data.tracks.length) {
        throw new RangeError("Index out of range");
    }
    return new Track(this.data.tracks[index]);
};

/**
 * Get a range of Tracks from the Album.
 *
 * @param {number} index   The index at which to begin.
 * @param {number} length  The number of tracks to get.
 * @return {Track}
 */
Album.prototype.getRange = Collection.prototype.getRange;

/** @return {string} */
Album.prototype.toString = function() {
    return l.format(_("Item by artists"),
        this.name, this.data.artist);
};

Album.prototype.observe = Observable.prototype.observe;
Album.prototype.ignore  = Observable.prototype.ignore;
Album.prototype.notify  = Observable.prototype.notify;

/**
 * Construct an Artist from an Object.
 * You should rarely need to use this directly, instead the fromURI static method should be used.
 *
 * @param {Object} data        The data object used to construct the Artist.
 * @property {string|null}     image     Portrait image for the Artist.
 * @property {string|null}     name      Name of the Artist.
 * @property {string|null}     uri       URI of the Artist.
 * @constructor
 */
function Artist(data) {
    this.loaded = true;
    this.data = data;
    this.observers = {};
}

/**
 * Get an Artist object for the given URI.
 * If provided, the callback parameter will be called when the Artist has loaded.
 *
 * @param {Link|string} uri       A Link or a string containing a Spotify URI for the artist.
 * @param {function=}   callback  Function to call once the Artist has loaded.
 */
Artist.fromURI = function(uri, callback) {
    var artist;
    var link = Link.getType(uri.toString());
    if (Link.TYPE.ARTIST !== link) {
        throw new Error(l.format("Invalid artist URI: {0}", uri));
    }
    artist = new Artist({});
    artist.loaded = false;
    callback = callback || id;
    md.getMetadata(uri, function(data) {
        if (null !== data) {
            artist.data = data;
            artist.loaded = true;
        }
        callback(artist);
    });
    return artist;
};


Object.defineProperties(Artist.prototype, {
    image: {
        get: function() { return this.data.portrait || null; }
    },
    name: {
        get: function() { return this.data.name || null; }
    },
    uri: {
        get: function() { return this.data.uri || null; }
    }
});

/** @return {string} */
Artist.prototype.toString = function() {
    return this.name;
};

/**
 * The Spotify Player.
 * This constructor should not be used directly, but is included here for documentation purposes.
 * Implements {@link Observable}.
 *
 * @implements {Observable}
 * @constructor
 * @property {boolean}     playing   Indicates whether the Player is currently playing. Can be used as a setter.
 * @property {number|null} position  Get or set the current position in the currently playing track, if any.
 * @property {boolean}     repeat    Get or set repeat mode.
 * @property {boolean}     shuffle   Get or set shuffle mode.
 * @property {Track|null}  track     The currently playing track, or null if none is playing.
 * @property {number}      volume    Get or set the current volume level as a float between 0.0 and 1.0.
 */
function Player() {
    var player = this;
    player.observers = {};
    sp.trackPlayer.addEventListener("playerStateChanged", function(e) {
        player.notify(EVENT.CHANGE, e);
    });
}

/**
 * Play a track, with optional context.
 *
 * @param {Link|Track|string}           track    The track to play, as a Track object, Link object, or URI/URL string.
 * @param {Album|Playlist|Link|string=} context  The optional context in which to play the track.
 * @param {number=}                     index    Optional index of the item in the provided context.
 * @return {Player}
 */
Player.prototype.play = function(track, context, index) {
    var player = this;
    if (track.constructor === String) {
        // Convert string to Link
        track = new Link(track);
    } else if (track instanceof Link) {
        if (!(Link.TYPE.TRACK === link || Link.TYPE.LOCAL_TRACK === link))
            throw new Error(l.format("Invalid track URI: {0}", track.uri));
    }
    if (context) {
        if (context.constructor === String) {
            context = new Link(context);
        } else if (context instanceof Link) {
            if (!(Link.TYPE.PLAYLIST   === context.type ||
                     Link.TYPE.ALBUM   === context.type ||
                     Link.TYPE.INTERAL === context.type)) // For temporary playlists
                throw new Error(l.format("Invalid context URI: {0}", context.uri));
        }
        return this.playTrackWithContext(track, context, index ? index : -1);
    }
    return this.playTrack(track);
};

/**
 * @ignore
 * @param {Track} track
 * @return {Player}
 */
Player.prototype.playTrack = function(track) {
    this.track = track;
    return this;
};

/**
 * @ignore
 * @param {Track}          track
 * @param {Album|Playlist} context
 * @param {number}         index
 * @return {Player}
 */
Player.prototype.playTrackWithContext = function(track, context, index) {
    var player = this;
    if (!(context instanceof Playlist || context instanceof Album ||
        context instanceof Link || context.constructor === String)) {
        throw new Error(l.format("Invalid context: {0}", context.toString()));
    }
    sp.trackPlayer.playTrackFromContext(context.uri, index, track.uri, {
        onSuccess: function() {
            //console.log(l.format("Playing track {0} ({1}) in context {2} ({3})", track.name, track.uri, context.name, context.uri));
        },
        onFailure: function() {
            //console.log(l.format("Failed playing track {0} ({1}) in context {2} ({3})", track.name, track.uri, context.name, context.uri));
        }
    });
    return this;
};

Object.defineProperties(Player.prototype, {
    context: {
        get: function() {
            var context = sp.trackPlayer.getPlayingContext();
            return context[0] || null;
        }
    },
    index: {
        get: function() {
            var context = sp.trackPlayer.getPlayingContext();
            return -1 === context[1] ? null : context[1];
        }
    },
    playing: {
        get: sp.trackPlayer.getIsPlaying,
        set: sp.trackPlayer.setIsPlaying
    },
    position: {
        get: function() {
            var nowPlaying = sp.trackPlayer.getNowPlayingTrack();
            return nowPlaying ? nowPlaying.position : null;
        },
        set: function(position) {
            sp.trackPlayer.seek(position);
        }
    },
    repeat: {
        get: sp.trackPlayer.getRepeat,
        set: sp.trackPlayer.setRepeat
    },
    shuffle: {
        get: sp.trackPlayer.getShuffle,
        set: sp.trackPlayer.setShuffle
    },
    track: {
        get: function() {
            var nowPlaying = sp.trackPlayer.getNowPlayingTrack();
            return nowPlaying ? new Track(nowPlaying.track) : null;
        },
        set: function(track) {
            sp.trackPlayer.playTrackFromUri(track instanceof Track ? track.uri : track.toString(), {
                onSuccess: id,
                onFailure: id
            });
        }
    },
    volume: {
        get: sp.trackPlayer.getVolume,
        set: sp.trackPlayer.setVolume
    }
});

Player.prototype.observe = Observable.prototype.observe;
Player.prototype.ignore  = Observable.prototype.ignore;
Player.prototype.notify  = Observable.prototype.notify;

/**
 * Construct a new Playlist.
 * Implements {@link Collection} and {@link Observable}.
 *
 * @implements {Collection}
 * @implements {Observable}
 * @param {string=}          name           The name to use for the Playlist. If no name is provided, a temporary Playlist will be created.
 * @property {boolean|null}  collaborative  Indicates whether the Playlist is collaborative or not.
 * @property {string|null}   description    Description of the Playlist.
 * @property {string|null}   image          Image representing the Playlist.
 * @property {number|null}   length         Number of Tracks in the Playlist.
 * @property {string|null}   name           Name of the Playlist.
 * @property {User|null}     owner          The owner of the Playlist.
 * @property {boolean|null}  subscribed     Indicates whether the current User is subscribed to the Playlist.
 * @property {Array|null}    subscribers    The Users subscribed to this Playlist.
 * @property {Tracks|null}   tracks         All the Tracks in the Playlist. Using this is discouraged, for performance reasons.
 * @property {string|null}   uri            URI for the Playlist.
 * @constructor
 */
function Playlist(name) {
    var pl = this;
    pl.data = arguments.length === 0 ? sp.core.getTemporaryPlaylist(temporaryName()) :
        name.constructor === Object ? name :
        name instanceof Link ? sp.core.getPlaylist(name.toString()) :
        sp.core.library.createPlaylist(name);

    pl.observers = {};

    pl.data.addEventListener(_EVENT[EVENT.LOAD], function(e) {
        //console.log("Notifying about LOAD");
        pl.notify(EVENT.LOAD, pl);
    });

    pl.data.addEventListener(_EVENT[EVENT.UNLOAD], function(e) {
        pl.notify(EVENT.UNLOAD, pl);
    });

    pl.data.addEventListener(_EVENT[EVENT.CHANGE], function(e) {
        //console.log("Notifying about CHANGE");
        pl.notify(EVENT.CHANGE, pl);
    });

    pl.data.addEventListener(_EVENT[EVENT.ITEMS_ADDED], function(e) {
        pl.notify(EVENT.ITEMS_ADDED, pl);
    });

    pl.data.addEventListener(_EVENT[EVENT.ITEMS_REMOVED], function(e) {
        pl.notify(EVENT.ITEMS_REMOVED, pl);
    });

    pl.data.addEventListener(_EVENT[EVENT.ITEMS_MOVED], function(e) {
        pl.notify(EVENT.ITEMS_MOVED, pl);
    });

    pl.data.addEventListener(_EVENT[EVENT.RENAME], function(e) {
        pl.notify(EVENT.RENAME, pl);
    });
}

/**
 * Get a Playlist object for the given URI.
 * If provided, the callback parameter will be called when the Playlist has loaded.
 *
 * @param {Link|string} uri       A Link or a string containing a Spotify URI for the playlist.
 * @param {function=}   callback  Function to call once the Playlist has loaded.
 */
Playlist.fromURI = function(uri, callback) {
    var playlist;
    var link = uri instanceof Link ? uri : new Link(uri);
    if (Link.TYPE.PLAYLIST !== link.type) {
        throw new Error(l.format("Invalid playlist URI: {0}", uri));
    }
    playlist = new Playlist(uri instanceof Link ? uri : new Link(uri));
    callback = callback || id;
    if (playlist.loaded) {
        callback(playlist);
    } else {
        playlist.observe(EVENT.LOAD, function observer() {
            callback(playlist);
            playlist.ignore(EVENT.LOAD, observer);
        });
    }
    return playlist;
};

Object.defineProperties(Playlist.prototype, {
    collaborative: {
        get: function() {
            return this.loaded ? this.data.collaborative : null;
        }
    },
    description: {
        get: function() {
            return this.loaded ? this.data.getDescription() : null;
        },
        set: function(description) {
            this.data.setDescription(description);
        }
    },
    image: {
        get: function() { return this.data.cover || null; }
    },
    length: {
        get: function() {
            return this.loaded ? this.data.length : 0;
        }
    },
    loaded: {
        get: function() {
            return this.data.loaded;
        }
    },
    name: {
        get: function() { return this.data.name || null; },
        set: function(name) {
            this.data.rename(name);
        }
    },
    owner: {
        get: function() {
            return this.data.owner ? new User(this.data.owner) : null;
        }
    },
    subscribed: {
        get: function() {
            return this.loaded ? this.data.subscribed : null;
        },
        set: function(subscribe) {
            if (subscribe === this.subscribed) return subscribe;
            if (subscribe) {
                sp.core.library.addPlaylist(this.uri);
            } else {
                sp.core.library.removePlaylist(this.uri);
            }
        }
    },
    subscribers: {
        get: function() {
            return this.loaded ? map(function(user) { return new User(user) }, this.data.getSubscribers()) : null;
        }
    },
    tracks: {
        get: function() {
            var tracks = new Array(this.data.length);
            for (var i = 0, l = tracks.length; i < l; ++i) {
                tracks[i] = new Track(this.data.getTrack(i));
            }
            return tracks;
        }
    },
    uri: {
        get: function() { return this.data.uri || null; }
    }
});

/**
 * Add a Track to the Playlist.
 * @param  {Track|Link|string} track  Track or Link/URI string.
 * @return {number}                   The new length of the Playlist.
 */
Playlist.prototype.add = function(track) {
    this.data.add(track instanceof Track ? track.uri : track.toString());
    return this.length;
};

Playlist.prototype.get = function(index) {
    return new Track(this.data.getTrack(index));
};

Playlist.prototype.getRange = Collection.prototype.getRange;

/**
 * @param  {Track|Link|string}  track
 * @return {number}
 */
 Playlist.prototype.indexOf = function(track) {
     var index = -1;
     var uri = track instanceof Track ? track.uri : track.toString();
     for (var i = 0, l = this.length; i < l; ++i) {
         if (uri === this.data.get(i)) {
             index = i;
             break;
         }
     }
     return index;
 };

/**
 * Remove a Track from the Playlist.
 * @param  {Track|Link|string} track  Track or Link/URI string.
 * @return {number}                   The new length of the Playlist.
 */
Playlist.prototype.remove = function(track) {
    this.data.remove(track instanceof Track ? track.uri : track.toString());
    return this.length;
};

/** @return {string} */
Playlist.prototype.toString = function() {
    return l.format(_("Item by artists"),
        this.name, this.data.owner.name);
};

/**
 * Register an observer.
 * @param {*} event
 * @param {function} observer
 */
Playlist.prototype.observe = Observable.prototype.observe;

/**
 * Remove observer(s).
 * @param {*} event
 * @param {function=} observer
 */
Playlist.prototype.ignore  = Observable.prototype.ignore;

/**
 * @param {*} event
 * @param {*} data
 */
Playlist.prototype.notify  = Observable.prototype.notify;

// Create a name for a temporary playlist.
function temporaryName() {
    return (Date.now() * Math.random()).toFixed();
}

/**
 * Construct a Track from an Object.
 * You should rarely need to use this directly, instead the fromURI static method should be used.
 *
 * @param {Object} data        The data object used to construct the Track.
 * @property {Album|null}      album         The Album of the Track.
 * @property {boolean|null}    playable      Indicates whether the Track is available for playback or not.
 * @property {number|null}     duration      Duration of the Track in milliseconds.
 * @property {string|null}     image         Image representing the Track.
 * @property {boolean}         loaded        Indicates whether the Track data is loaded or not.
 * @property {string|null}     name          Name of the Track.
 * @property {number|null}     popularity    Popularity of the Track as a Number in the range of 0 through 100.
 * @property {boolean|null}    starred       Get or set track starredness.
 * @property {number|null}     number        Number of the Track on the Album it belongs to.
 * @property {string|null}     uri           The URI of the Track.
 * @constructor
 */
function Track(data) {
    this.data = data;
}

/**
 * Get a Track object for the given URI.
 * If provided, the callback parameter will be called when the Track has loaded.
 *
 * @param {Link|string} uri       A Link or a string containing a Spotify URI for the track.
 * @param {function=}   callback  Function to call once the Track has loaded.
 */
Track.fromURI = function(uri, callback) {
    var track;
    var link = Link.getType(uri.toString());
    if (!(Link.TYPE.TRACK === link || Link.TYPE.LOCAL_TRACK === link)) {
        throw new Error(l.format("Invalid track URI: {0}", uri));
    }
    track = new Track({ uri: uri });
    callback = callback || id;
    md.getMetadata(uri, function(data) {
        if (null !== data) {
            track.data = data;
        }
        callback(track);
    });
    return track;
};

Object.defineProperties(Track.prototype, {
    album: {
        get: function() {
            return this.loaded ? new Album(this.data.album) : null;
        }
    },
    artists: {
        get: function() {
            return map(function(a) { return new Artist(a); },
                this.data.artists);
        }
    },
    availability: {
        get: function() {
            return this.loaded ? this.data.availability : null;
        }
    },
    duration: {
        get: function() { return this.loaded ? this.data.duration : null; }
    },
    image: {
        get: function() {
            return this.loaded ? this.data.album.cover : null;
        }
    },
    loaded: {
        get: function() {
            return this.data.isLoaded;
        }
    },
    name: {
        get: function() { return this.data.name || null; }
    },
    playable: {
        get: function() {
            return this.loaded ?
                this.data.availableForPlayback : null;
        }
    },
    popularity: {
        get: function() { return this.loaded ? this.data.popularity : null; }
    },
    starred: {
        get: function() {
            return this.loaded ? this.data.starred : null;
        },
        set: function(starred) {
            if (starred === this.starred) return this.starred;
            if (starred)
                this.data.starred = true, exports.library.starredPlaylist.add(this);
            else
                this.data.starred = false, exports.library.starredPlaylist.remove(this);
            return this.starred;
        }
    },
    number: {
        get: function() { return this.data.trackNumber || null; }
    },
    uri: {
        get: function() { return this.data.uri || null; }
    }
});

/** @return {string} */
Track.prototype.toString = function() {
    return l.format(_("Item by artists"),
        this.name, map(function(a) { return a.name; },
            this.data.artists).join(", "));
};

/**
 * @param {string} query
 * @param {function} callback
 * @constructor
 */
function Search(query, callback) {
    this.results = [];
    // Call callback with Search instance as argument, when done
    search(query, compose(callback, partial(constant, this),
        partial(updateSearchResults, this)));
}

/** @return {Playlist} */
Search.prototype.toPlaylist = function() {
    throw new Error("Not implemented");
};

/**
 * @ignore
 * @param {Search} search
 * @param {Array} results
 * @return {Array}
 */
function updateSearchResults(search, results) {
    return search.results = results;
}


/**
 * Search helper function.
 * @ignore
 * @param {string} query
 * @param {function} callback
 */
function search(query, callback) {
    sp.core.search(query, {
        onSuccess: function(data) {
            // Mash everything together!
            callback(map(resourceFromCoreObject,
                data.albums.concat(data.artists,
                    data.playlists, data.tracks)));
        },
        onFailure: partial(callback, null)
    });
}

/**
 * Construct a User from an Object.
 * You should rarely need to use this directly, instead the fromURI static method should be used.
 *
 * @param {Object} data        The data object used to construct the User.
 * @property {string|null}     canonicalName  The canonical name of the User.
 * @property {string|null}     displayName    Displayable name of the User.
 * @property {string|null}     image          Image representing the User.
 * @property {string|null}     uri            URI for the User.
 * @constructor
 */
function User(data) {
    this.loaded = true;
    this.data = data;
}

/**
 * Get a User object for the given URI.
 * If provided, the callback parameter will be called when the User has loaded.
 *
 * @param {Link|string} uri       A Link or a string containing a Spotify URI for the user.
 * @param {function=}   callback  Function to call once the User has loaded.
 */
User.fromURI = function(uri, callback) {
    var user;
    var type = Link.getType(uri.toString());
    if (!(Link.TYPE.PROFILE === type || Link.TYPE.FACEBOOK_USER === type)) {
        throw new Error(l.format("Invalid user URI: {0}", uri));
    }
    user = new User({ uri: uri });
    user.loaded = false;
    callback = callback || id;
    sp.social[Link.TYPE.PROFILE === type ?
        "getUserByUsername" : "getUserByFacebookUid"](uri.slice(uri.lastIndexOf(":") + 1), {
        onSuccess: function(data) {
            user.data = data;
            user.loaded = true;
            callback(user);
        },
        onFailure: function(error) {
            callback(user);
        }
    });
    return user;
};

Object.defineProperties(User.prototype, {
    canonicalName: {
        get: function() {
            return this.data.canonicalUsername || null;
        }
    },
    displayName: {
        get: function() {
            return this.data.name || null;
        }
    },
    image: {
        get: function() {
            return this.data.picture || null;
        }
    },
    uri: {
        get: function() {
            return this.data.uri || null;
        }
    }
});

User.prototype.toString = function() {
    return this.displayName;
};

/**
 * Object representing the current session.
 * @constructor
 * @property {Session.STATE} state     The current connection state.
 * @property {string}        country   ISO 3166-1 alpha-2 country code of the logged in user.
 * @property {Array.<User>}  friends   The friends of the logged in user.
 * @property {string}        language  The current language as an IANA language code.
 */
function Session() {
    this._user = null;
}

Object.defineProperties(Session.prototype, {
    state: {
        get: sp.core.getLoginMode
    },
    country: {
        get: function() {
            return sp.core.country;
        }
    },
    language: {
        get: function() {
            return sp.core.language;
        }
    },
    user: {
        get: function() {
            if (!this._user)
                this._user = new User(sp.core.user);
            return this._user;
        }
    }
});

/**
 * Connection states.
 * @ignore
 * @enum {number}
 */
Session.STATE = {
    LOGGED_OUT:   0, // Not logged in.
    LOGGED_IN:    1, // Logged in against access point.
    DISCONNECTED: 2, // Logged in but currently disconnected (trying to reconnect).
    OFFLINE:      3, // Logged in but in offline mode.
    DUMMY_USER:   4, // Logged in with a dummy user. This means no network access or anything.
};

var _starredPlaylist = null;

/**
 * An object representing the current user's library.
 * @constructor
 * @property {Array.<Album>}    albums           All albums in the user's library.
 * @property {Array.<Artist>}   artists          All artists in the user's library.
 * @property {Array.<Playlist>} playlists        All playlists in the user's library.
 * @property {Playlist}         starredPlaylist  The user's playlist of starred tracks.
 * @property {Array.<Track>}    tracks           All tracks in the user's library.
 */
function Library() {}

Object.defineProperties(Library.prototype, {
    albums: {
        get: function() {
            return map(function(album) { return new Album(album); },
                sp.core.library.getAlbums());
        }
    },
    artists: {
        get: function() {
            return map(function(artist) { return new Artist(artist); },
                sp.core.library.getArtists());
        }
    },
    playlists: {
        get: function() {
            return map(function(playlist) { return new Playlist(playlist); },
                sp.core.library.getPlaylists());
        }
    },
    starredPlaylist: {
        get: function() {
            if (!_starredPlaylist)
                _starredPlaylist = new Playlist(sp.core.getStarredPlaylist());
            return _starredPlaylist;
        }
    },
    tracks: {
        get: function() {
            return map(function(track) { return new Track(track); },
                sp.core.library.getTracks());
        }
    }
});

/**
 * Social.
 * @constructor
 * @property {Array.<User>} favorites  Users marked as favorites.
 * @property {Array.<User>} friends    All friends.
 */
function Social() {}

Object.defineProperties(Social.prototype, {
    favorites: {
        get: function() {
            return map(function(uri) { return User.fromURI(uri); },
                sp.social.getFavorites().all());
        }
    },
    friends: {
        get: function() {
            return map(function(uri) { return User.fromURI(uri); },
                sp.social.relations.all());
        }
    }
});

/**
 * Construct a pretty object from a "raw" one
 * @ignore
 * @throws {Error} If object is of unknown type
 * @return {Album|Artist|Playlist|Track}
 */
function resourceFromCoreObject(object) {
    if ("album"    === object.type) return new Album(object);
    if ("artist"   === object.type) return new Artist(object);
    if ("playlist" === object.type) return new Playlist(object);
    if ("track"    === object.type) return new Track(object);
    throw new Error(l.format("Unknown object: {0}", object.toString()));
}
