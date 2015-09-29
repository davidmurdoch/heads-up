/* global angular */

var headsUpApp = angular.module('headsUpApp', ['ngRoute','headsUpControllers']);

headsUpApp.config(['$routeProvider', function($routeProvider) {
    $routeProvider.
        when('/', {
            'templateUrl': 'partials/decks.html',
            'controller': 'DeckListCtrl'
        }).
        when('/deck/:id', {
            'templateUrl': 'partials/deck.html',
            'controller': 'DeckCtrl'
        }).
        otherwise({
            'redirectTo': '/'
        });
    }
]);



// todo: angularize this
// Check if a new cache is available on page load.
window.addEventListener('load', function(e) {

  window.applicationCache.addEventListener('updateready', function(e) {
    if (window.applicationCache.status == window.applicationCache.UPDATEREADY) {
      // Browser downloaded a new app cache.
      if (confirm('A new version of this site is available. Load it?')) {
        window.location.reload();
      }
    } else {
      // Manifest didn't changed. Nothing new to server.
    }
  }, false);

}, false);