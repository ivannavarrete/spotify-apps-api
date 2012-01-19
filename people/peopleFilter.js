/**
 * PeopleFilter for filtering friends on the people view.
 * @author Jason LaCarrubba <jason@spotify.com>
 */

"use strict";

var sp = sp || getSpotifyApi(1);

var dom = sp.require('sp://import/scripts/dom');

var PeopleFilter = function(searchBoxId, clearId, displayCallback, userBase) {

  var pf = {};

  // private vars
  var matches = [],
      matched = -1,
      noMatchesEl = document.getElementById('no-matches'),
      displayCallback = displayCallback,
      searchfield = document.getElementById(searchBoxId),
      clear = document.getElementById(clearId),
      social = sp.require('sp://import/scripts/social'),
      allUsers = social.relations,
      users = [];

  // private methods
  var findMatches = function findMatches(term) {
    var matches = [];

    matches = filter(function(user) {
      return user.name.toLowerCase().indexOf(term) !== -1;
    }, users);

    return matches;
  };

  var filterItems = function filterItems() {
    matches = [];
    matched = -1;
    var fieldString = searchfield.value.toLowerCase();

    if (fieldString.trim() === '') {
      clear.style.display = 'none';
      noMatchesEl.style.display = 'none';
      searchfield.value = '';
      displayCallback();
      return; 
    };

    clear.style.display = 'inline';
    matches = findMatches(fieldString);
    matched = matches.length;
    if (matched > 0) {
      noMatchesEl.style.display = 'none';
    } else {
      noMatchesEl.style.display = 'inline-block';
    }
    displayCallback();
  };

  var clearClick = function clearClick() {
    searchfield.value = '';
    filterItems();
  };

  var setupCache = function setupCache(userBase) {
    if (userBase === 'spotify') {
      users = filter(function(user) {
        return user.canonicalUsername.length > 0;
      }, allUsers);
    } else {
      users = allUsers;
    }
  };

  setupCache(userBase);
  searchfield.focus();
  dom.listen(searchfield, 'input', function() {filterItems();});
  dom.listen(clear, 'click', clearClick);

  // public
  pf.matchCount = function() {
    if (matched > -1 ) {
      return matched;
    } else {
      return users.length;
    }
  };

  pf.getUser = function(index) {
    if (matched > -1) {
      return matches[index];
    } else {
      return users[index];
    };
  };

  pf.reCache = function(userBase) {
    setupCache(userBase);
    filterItems();
  };

  return pf;
};

exports.PeopleFilter = PeopleFilter;
