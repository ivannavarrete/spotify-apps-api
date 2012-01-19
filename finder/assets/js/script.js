"use strict";
var request = sp.require("sp://import/scripts/request");
var dom = sp.require("sp://import/scripts/dom");
var hermesScheme = sp.require("assets/js/appstore-proto");

/**
 * Setting variables
 */
var carouselSpeed = 5000; //ms

/**
 * Private variables
 */
 var COUNTRY = sp.core.country;

/**
 * Class for the App Market
 */
var appMarket = {
	init: function()
	{
		appMarket.buildApps();
		Banner.init();

		sp.installer.addEventListener('favoriteRemoved', function (app) {
			appMarket.removeFavourite(app.data);
		});
		sp.installer.addEventListener('favoriteAdded', function (app) {
			appMarket.addFavourite(app.data);
		});
	},
	buildApps: function()
	{
		var li = document.querySelectorAll("li");
		for(var i=0; li.length - 1 >= i; i++ ) {
			var appElement = li[i];
			var appId = appElement.id;

			/* Beware of ugly hardcoded market fix */
			if (appId === 'tunigo' && COUNTRY === 'SE') {
				appElement.style.display = 'inline-block';
			}
			if (appId === 'dagbladet' && COUNTRY === 'NO') {
				appElement.style.display = 'inline-block';
			}

			var isFavourite = sp.installer.isApplicationFavorite(appId);

			if (isFavourite) {
				var button = appElement.querySelector('button');
				button.disabled = true;
				button.textContent = 'added';
				button.classList.remove('primary');
			}

			appElement.addEventListener('click', function(e) {
				var appId = this.id;
				var element = e.target;
				var tag = e.target.tagName;

				if (tag !== 'BUTTON' && tag !== 'LI') {
					window.location.href = 'spotify:app:' + appId;
				}
				if (tag === 'BUTTON' && element.disabled === false) {
					sp.installer.addApplicationFavorite(appId);
				}
			}, false);
		}
	},
	addFavourite: function(appId)
	{
		var appElement = document.querySelector('#' + appId);
		var appButton = appElement.querySelector('button');
		appButton.disabled = true;
		appButton.textContent = 'added';
		appButton.classList.remove('primary');
	},
	removeFavourite: function(appId)
	{
		var appElement = document.querySelector('#' + appId);
		var appButton = appElement.querySelector('button');
		appButton.disabled = false;
		appButton.textContent = 'add';
		appButton.classList.add('primary');
	},
	getHermes: function () {
		var postObj = {
			market: "SE",
			platform: 0
		};

		sp.core.getHermes("GET", "hm://appstore/app/list/",
			[
				["RequestHeader", postObj]
			],
			{
				onSuccess: function() {console.log('hej')},
				onFailure: function() {console.log('woot')},
				onComplete: function() {}
			}
		);
	}
}

/**
 * Class for a array of top-banners
 **/
var Banner = {

	init: function()
	{
		var header = document.querySelector('header');

 		var bannerActive = false;
		header.onmouseover = function() { bannerActive = true;}
		header.onmouseout = function() { bannerActive = false;}
		var bannerInterval = window.setInterval(function() {
			if (bannerActive === false) {
				Banner.next();
			}
		}, carouselSpeed);

		header.addEventListener('click', function(e) {
			var target = e.target;
			if (target.id === 'nextimage') {
				Banner.next();
			} else if (target.id === 'previousimage') {
				Banner.previous();
			} else if (target.dataset['appid'] === 'spotify') {
				return;
			} else {
				window.location = 'spotify:app:' + target.dataset['appid'];
			}
		});
	},
	/**
	 * Set a class "focus" on the next banner image
	 **/
	next: function()
	{
		var focus = false;
		var banners = document.querySelectorAll(".banner-images");
		for(var i=0; banners.length - 1 >= i; i++)
		{
			if (focus){
				banners[i].classList.add('focus');
				focus = false;
				break;
			}
			if(banners[i].classList.contains('focus')){
				focus = true;
				banners[i].classList.remove('focus');
			}
		}
		if (focus){
			banners[0].classList.add('focus');
			focus = false;
		}
	},
	/**
	* Set a class "focus" on the previous banner image
	**/
	previous: function(){
		var focus = false;
		var banners = document.querySelectorAll(".banner-images");
		for(var i= banners.length -1 ; i >= 0; i-- )
		{
			if (focus){
				banners[i].classList.add('focus');
				focus = false;
				break;
			}
			if(banners[i].classList.contains('focus')){
				focus = true;
				banners[i].classList.remove('focus');
			}
		}
		if (focus){
			banners[banners.length -1].classList.add('focus');
			focus = false;
		}

	}
};

/**
 * Exports
 */
exports.init = appMarket.init;
