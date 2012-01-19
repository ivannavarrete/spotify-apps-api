"use strict";

sp = getSpotifyApi(1);

exports.init = init;

var dom = sp.require('sp://import/scripts/dom'),
	ui = sp.require('sp://import/scripts/ui'),
	p = sp.require('sp://import/scripts/pager');

var wrapper = dom.id('wrapper'),
	playlists = [],
	artists = [],
	albums = [];

function init()
{
	var search_query = sp.core.getArguments().join(':').decodeForText();
	if (!search_query) {
		search_query = 'stone roses';
	}

	// true -> manual invocation
	sp.core._set_body_size(0, 0, true);

	sp.core.search(search_query, true, true, {
		onSuccess: function(result) {
			if (result.did_you_mean) {
				buildDYM(result.did_you_mean.decodeForHTML(), result.did_you_mean_link);
			}
			if (result.playlists && result.playlists.length > 0) {
				playlists = result.playlists;
				buildPlaylists();
			}
			if (result.artists && result.artists.length > 0) {
				artists = result.artists;
				buildArtists();
			}
			if (result.albums && result.albums.length > 0) {
				albums = result.albums;
				buildAlbums();
			}

			// true -> manual invocation
			sp.core._set_body_size(0, dom.getSize(document.body).y, true);
		},
		onFailure: function() {
			console.log('Failed to get search results', arguments)
		}
	});
}

/**
 * "Did you mean.."
 */
function buildDYM(name, link)
{
	var sec = new dom.Element('section', {className: 'did_you_mean'});
	sec.innerHTML = '<p>Did you mean "<a href="'+link+'">'+name+'</a>"?</p>';
	dom.inject(sec, wrapper, 'before');
}

/**
 * Build up results for playlists
 */
function buildPlaylists()
{
	var sec = new dom.Element('section', {className: 'playlists'}),
		pager = new p.Pager(new PlaylistsDataSource(), {orientation: 'vertical', bullets: false, pagingLocation: 'top'});
	pager.h2.textContent = 'Playlists';
	dom.adopt(sec, pager.node);
	dom.adopt(wrapper, sec);
}

/**
 * Build up results for artists
 */
function buildArtists()
{
	var sec = new dom.Element('section', {className: 'artists'}),
		pager = new p.Pager(new ArtistsDataSource(), {orientation: 'vertical', bullets: false, pagingLocation: 'top'});
	pager.h2.textContent = 'Artists';
	dom.adopt(sec, pager.node);
	dom.adopt(wrapper, sec);
}

/**
 * Build up results for albums
 */
function buildAlbums(albums)
{
	var sec = new dom.Element('section', {className: 'albums'}),
		pager = new p.Pager(new AlbumsDataSource(), {orientation: 'vertical', bullets: false, pagingLocation: 'top'});
	pager.h2.textContent = 'Albums';
	dom.adopt(sec, pager.node);
	dom.adopt(wrapper, sec);
}

/**
 *
 */
function PlaylistsDataSource()
{
	this.count = function()
	{
		return playlists.length;
	};

	this.makeNode = function(index)
	{
		var d = playlists[index], li = new dom.Element('li'),
			img = new ui.SPImage((d.cover ? d.cover : ''), d.uri, d.name.decodeForHTML()),
			text = new dom.Element('span', {className: 'text'});
		var pl_text = '<a href="'+d.uri+'" class="name">'+d.name.decodeForHTML()+'</a>';
		text.innerHTML = pl_text;

		if (d.owner.uri != sp.core.user.uri) {
			// only show owner if the user isn't the author
			text.innerHTML += '<a href="'+d.owner.uri+'" class="artist">'+d.owner.name.decodeForHTML()+'</a>';

			// lookup a nicer name if available, to get rid of ugly digits
			sp.social.getUserByUsername(d.owner.name.decodeForText(), {
				onSuccess: function(r) {
					// try getting real name, and rewrite text
					text.innerHTML = pl_text + '<a href="'+d.owner.uri+'" class="artist">'+r.name.decodeForHTML()+'</a>';
				},
				onFailure: function() {
					// we're already falling back to what we got in the playlist result
				}
			});
		}
		dom.adopt(li, img.node, text);
		return li;
	}
}

/**
 *
 */
function ArtistsDataSource()
{
	this.count = function()
	{
		return artists.length;
	};

	this.makeNode = function(index)
	{
		var d = artists[index], li = new dom.Element('li'),
			img = new ui.SPImage(d.portrait, d.uri, d.name.decodeForHTML()),
			text = new dom.Element('span', {className: 'text'});
		text.innerHTML = '<a href="'+d.uri+'" class="name">'+d.name.decodeForHTML()+'</a>'
		dom.adopt(li, img.node, text);
		return li;
	};
}

/**
 *
 */
function AlbumsDataSource()
{
	this.count = function()
	{
		return albums.length;
	};

	this.makeNode = function(index)
	{
		var d = albums[index], li = new dom.Element('li'),
			img = new ui.SPImage(d.cover, d.uri, d.name.decodeForHTML()),
			text = new dom.Element('span', {className: 'text'});
		text.innerHTML = '<a href="'+d.uri+'" class="name">'+d.name.decodeForHTML()+'</a>'
			+'<a href="'+d.artist.uri+'" class="artist">'+d.artist.name.decodeForHTML()+'</a>';
		dom.adopt(li, img.node, text);
		return li;
	};
}
