"use strict";

sp = getSpotifyApi(1);

var r 		= sp.require('sp://import/scripts/react');
var dom 	= sp.require('sp://import/scripts/dom');
var fs 		= sp.require('sp://import/scripts/fs');
var lang 	= sp.require('sp://import/scripts/language');
var catalog = lang.loadCatalog('cef_views');
var ui 		= sp.require('sp://import/scripts/ui');
var _ 		= partial(lang.getString, catalog, 'Profile');

var MSGBAR_TYPES = {
	INFORMATION: 0,
	WARNING: 1,
	ERROR: 2,
	INFORMATION_HEART: 3
};

var fallbackCounter = 0;
var fallback = [{
	listtype: "tracks",
	filter: "user",
	user: sp.core.user.canonicalUsername
}, {
	listtype: "tracks",
	filter: "everywhere",
	user: sp.core.user.canonicalUsername
}];

function TopList(opts) { /* user, callbacks, etc */
	var tl = this;
	tl.opts = {
		className: '',
		maxItems: 12
	};
	tl.listObj = {
		listtype: "tracks",
		filter: "user",
		user: sp.core.user.canonicalUsername
	};

	for (var prop in opts) {
		tl.opts[prop] = opts[prop];
	}
};

TopList.prototype.fetchList = function(callbacks) {
	var tl = this;

	function buildList(result) {
		var items = [];
		var fragment = document.createDocumentFragment();
		var type = '';

		var list = new dom.Element('ul', {
			className: type
		});

		result.forEach(function(item, index, source) {
			var li 			= document.createElement("li");
			var anchor 		= document.createElement("a");
			var artistWrap 	= document.createElement("p");
			var anchorTitle = '';
			var artistArr 	= [];
			var imageNode   = null;
			var name 		= item.name.decodeForText();
			var clonedAnchor;

			anchor.href = item.uri;
			anchor.textContent = name;

			clonedAnchor = anchor.cloneNode();
			clonedAnchor.className = "cover";

			if (item.type != 'artist') {
				imageNode = fetchImageNode(item.album.cover, true);
			} else {
				imageNode = fetchImageNode(item.portrait, false);
				// add number instead for top artists
				dom.adopt(clonedAnchor, new dom.Element("span", {
					className: "number",
					innerHTML: index + 1
				}));
			}
			dom.adopt(clonedAnchor, imageNode);
			dom.adopt(li, clonedAnchor);

			artistWrap.className = "artist-wrap sp-text-truncate";
			if (item.type != 'artist') {
				item.artists.forEach(function(element, index, array){
					var artistAnchor = document.createElement("a");
					var separator = document.createTextNode(", ");
					var name = element.name.decodeForText();

					artistAnchor.href = element.uri;
					artistAnchor.textContent = name;
					artistArr.push(name);
					if (index > 0) {
						dom.adopt(artistWrap, separator);
					}
					dom.adopt(artistWrap, artistAnchor);
				});
				dom.adopt(li, artistWrap);
				anchorTitle = name +" "+ _("sProfileBy") + " " + artistArr.join(', ');
			} else {
				anchorTitle = name;
			}

			anchor.className = "song-title sp-text-truncate";
			anchor.title = anchorTitle;
			clonedAnchor.title = anchorTitle;

			dom.adopt(li, anchor);
			dom.adopt(list, li);
		});
		dom.adopt(fragment, list);
		return fragment;
	}

	function fetchTopList(obj) {
		sp.social.getToplist(obj.listtype, obj.filter, obj.user, {
			onSuccess: function(result) {

				obj.listtype = "artist" === obj.listtype ? "artists" : obj.listtype;

				result.copy = result[obj.listtype];

				if (result.copy && "tracks" === obj.listtype) {
					result.copy = filter(function(item) {
						return !item.isLocal;
					}, result.tracks);
				}

				if (result.copy && result.copy.length) {

					var items = result.copy.slice(0, tl.opts.maxItems);
					tl.toplist = buildList(items);
					tl.listtype = obj.listtype;

					if (callbacks && "function" === typeof callbacks.loadTemplateCb) {
						callbacks.loadTemplateCb(obj);
					}
					if (callbacks && "function" === typeof callbacks.adoptToplistCb) {
						callbacks.adoptToplistCb();
					} else {
						dom.adopt(dom.queryOne("body"), tl.toplist);
					}
				} else {
					//console.log("to few, falling back", result);
					fetchTopList(fallback[fallbackCounter++]);
				}
			},
			onFailure: function(error) {
				//console.log("failed, falling back", error, obj);
				fetchTopList(fallback[fallbackCounter++]);
			},
			onComplete: function () {
				//console.log("completed");
			}
		});
	}

	// If normal user, fetch top artists from user
	if (tl.opts.user.canonicalUsername) {
		tl.listObj.listtype = "artist";
		tl.listObj.user = tl.opts.user.username;
	}
	fetchTopList(tl.listObj);
}

function fetchImageNode(_image, bAddButton) {
	var fragment = document.createDocumentFragment();
	var coverImg = new ui.SPImage(_image);

	var aligner = new dom.Element("div", {
		className: "bottom-align centered"
	});
	var button = new dom.Element("button", {
		className: "sp-button sp-text-truncate",
		type: "button"
	});
	var content = document.createTextNode(_("sProfileSendTrack"));

	dom.adopt(fragment, coverImg.node);

	if (bAddButton) {
		dom.adopt(button, content);
		dom.adopt(aligner, button);
		dom.adopt(fragment, aligner);
	}
	return fragment;
}

exports = {
	TopList: TopList
}