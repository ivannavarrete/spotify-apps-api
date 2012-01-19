"use strict";

/**
 * Convert an Array-like object (like an arguments object) to Array
 * @param {*} arrLike Sufficiently Array-like object
 * @param {number=} begin Zero-based index at which to begin extraction
 * @param {number=} end Zero-based index at which to end extraction (exclusive)
 * @return {Array}
 */
function toArray(arrLike, begin, end) {
	return Array.prototype.slice.call(arrLike, begin, end);
}

/**
 * Concatenate an array of arrays
 * @param {Array} arr Array to concat
 * @return {Array}
 */
function concat(arr) {
	return foldl(function(a, b) { return a.concat(b); }, [], arr);
}

/**
 * Merge multiple objects
 * @param {...Object} objects Variable number of objects to merge
 *	from left to right
 * @return {Object}
 */
function merge(/*obj1, obj2, ...*/) {
	var objects = toArray(arguments),
		target = objects.shift();
	objects.forEach(function(obj) {
		Object.keys(obj).forEach(function(k) {
			target[k] = obj[k];
		});
	});
	return target;
}

/**
 * Internal function used to implement `throttle` and `debounce`.
 * @param {function(...):*} func
 * @param {integer} wait
 * @param {boolean} debounce
 * @return {function(...):*}
 */
function limit(func, wait, debounce) {
	var timeout;
	return function() {
		var context = this, args = arguments;
		var throttler = function() {
			timeout = null;
			func.apply(context, args);
		};
		if (debounce) clearTimeout(timeout);
		if (debounce || !timeout) timeout = setTimeout(throttler, wait);
	};
}

/**
 * Returns a function, that, when invoked, will only be triggered at most once
 * during a given window of time.
 * @param {function(...):*} func
 * @param {integer} wait
 * @return {function(...):*}
 */
function throttle(func, wait) {
	return limit(func, wait, false);
}

/**
 * Returns a function, that, as long as it continues to be invoked, will not
 * be triggered. The function will be called after it stops being called for
 * N milliseconds.
 * @param {function(...):*} func
 * @param {integer} wait
 * @return {function(...):*}
 */
function debounce(func, wait) {
	return limit(func, wait, true);
}

/** 
 * Returns a function that will be executed at most one time, no matter how
 * often you call it. Useful for lazy initialization.
 * @param {function(...):*} func
 * @return {function(...):*}
 */
function once(func) {
	var ran = false, memo;
	return function() {
		if (ran) return memo;
		ran = true;
		return memo = func.apply(this, arguments);
	};
}

exports = {
	concat: concat,
	merge: merge,
	toArray: toArray,
	throttle: throttle,
	debounce: debounce,
	once: once
}
