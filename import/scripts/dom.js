"use strict";

sp = getSpotifyApi(1);

var util = sp.require('sp://import/scripts/util');

function Element(tag, properties) {
	var props = properties || {},
		styles = props.styles || {},
		el = document.createElement(tag);

	if (props.html) {
		el.innerHTML = props.html;
	}
	if (props.text) {
		el.textContent = props.text;
	}

	util.merge(el, props || {});
	util.merge(el.style, styles);
	return el;
}

function Event(name, bubble, cancelable, type) {
	var ev = document.createEvent(type || "Event");
	ev.initEvent(name, bubble || false, cancelable || false);

	this.dispatch = function(target) {
		target.dispatchEvent(ev);
		return this;
	}
}

function listen(el, name, capture) {
	el.addEventListener(name, capture);
	return el;
}

function query(selector, context) {
	return idMap((context || document).querySelectorAll(selector));
}

function queryOne(selector, context) {
	return (context || document).querySelector(selector);
}

function adopt(/*el1, el2, ...*/) {
	var elements = idMap(arguments),
		parent = elements.shift();

	if (0 === elements.length) {
		return parent;
	}

	elements.forEach(parent.appendChild.bind(parent));
	return parent;
}

function prepend(parent, child) {
	parent.insertBefore(child, parent.firstChild);
	return parent;
}

/**
 * Empty a node of all it's children
 */
function empty(node) {
	while (node.firstChild) {
		node.removeChild(node.firstChild);
	}
	return node;
}

/**
 * Remove a node from the dom
 */
function destroy(node) {
	if (!node || !node.parentNode) return;
	node.parentNode.removeChild(node);
}

/**
 * Inject a node into the dom relative to another node
 */
function inject(node, relative, mode) {
	switch (mode) {
		case 'before':
			relative.parentNode.insertBefore(node, relative);
			break;
		case 'after':
			relative.parentNode.insertBefore(node, relative.nextSibling);
			break;
		case 'top': // Injects at the top of given relative node
			relative.insertBefore(node, relative.firstChild);
			break;
		default: // Injects at the bottom of given relative node
			relative.appendChild(node);
	}
	return node;
}

/**
 * Get size of an element
 */
function getSize(node) {
	return {x: node.offsetWidth, y: node.offsetHeight};
}

/**
 * Get position of an element (reletive to parent)
 */
function getPosition(node) {
	return {x: node.offsetLeft, y: node.offsetTop};
}

/**
 * Scroll parent to reveal child
 * @param {Node} parent
 * @param {Node} child
 * @return {Node}
 */
function reveal(parent, child) {
	var st = parent.scrollTop;
	var ot1 = parent.offsetTop;
	var oh1 = parent.offsetHeight;
	var ot2 = child.offsetTop;
	var oh2 = child.offsetHeight;
	if (st + oh1 + ot1 < ot2 + oh2) {
		parent.scrollTop = ot2 + oh2 - oh1 - ot1;
	} else if (0 !== st && st > ot2 - ot1) {
		parent.scrollTop = ot2 - ot1;
	}
	return child;
}

/**
 * Shorthand function to get an element by id.
 */
function id(id)
{
	return document.getElementById(id);
}

/**
 * Check if element has child elements
 */
function hasChildElements(parent)
{
	var hasChild = false;
	for (var child = parent.firstChild; child; child = child.nextSibling) {
		if (child.nodeType === 1) {
			hasChild = true;
			break;
		}
	}
	return hasChild;
}

/**
 * Replaces an existing element in the dom with a new one
 */
function replace(oldNode, newNode)
{
	if (!oldNode || !newNode) {
		return oldNode;
	}
	return oldNode.parentNode.replaceChild(newNode, oldNode);
}

exports = {
	Element: Element,
	Event: Event,
	adopt: adopt,
	listen: listen,
	prepend: prepend,
	query: query,
	queryOne: queryOne,
	empty: empty,
	destroy: destroy,
	inject: inject,
	getSize: getSize,
	getPosition: getPosition,
	reveal: reveal,
	id: id,
	hasChildElements: hasChildElements,
	replace: replace
}
