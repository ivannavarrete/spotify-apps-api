"use strict";

sp = getSpotifyApi(1);

var util = sp.require("sp://import/scripts/util");
var dom  = sp.require("sp://import/scripts/dom");
var fs   = sp.require("sp://import/scripts/fs");
var log  = sp.require("sp://import/scripts/logger");
var md   = sp.require("sp://import/scripts/metadata");
var ui   = sp.require("sp://import/scripts/ui");
var lang = sp.require("sp://import/scripts/language");
var r    = sp.require("sp://import/scripts/react");
var cat  = lang.loadCatalog("cef_views");
var _    = partial(lang.getString, cat, "Generic");
var shareTemplate = lang.format(fs.readFile("sp://import/templates/share.html"),
	_("sGenericShareMessagePlaceholder"),
	_("sGenericCancel"),
	_("sGenericSend"),
	_("sGenericLoading"));
var DEFAULTS = {
	contentNode: null,
	relativeNode: document.body,
	offsetLeft: 0,
	offsetFlippedLeft: 0,
	offsetTop: 0,
	offsetInvertedTop: 0,
	sharePopoverPrependElem: null
}

exports.showPopover = popover;
exports.sharePopup  = showSharePopover;
exports.shareSocialPopup  = showSocialSharePopover;
exports.hidePopover = function() {
	if (null !== _popover) {
		hidePopover(_popover);
	}
}

Object.defineProperty(exports, "popover", {
    get: function() {
        return _popover;
    }
});

var _popover = null;

// Get position of element
function getPosition(element) {
	var pos = findPos(element);
	return {
		x: element.offsetLeft,
		y: element.offsetTop,
		width: element.clientWidth,
		height: element.clientHeight,
		dX: pos[0],
		dY: pos[1]
	}
}

function findPos(obj) {
	var curleft = 0, curtop = 0;
	if (obj.offsetParent) {
		do {
			curleft += obj.offsetLeft;
			curtop += obj.offsetTop;
		} while (obj = obj.offsetParent);
	}
	return [curleft, curtop];
}

/**
 * Wrapper that gets/creates the "singleton" Popover
 * @param {Node} contentNode
 * @return {Popover}
 */
function popover(options) {
	if (null === _popover) {
		_popover = new Popover(options);
	}
	_popover.setContent(options);
	return _popover;
}

/**
 * Popover constructor
 * @constructor
 */
function Popover(options) {
	var self = this;
	this.options = util.merge({}, DEFAULTS, options || {});
	this.node = document.createElement("div");
	this.targetNode = null;
	this.visible = false;
	this.node.classList.add("popover");

	r.fromDOMEvent(this.node, "click").subscribe(function(e) {
		e.stopPropagation(); // Prevent clicks on/in the popover from hiding it
	});

	r.merge(r.fromDOMEvent(window, "click"), r.fromDOMEvent(window, "blur")).subscribe(function(e) {
	    if (sp.core.isApplicationFocused) {
		    self.hide();
		}
	});
}

Popover.prototype.setContent = function(options) {
	this.options.relativeNode = options.relativeNode || DEFAULTS.relativeNode;
	while (this.node.firstChild) {
		this.node.removeChild(this.node.firstChild);
	}
	this.node.appendChild(options.contentNode);
}

Popover.prototype.show = function(targetNode) {
    return showPopover(this, targetNode);
}

Popover.prototype.hide = function(instant, sent) {
    return hidePopover(this, instant, sent);
}

function hidePopover(popover, instant, sent) {
	if (false === popover.visible)
		return popover;
	popover.visible = false;
	popover.targetNode.classList.remove("selected");
	if (true === instant) {
		removePopover(popover);
		return popover;
	}
	popover.targetNode = null;
	popover.node.offsetWidth;
	if (true === sent) {
		popover.node.classList.add("sent");
	} else {
		popover.node.classList.add("hidden");
	}
	r.takeFirst(r.fromDOMEvent(popover.node, "webkitAnimationEnd")).subscribe(partial(removePopover, popover));
	return popover;	
}

