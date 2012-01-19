/**
 * @copyright (c) 2011 Spotify Ltd
 * @author Sriram Malladi <sriram@spotify.com>
 */

'use strict';

exports.Cloud = Cloud;

var dom = sp.require('sp://import/scripts/dom'),
    r = sp.require('sp://import/scripts/react');

/**
 * A tag cloud used for the genre list. Handles resizing windows and makes each line centered. 
 *
 * selector: selector for element containing the cloud
 * lis: list of dom li elements - one for each element  of the cloud
 */
function Cloud(selector, lis) {
	var wrapper = null; // div that holds everything
	var liWidths = [];
	
	function getWidth(e) {
		return parseInt(window.getComputedStyle(e).width.replace('px', ''));
	}
	
	function handleResize(_) {
		var totalWidth = getWidth(wrapper);
		while(wrapper.hasChildNodes()) {
			wrapper.removeChild(wrapper.lastChild);
		}
		
		var currentUl = dom.Element('ul', {className: 'cloudLine'});
		wrapper.appendChild(currentUl);
		var currentLength = 0;
		for (var i=0; i < lis.length; i++) {
			if (currentLength + liWidths[i] > totalWidth) {
				currentUl.style.width = currentLength + 'px';
				currentUl = dom.Element('ul', {className: 'cloudLine'});
				wrapper.appendChild(currentUl);
				currentLength = liWidths[i];
			} else {
				currentLength = currentLength + liWidths[i];
			}
			currentUl.appendChild(lis[i]);
		};
		currentUl.style.width = currentLength + 'px';
	}

	r.fromDOMEvent(window, 'resize').subscribe(handleResize);
	
	function init() {
		wrapper = dom.queryOne(selector);
		var ul = dom.Element('ul');
		wrapper.appendChild(ul);
		// HACK: Add the elements to the DOM just so we can figure out their heights
		for (var i=0; i < lis.length; i++) {
			var li = lis[i];
			ul.appendChild(li);
			liWidths.push(getWidth(li) + 25); // 25 for padding etc.
		};
		wrapper.appendChild(ul);
		handleResize();		
	}

	init();
}
