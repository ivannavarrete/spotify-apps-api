"use strict";

(function(g) {
	/*
	 * The sp variable is referenced within our own API code
	 * and is resolved when the user first calls getSpotifyApi().
	 * Note: this will break if the user ever wants two versions
	 * of the API at once.
	 */
	var sp;

	function _getSpotifyApi(version) {
		if (sp) return sp;

		var _cache = {};
		function _getModule(cache, module) {
			if (cache[module]) return cache[module];
			return (cache[module] = window._getSpotifyModule(module));
		}

		sp = {
			get core()         { return _getModule(_cache, "core"); },
			get desktop()      { return _getModule(_cache, "desktop"); },
			get social()       { return _getModule(_cache, "social"); },
			get trackPlayer()  { return _getModule(_cache, "trackPlayer"); },
			get whatsnew()     { return _getModule(_cache, "whatsnew"); },
			get installer()    { return _getModule(_cache, "installer"); },
			get require()      { return _require; },
			get requireAsync() { return _requireAsync; }
		};
		return sp;
	}

	Object.defineProperty(g, "getSpotifyApi", {
		get: function() {
			return _getSpotifyApi;
		}
	});

	var _require = (function() {
		var cache = {};

		function evalModule(module, code) {
			var exports;
			try {
				exports = eval("(function() {" +
				               "var exports = this;" +
				               code + ";return exports;" +
				               "}.call({}))");
			} catch (error) {
				error.message += " in " + module;
				throw error;
			}
			return exports;
		}

		/**
		 * Require modules
		 * @param {string} module Path of module to load
		 * @return {Object} Exported properties of module
		 */
		function require(module) {
			var moduleId = module + ".js";
			var code;
			var exports;
			if (cache[moduleId]) {
				return cache[moduleId];
			}
			code = sp.core.readFile(moduleId);
			if (undefined === code) {
				throw new Error("Could not load module: " + moduleId);
			}
			return cache[moduleId] = evalModule(moduleId, code);
		}

		return require;
	}());

	function _requireAsync(module, callback) {
		setTimeout(function() {
			var m = _require(module);
			callback(m);
		}, 0);
	};

	String.prototype.decodeForText = function() {
		var result = "";
		for (var i = 0; i < this.length; ++i) {
			if (this.charAt(i) !== "&") {
				result += this.charAt(i);
				continue;
			} else if (this.substring(i, i + 5) === "&amp;") {
				result += "&";
				i += 4;
				continue;
			} else if (this.substring(i, i + 4) === "&lt;") {
				result += "<";
				i += 3;
				continue;
			} else if (this.substring(i, i + 4) === "&gt;") {
				result += ">";
				i += 3;
				continue;
			} else if (this.substring(i, i + 6) === "&quot;") {
				result += "\"";
				i += 5;
				continue;
			} else if (this.substring(i, i + 6) === "&apos;") {
				result += "'";
				i += 5;
				continue;
			} else if (this.substring(i, i + 8) === "&equals;") {
				result += "=";
				i += 7;
				continue;
			}
		}
		return result;
	};

	String.prototype.decodeForHTML = function() {
		return this;
	};
	
	String.prototype.decodeForLink = function() {
		return encodeURI(this.decodeForText());
	}
	
	String.prototype.encodeToHTML = function() {
		var result = "";
		for (var i = 0; i < this.length; ++i) {
			if (this.charAt(i) === "&") {
				result += "&amp;";
			} else if (this.charAt(i) === "<") {
				result += "&lt;";
			} else if (this.charAt(i) === ">") {
				result += "&gt;";
			} else if (this.charAt(i) === "\"") {
				result += "&quot;";
			} else if (this.charAt(i) === "'") {
				result += "&apos;";
			} else if (this.charAt(i) === "=") {
				result += "&equals;";
			} else {
				result += this.charAt(i);
			}
		}
		return result;
	}
}(this));

function compare(x, y) {
	return x === y ? 0 : x <= y ? -1 : 1;
}

/**
 * @param {*} x
 * @return {*}
 */
function id(x) {
    return x;
}

/**
 * @param {*} x
 * @param {*} _
 * @return {*}
 */
function constant(x, _) {
    return x;
}

/**
 * @param {*} a
 * @param {*} b
 * @return {boolean}
 */
function eq(a, b) {
    return a === b;
}

/**
 * @param {boolean} b
 * @return {boolean}
 */
function not(b) {
    return !b;
}

/**
 * Map a function over an Array (or Array-like object)
 * @param {function(*): *} f
 * @param {*} xs
 * @return {Array}
 */
function map(f, xs) {
    var length = xs.length;
    var ys = [];
    var i = 0;
    while (i < length) {
        ys[i] = f(xs[i++]);
    }
    return ys;
}

/**
 * Filter an Array (or Array-like object)
 * @param {function(*):boolean} p
 * @param {*} xs
 * @return {Array}
 */
function filter(p, xs) {
    var length = xs.length;
    var ys = [];
    var i = 0;
    var j = 0;
    while (j < length) {
        if (true === p(xs[j])) {
            ys[i++] = xs[j];
        }
        ++j;
    }
    return ys;
}

/**
 * Fold an array from the left
 * @param {function(*, *):*} f Combining function
 * @param {*} z Initial value
 * @param {*} xs
 * @return {*}
 */
function foldl(f, z, xs) {
    var length = xs.length;
    var i = 0;
    while (i < length) {
        z = f(z, xs[i++]);
    }
    return z;
}

/**
 * Fold an array from the right
 * @param {function(*, *):*} f Combining function
 * @param {*} z Initial value
 * @param {*} xs An Array-like object
 * @return {*}
 */
function foldr(f, z, xs) {
    var i = xs.length;
    while (i--) {
        z = f(xs[i], z);
    }
    return z;
}

/**
 * @param {function(*):*} f
 * @param {*} x
 * @return {*}
 */
function force(f, x) {
    return f(x);
}

/**
 * Flip the arguments of a binary function
 * @param {function(*, *)} f
 * @return {function(*, *)}
 */
function flip(f) {
    return function(x, y) {
        return f(y, x);
    };
}

/**
 * Function composition
 * param {...function(...):*} fs
 * @return {function(*):*}
 */
function compose() {
    var fs = arguments;
    return function(x) {
        return foldr(force, x, fs);
    };
}

/**
 * Partially apply a function
 * $param {function(...):*} f
 * $param {...} args
 * @return {function(...):*}
 */
function partial() {
    var args = idMap(arguments);
    var f = args.shift();
    return function() {
        return f.apply(null,
            args.concat(idMap(arguments)));
    };
}

function idMap(xs) {
    return map(id, xs);
}