function removePopover(popover) {
	if (popover.node.parentNode && !popover.visible)
		popover.node.parentNode.removeChild(popover.node);
	return popover;	
}

function showPopover(popover, targetNode) {
	var p = popover.options.relativeNode;

	if (true === popover.visible) {
		targetNode.classList.remove("selected");
		if (popover.targetNode === targetNode) {
			popover.hide(false);
			return popover;
		} else {
			popover.hide(true);
		}
	}

	sp.core.activate();
	popover.visible = true;
	popover.targetNode = targetNode;
	targetNode.classList.add("selected");

	var pos     = getPosition(targetNode);
	var pPos    = getPosition(p);
	var top     = pos.dY - p.scrollTop;
	var left    = pos.dX - p.scrollLeft;

	var bottomProximity = -50; // Some extra pixels for the bouncy animation
	var rightProximity  = 0;
	var initialScroll   = p.scrollTop; // Stupid, so tied to the DOM, but will do for now

	r.throttle(r.fromDOMEvent(p, "scroll"), 50).subscribe(function(e) {
		var scrollDiff = Math.abs(initialScroll - e.target.scrollTop);
		if (5 < scrollDiff) popover.hide();
	});

	r.takeFirst(r.filter(function(e) { return 27 === e.which; },
		r.fromDOMEvent(window, "keyup"))).subscribe(partial(hidePopover, popover));
	r.fromDOMEvent(window, "resize").subscribe(partial(hidePopover, popover));

	document.body.appendChild(popover.node);
	popover.node.offsetWidth;

	bottomProximity += document.documentElement.clientHeight - top - popover.node.clientHeight;
    rightProximity  += document.documentElement.clientWidth - left - popover.node.clientWidth - popover.options.offsetLeft;

	if (bottomProximity <= 0) {
		popover.node.classList.add("inverted");
		popover.node.style.top = top - popover.node.clientHeight + popover.options.offsetInvertedTop + "px";
	} else {
		popover.node.classList.remove("inverted");
		popover.node.style.top = top + popover.options.offsetTop + "px";
	}

	if (rightProximity <= 0) {
		popover.node.classList.add("flipped");
		popover.node.style.left = left - popover.node.clientWidth + popover.options.offsetFlippedLeft + "px";
	} else {
		popover.node.classList.remove("flipped");
		popover.node.style.left = left + popover.options.offsetLeft + "px";
	}

	popover.node.classList.remove("hidden");
	popover.node.classList.remove("sent");

	return popover;
}

