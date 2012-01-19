"use strict";

sp = getSpotifyApi(1);

var md = sp.require("sp://import/scripts/metadata");

var lang    = sp.require("sp://import/scripts/language");
var catalog = lang.loadCatalog("cef_views");
var _       = partial(lang.getString, catalog, "Presence");

exports.stringFromArtistsArray  = stringFromArtistsArray;
exports.stringFromPresenceState = stringFromPresenceState;

var SUBSCRIPTION_SCHEMA = [
	{
		name: "Subscription",
		fields: [
			{
				id: 1,
				name: "uri",
				type: "string"
			},
			{
				id: 2,
				name: "expiry",
				type: "int32"
			}
		]
	}
];

var PRESENCE_SCHEMA = [
	{
		name: "PlaylistPublishedState",
		fields: [
			{
				id: 1,
				name: "uri",
				type: "string"
			},
			{
				id: 2,
				name: "timestamp",
				type: "int32"
			}
		]
	},
	{
		name: "PlaylistTrackAddedState",
		fields: [
			{
				id: 1,
				name: "playlist_uri",
				type: "string"
			},
			{
				id: 2,
				name: "track_uri",
				type: "string"
			},
			{
				id: 3,
				name: "timestamp",
				type: "int32"
			}
		]
	},
	{
		name: "TrackFinishedPlayingState",
		fields: [
			{
				id: 1,
				name: "uri",
				type: "string"
			},
			{
				id: 2,
				name: "context_uri",
				type: "string"
			},
			{
				id: 3,
				name: "timestamp",
				type: "int32"
			}
		]
	},
	{
		name: "PresenceState",
		fields: [
			{
				id: 1,
				name: "timestamp",
				type: "int32"
			},
			// Deprecated states
			{
				id: 2,
				name: "type",
				type: "int32"
			},
			{
				id: 3,
				name: "uri",
				type: "string"
			},
			// In new times, one of these states are set
			{
				id: 4,
				name: "playlist_published",
				type: "PlaylistPublishedState"
			},
			{
				id: 5,
				name: "playlist_track_added",
				type: "PlaylistTrackAddedState"
			},
			{
				id: 6,
				name: "track_finished_playing",
				type: "TrackFinishedPlayingState"
			}
		]
	}
];

var SOCIAL_SCHEMA = [
	{
		name: "FacebookMessagePost",
		fields: [
			{
				id: 1,
				name: "fb_uid",
				type: "*string"
			},
			{
				id: 2,
				name: "message",
				type: "string"
			},
			{
				id: 3,
				name: "spotify_uri",
				type: "*string"
			}
		]
	}
];

sp.core.registerSchema(PRESENCE_SCHEMA);
sp.core.registerSchema(SUBSCRIPTION_SCHEMA);
sp.core.registerSchema(SOCIAL_SCHEMA);

function hasKey(k, obj) {
	return obj.hasOwnProperty(k);
}

function isStarredPlaylist(uri) {
	return /:starred$/.test(uri) && !/:playlist:/.test(uri); // Gross
}

function formatPlaylistPublished(state, cb) {
	var uri = state.playlist_published.uri;
	//console.log("Playlist published", uri);
	md.getMetadata(uri, function(md) {
	    if (null === md) return;
		cb(lang.format("<span class=\"playlist\">{0}</span>",
			lang.format(_("Published playlist"),
			lang.format("<a href=\"{0}\">{1}</a>", md.uri.decodeForHTML(), md.name.decodeForHTML()))));
	});
}

function formatPlaylistTrackAdded(state, cb) {
	var track_uri = state.playlist_track_added.track_uri;
	var playlist_uri = state.playlist_track_added.playlist_uri;
	if (isStarredPlaylist(state.playlist_track_added.playlist_uri)) {
		md.getMetadata(track_uri, function(md) {
			if (!md || md.isInvalid) return;
			cb(lang.format("<span class=\"starred\">{0}</span>",
				lang.format(_("Starred track"), { uri: md.uri.decodeForHTML() + "?action=browse", name: md.name.decodeForHTML() })));
		});
	} else {
		md.getMetadata([track_uri, playlist_uri], function(md) {
			if (!(md && md[0] && md[1])) return;
			cb(lang.format("<span class=\"playlist\">{0}</span>",
				lang.format(_("Added track"), md[0].uri.decodeForHTML(), md[0].name.decodeForHTML(), md[1].uri.decodeForHTML(), md[1].name.decodeForHTML())));
		});
	}
}

function formatTrackFinishedPlaying(state, cb) {
	var uri = state.track_finished_playing.uri;
	//console.log("formatTrackFinishedPlaying " + uri);
	md.getMetadata(uri, function(md) {
	    if (null === md) return;
		cb(lang.format("<span class=\"track\">{0}</span>",
			lang.format(_("Track"),
				{ uri: md.uri.decodeForHTML() + "?action=browse", name: md.name.decodeForHTML(),
					artists: stringFromArtistsArray(md.artists) })));
	});
}

function formatFacebookActivity(state, cb) {
	cb(_("Facebook activity"));
}

function stringFromPresenceState(state, cb) {
	var fn = constant;
	var ts = 0;
	if (hasKey("playlist_published", state) && ts < state.playlist_published.timestamp) {
		fn = formatPlaylistPublished;
		ts = state.playlist_published.timestamp;
	}
	if (hasKey("playlist_track_added", state) && ts < state.playlist_track_added.timestamp) {
		fn = formatPlaylistTrackAdded;
		ts = state.playlist_track_added.timestamp;
	}
	if (hasKey("track_finished_playing", state) && ts < state.track_finished_playing.timestamp) {
		fn = formatTrackFinishedPlaying;
		ts = state.track_finished_playing.timestamp;
	}
	if (hasKey("facebook_activity", state) && ts < state.facebook_activity.timestamp) {
		fn = formatFacebookActivity;
		ts = state.facebook_activity.timestamp;
	}
	fn(state, cb);
}

function stringFromArtistsArray(as) {
	return map(function(a) {
		return lang.format("<a class=\"sp-text-truncate\" href=\"{0}\">{1}</a>",
			a.uri.decodeForHTML(), a.name.decodeForHTML());
	}, as).join(", ");
}
