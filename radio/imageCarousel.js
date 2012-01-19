/**
 * @copyright (c) 2011 Spotify Ltd
 * @author Sriram Malladi <sriram@spotify.com>
 */

'use strict';

exports.ImageCarousel = ImageCarousel;

 var dom = sp.require('sp://import/scripts/dom'),
     r = sp.require('sp://import/scripts/react'),
	 lang = sp.require('sp://import/scripts/language'),
     ui = sp.require('sp://import/scripts/ui');

var catalog = lang.loadCatalog("cef_views");

function ImageCarousel(selector, titleHTML) {
	var IMAGE_WIDTH = 125;
	var MIN_IMAGE_PADDING = 15;
	var imagePadding = 15;
	var numPerPage = 4; // TODO make this an option.
	
	var wrapper = null; // div that holds everything
	var carouselList = null; // ul element holding all the items 
	var numItems = 0;
	var currentIndex = 0; // current position of the carousel
	var self = this;
	
	var init = function() { 
		wrapper = dom.Element('div', {className: 'imageCarouselWrapper'});
		dom.queryOne(selector).appendChild(wrapper);
		
		wrapper.appendChild(dom.Element('h2', {className: 'imageCarouselTitle', innerHTML: titleHTML}));
		
		var paginationButtons = dom.Element('div', {className: 'imageCarouselPagination'});
		wrapper.appendChild(paginationButtons);
		var prev = dom.Element('div', {className: 'imageCarouselPrev disabled'})
		paginationButtons.appendChild(prev);
		var next = dom.Element('div', {className: 'imageCarouselNext disabled'})
		paginationButtons.appendChild(next);
	
		r.fromDOMEvent(prev, 'click').subscribe(function(e) {
			self.scrollTo(currentIndex - numPerPage);
		});	
		r.fromDOMEvent(next, 'click').subscribe(function(e) {
			self.scrollTo(currentIndex + numPerPage);
		});	
		

		var carousel = dom.Element('div', {className: 'imageCarousel'});
		wrapper.appendChild(carousel);
	
		carouselList = dom.Element('ul');
		carousel.appendChild(carouselList);
		self.handleResize();
	}
	
	/**
	 * Adds an item to the carousel
	 *
	 * imgSrc: the source for the image
	 * title: a dict with the title and a link that the title goes to. ex:
	 *		 {name: "Iron Maiden", link: 'spotify:artist:6mdiAmATAx73kdxrNrnlao'}
	 * subtitles: an array of dicts like the previous for subtitles
	 */
	this.addItem = function(seedUri, imgSrc, title, subtitles) {
		var li = dom.Element('li');
		var placeholder = (seedUri.indexOf("artist") !== -1) ? 
			"128-artist.png" : "sp://import/img/placeholders/300-album.png";
		var text = "";
		if (seedUri.indexOf("track") !== -1) {
			text = lang.format(lang.getString(catalog, "Misc", "Item by artists"),
					subtitles[0].name, title.name);
		} else {
			text = title.name;
		}
		var img = new ui.SPImage((imgSrc == "" ? placeholder : imgSrc), seedUri, text).node;
		img.style.display = "block";
		img.appendChild(dom.Element('div'));
		li.appendChild(img);
		var titleDiv = dom.Element('div', {className: 'imageCarouselTitle'});
		li.appendChild(titleDiv);
		var a = dom.Element('a', {className: 'outgoing main', text: title.name.decodeForText(), href: title.link});
		if (title.link == "") {
			a.style.pointerEvents = "none";
			a.style.cursor = "default";
		}
		titleDiv.appendChild(a);
		titleDiv.appendChild(dom.Element('br'));
		for(var i=0;i<subtitles.length;i++) {
			var subtitle = subtitles[i];
			var a = dom.Element('a', {className: 'outgoing', text: subtitle.name.decodeForText(), href: subtitle.link});
			titleDiv.appendChild(a);
			titleDiv.appendChild(dom.Element('br'));
		}
		li.style.paddingLeft = li.style.paddingRight = imagePadding + 'px';
		carouselList.appendChild(li);
		numItems++;
		updateSize();
	}
	
	/**
	 * Scrolls the carousel to the given index
	 */
	this.scrollTo = function(index) {
		if (index > numItems - numPerPage) {
			index = numItems - numPerPage;
		}
		if (index < 0) {
			index = 0;
		}
		
		// Hide next/previous buttons as necessary
		function toggle(sel, isDisabled) {
			var button = dom.queryOne(sel, wrapper);
			if(isDisabled) {
				button.className = button.className + " disabled";
			} else {
				button.className = button.className.replace(/ disabled/g, "");
			}
		}
		toggle('.imageCarouselPrev', index == 0);
		toggle('.imageCarouselNext', index >=  numItems - numPerPage);

		carouselList.style.marginLeft = '-' + (index * paddedImageWidth()) + 'px';

		currentIndex = index;
	}
	
	/**
	 * Empties the carousel. Call just before adding new stuff
	 */
	this.clear = function() {
		var items = dom.query("li", carouselList);
		for(var i=0; i<items.length; i++) {
			dom.destroy(items[i]);
		}
		numItems = 0;
	}
	
	function updateSize() {
		carouselList.style.width = (numItems * paddedImageWidth()) + 'px';
	}
	
	this.handleResize = function(_) {
		var fullWidth = parseInt(window.getComputedStyle(wrapper).width.replace('px',''));
		numPerPage = Math.floor(fullWidth / (IMAGE_WIDTH + 2*MIN_IMAGE_PADDING));
		imagePadding = Math.floor((fullWidth / numPerPage - IMAGE_WIDTH) / 2);
		var images = dom.query("li", wrapper);
		for (var i=0; i < images.length; i++) {
			images[i].style.paddingLeft = images[i].style.paddingRight = imagePadding + 'px'; 
		};
		dom.queryOne(".imageCarouselTitle", wrapper).style.paddingLeft = imagePadding + 'px';
		dom.queryOne(".imageCarouselPagination", wrapper).style.paddingLeft =
			(numPerPage*IMAGE_WIDTH + (2*numPerPage-1)*imagePadding  - 50) + 'px';
		updateSize();
		self.scrollTo(currentIndex);
	}
	
	function paddedImageWidth() {
		return IMAGE_WIDTH + 2*imagePadding;
	}
	
	r.fromDOMEvent(window, 'resize').subscribe(self.handleResize);
	
	init();
};