function showSharePopover(data, uri, elem, options) {
	var node = document.createElement("div");
	var linkType = sp.core.getLinkType(uri);
	var image;
	var pl;

	node.innerHTML = shareTemplate;
	if (options && options.sharePopoverPrependElem) {
		node.insertBefore(options.sharePopoverPrependElem, node.firstChild);
	}
	node.classList.add("popover-share");

	var artwork      = dom.queryOne(".artwork", node);
	var title        = dom.queryOne(".title", node);
	var artist       = dom.queryOne(".artist", node);
	var form         = dom.queryOne("form", node);
	var textarea     = dom.queryOne("textarea", form);
	var cancelButton = dom.queryOne(".cancel", form);

	setTimeout(function() {
		textarea.select(); // Refuses to select without the timeout >:|
	}, 10);

	// Special case for playlists, to get a proper mosaic image.
	if (5 === linkType) {
		pl = sp.core.getPlaylist(uri);
		if (pl.loaded) {
			image = new ui.SPImage(pl.cover, pl.uri, pl.name);
			title.textContent = pl.name;
			artist.textContent = pl.owner.name;
			artwork.appendChild(image.node);
		} else {
			pl.addEventListener("change", function onChange(e) {
				if (pl.loaded) {
					image = new ui.SPImage(pl.cover, pl.uri, pl.name);
					title.textContent = pl.name;
					artist.textContent = pl.owner.name;
					artwork.appendChild(image.node);
					pl.removeEventListener("change", onChange);
				}
			});
		}
	} else {
		md.getMetadata(uri, function(md) {
			if (null === md) return;
			if ("track" === md.type) {
				image = new ui.SPImage(md.album.cover, md.uri, md.name);
				title.innerHTML = lang.format("<a href=\"{0}\">{1}</a>", md.uri, md.name);
				artist.innerHTML = map(function(a) { 
					return lang.format("<a href=\"{0}\">{1}</a>", a.uri, a.name); 
				}, md.artists).join(", ");
			} else if ("artist" === md.type) {
				image = new ui.SPImage(md.portrait, md.uri, md.name);
				title.textContent = md.name;
				dom.empty(artist);
			} else if ("album" === md.type) {
				image = new ui.SPImage(md.cover, md.uri, md.name);
				title.textContent = md.name;
				artist.textContent = md.artist.name;
			} else if ("playlist" === md.type) {
				image = new ui.SPImage(md.cover, md.uri, md.name);
				title.textContent = md.name;
				artist.textContent = md.owner.name;
			}
			image.node.classList.add(md.type);
			artwork.appendChild(image.node);
		});
    }

	if (options)
		options.contentNode = node;
	var sharePopover = popover(options);

	var popupId = +new Date();
	log.logClientEvent("share popover", "open", "1", "1", {
		popupId: popupId,
		uri: uri});
	node.addEventListener("click", function (e) {
		if (e.target.tagName !== "A" || !e.target.href) return;
		log.logClientEvent("share popover", "link", "1", "1", {
			popupId: popupId,
			uri: e.target.href});
	});

	r.fromDOMEvent(cancelButton, "click").subscribe(function () {
		log.logClientEvent("share popover", "cancel", "1", "1", {
			popupId: popupId,
			message: !!textarea.value});
		hidePopover(sharePopover);
	});

	r.merge(r.fromDOMEvent(form, "submit"), r.fromDOMEvent(textarea, "keyup")).subscribe(function(e) {
		// Detect enter
		if ("keyup" === e.type && 13 !== e.which) return;
		e.preventDefault();

		var node = sharePopover.node;
		var failure = 0;
		var onFailureCb = partial(sp.core.showClientMessage, 2, _("sGenericSendMessageError"));
		var onCompleteCb = function() {
			if (null !== data.facebookUid && 2 === failure || null === data.facebookUid && 1 === failure) {
				onFailureCb();
			}
		};

		var throbber = new dom.Element('div', {className:"checkmark"});
		throbber.style.height = node.clientHeight - 16 + "px";
		throbber.style.width = node.clientWidth - 8 + "px";
		dom.adopt(throbber, document.createElement('div'));
		dom.adopt(node, throbber);

		// Send to Spotify Inbox, if available
		if (data.canonicalUsername) {
			sp.social.sendToInbox(data.canonicalUsername,
				textarea.value,
				uri, {
					onSuccess: function() {}, //partial(onSuccessCb, _("sGenericSendMessageInbox")),
					onFailure: function() {
						failure++;
					},
					onComplete: onCompleteCb
				});
		}

		// Send to Facebook, if available
		if (data.facebookUid) {
			var postObj = { 
				fb_uid: [data.facebookUid], 
				message: textarea.value, 
				spotify_uri: [sp.core.spotifyUriToHttpLink(uri)]
			};
			sp.core.getHermes("POST", "hm://social/post_to_facebook",
				[
					["FacebookMessagePost", postObj]
				],
				{
					onSuccess: function() {}, //partial(onSuccessCb, _("sGenericSendMessageFacebook")),
					onFailure: function() {
						failure++;
					},
					onComplete: onCompleteCb
				}
			);
		}

		log.logClientEvent("share popover", "send", "1", "1", {
			popupId: popupId,
			toFacebook: !!data.facebookUid,
			toSpotify: !!data.canonicalUsername,
			message: !!textarea.value});

		setTimeout(function() {
			sharePopover.hide(false, true);
		}, 400);
	});

	sharePopover.show(elem);
	return data;
}

/**
 * Simple wrapper for displaying social share
 * @param {MouseEvent} event
 */
function showSocialSharePopover(event, uri) {
	sp.social.showSharePopup(event.clientX, event.clientY, uri);
}
