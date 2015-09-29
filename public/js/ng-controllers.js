/* global angular BufferLoader headsUpApp MediaStreamRecorder */

// todo: make this a service
function launchIntoFullscreen(element) {
  if(element.requestFullscreen) {
    element.requestFullscreen();
  } else if(element.mozRequestFullScreen) {
    element.mozRequestFullScreen();
  } else if(element.webkitRequestFullscreen) {
    element.webkitRequestFullscreen();
  } else if(element.msRequestFullscreen) {
    element.msRequestFullscreen();
  }
}
function exitFullscreen(element){
  if(document.exitFullscreen) {
    document.exitFullscreen();
  } else if(document.mozCancelFullScreen) {
    document.mozCancelFullScreen();
  } else if(document.webkitExitFullscreen) {
    document.webkitExitFullscreen();
  } else if(document.msExitFullscreen) {
    document.msExitFullscreen();
  }
}

var headsUpControllers = angular.module('headsUpControllers', []);

headsUpApp.controller('MainController', ["$scope", "$window", 'audio', function($scope, $window, audio){
    $scope.isFullscreen = $window.document.isFullScreen || $window.document.webkitIsFullScreen || $window.document.mozFullScreen;
    $scope.page={showHeader:true, showBackButton: false, audio:[]};
    $scope.loaded = false;

    angular.element($window.document).bind("webkitfullscreenchange mozfullscreenchange fullscreenchange MSFullscreenChange", function(){
        $scope.isFullscreen = $window.document.isFullScreen || $window.document.webkitIsFullScreen || $window.document.mozFullScreen;
        $scope.$apply();
    });

    $scope.goFullscreen = function(){
        $scope.isFullscreen ? exitFullscreen($window.document.body) : launchIntoFullscreen($window.document.body);
    };

    audio.load(['audio/ding.mp3', 'audio/error.mp3', 'audio/start-round.mp3']).then(function(buffers){
        $scope.page.audio = buffers;
        $scope.loaded = true;
    });
}]);

headsUpApp.controller('DeckListCtrl', ["$scope", "$http", "$window", function ($scope, $http, $window) {
    $scope.page.showBackButton = false;
    $http.get('json/decks.json').success(function(data) {
        $scope.decks = data;
    });
    $scope.showDetails=function(deck){
        $scope.details=deck;
    };
    $scope.closeDetails=function(){
        $scope.details = null;
    };
    $scope.goFullscreen=function(){
        launchIntoFullscreen($window.document.body);
    };
}]);

headsUpControllers.controller('DeckCtrl', ['$scope', '$routeParams', "$http", "$interval", "$timeout", "$window", "$sce", '$q',
    function( $scope, $routeParams, $http, $interval, $timeout, $window, $sce, $q ) {
        $scope.page.showBackButton = true;
        $scope.videoSrc = "#";
        $scope.page.showHeader=false;
        $scope.score = 0;
        $scope.remainingTime = 0;

        lockOrientation();

        var countdownTimer = null;
        var getReadyTimer = null;
        var lastGammaChange = null;
        var lastDirection = null;
        var messageTimer = null;
        var selectedIndex = 0;
        var currentCard = null;

        // get our webcam stream as early as possible
        var stream = null;
        var mediaRecorder;
        var videoStreamPromise = getVideoStreamUrl().then(function(obj){
            if(obj){
                mediaRecorder = new MediaStreamRecorder(obj.stream);
                mediaRecorder.mimeType = 'video/webm';
                $scope.videoSrc = $sce.trustAsResourceUrl(obj.url);
                stream = obj.stream;
            }
        });

        $scope.toggleHeader = function(){
             $scope.page.showHeader = !$scope.page.showHeader;
        };

        // make sure we tear down some things when leaving this controller
        $scope.$on('$destroy', function() {
            $interval.cancel(countdownTimer);
            $interval.cancel(getReadyTimer);
            $timeout.cancel(messageTimer);

            unlockOrientation();
            stopStream();
            mediaRecorder && mediaRecorder.clearOldRecordedFrames();

            // restore the header, if missing
            $scope.page.showHeader = true;
            // make sure touching the screen doesn't toggle the header
            $scope.toggleHeader = function(){};

            $scope.inProgress = false;
            angular.element($window).unbind('deviceorientation', handleDeviceOrientationChange);
        });

        var ajaxPromise = $http.get('json/decks/' + $routeParams.id + '.json');

        $scope.saveVideo = function(){
            mediaRecorder && mediaRecorder.save();
        };

        // todo: handle failure
        $q.all([videoStreamPromise, ajaxPromise]).then(gotDeck, gotDeck);

        // a promise that is always successful, becuase i'm lazy
        function getVideoStreamUrl() {
            return $q(function(resolve, reject){
                try {
                    $window.navigator.getUserMedia(
                    	{video: true, audio: false}, // Options
                    	function(localMediaStream) { // Success
                    		resolve ({"url": $window.URL.createObjectURL(localMediaStream), "stream": localMediaStream});
                    	},
                    	function(err) { // Failure
                    	    resolve(null);
                    	}
                    );
                }
                catch(e){
                    resolve(null);
                }
            });
        }


        function handleDeviceOrientationChange (e) {
            var gamma = Math.abs(e.gamma);
            var tempGammaChange = null;
            if( lastGammaChange === null){
                lastGammaChange = gamma > 30 ? "forward" : "up/down";
                return;
            } else {
                if( gamma > 30) // we are facing forward
                {
                    tempGammaChange = "forward";
                } else { // we are up or down
                    tempGammaChange = "up/down";
                }
            }

            if( tempGammaChange !== lastGammaChange){
                lastGammaChange = tempGammaChange;
                lastDirection = lastGammaChange === "forward" ? "forward" : (e.gamma < 0 ? "up" : "down");
                if(lastDirection !== "forward"){

                    // TODO: fix the CSS animation so that animations triggered in quick succession work
                    $timeout.cancel(messageTimer);

                    if (lastDirection === "up"){
                        $scope.message = "PASS";
                        $scope.messageClass = "show pass";
                        messageTimer = $timeout(function(){$scope.messageClass = ""}, 1500);
                        $scope.stats.push({"card": currentCard, "status": "PASS"});

                        $scope.page.audio && $scope.page.audio[1].play();
                    }
                    else if( lastDirection === "down"){
                        $scope.message = "CORRECT!";
                        $scope.score++;
                        $scope.messageClass = "show correct";
                        messageTimer = $timeout(function(){$scope.messageClass = ""}, 1500);
                        $scope.stats.push({"card": currentCard, "status": "CORRECT"});
                        $scope.page.audio && $scope.page.audio[0].play();
                    }
                    selectedIndex++;
                    var nextCard = $scope.deck.randomCards[selectedIndex];

                    if ( nextCard ) {
                        currentCard.className = "";
                        nextCard.className = "selected";
                        currentCard = nextCard;
                    }
                    else {
                        selectedIndex = 0;
                        nextCard = $scope.deck.randomCards[selectedIndex];
                        currentCard.className = "";
                        nextCard.className = "selected";
                        currentCard = nextCard;
                    }
                    $scope.selectedCard = currentCard;
                    $scope.$apply();
                }
            }
        }

        function lockOrientation(){
            var orientation = 'landscape';
            // try this because Opera will throw when calling lockOrientation.
            try {
                // force landscape mode on browsers that support it
                if($window.screen.orientation && $window.screen.orientation.lock){
                    $window.screen.orientation.lock.call($window.screen.orientation, orientation);
                } else if($window.screen.lockOrientation){
                    $window.screen.lockOrientation(orientation);
                }
            }
            catch(ex){
                // ignore
            }
        }
        function unlockOrientation(){
            try{
                if($window.screen.orientation && $window.screen.orientation.unlock){
                    $window.screen.orientation.unlock.call($window.screen.orientation);
                }
                else if($window.screen.unlockOrientation){
                    $window.screen.unlockOrientation();
                }
            }
            catch(ex){
                // ignore
            }
        }

        function stopStream(){
            mediaRecorder && mediaRecorder.stop();

            stream && stream.getTracks && stream.getTracks()[0] && stream.getTracks()[0].stop();
            stream = null;
        }

        function gotDeck(args) {
            var data = args[1].data;
            var gameTime = 60;
            var startingIn = 5;

            if ( mediaRecorder ){
                mediaRecorder.video = $window.document.getElementById("video");
                // record one second longer than should be possible
                mediaRecorder && mediaRecorder.start( (gameTime + startingIn) * 1000 );
            }

            // set up the deck order and stats
            $scope.stats = [];
            $scope.deck = data;
            $scope.deck.randomCards = [];
            angular.forEach($scope.deck.cards, function(card) {
                $scope.deck.randomCards.push({
                    "title": card,
                    "className": "",
                    "rank": 0.5 - Math.random()
                });
            });
            $scope.deck.randomCards = $scope.deck.randomCards.sort(function(a,b){return a.rank > b.rank;});

            // init the first card
            selectedIndex = 0;
            currentCard = $scope.deck.randomCards[selectedIndex];
            currentCard.className = "selected";
            $scope.selectedCard = currentCard;

            // some view vars
            $scope.startingIn = startingIn;

            // start the 5 second count down
            // TODO: wait until it is on their forehead and in landscope orientation
            countdown();
            getReadyTimer = $interval(countdown, 1000);

            function countdown(){
                if( $scope.startingIn === 0){
                    $interval.cancel(getReadyTimer);

                    begin();
                    return;
                }
                else if( $scope.startingIn === 2){
                    $scope.page.audio && $scope.page.audio[2].play();
                }
                $scope.startingIn--;
            }

            function begin(){
                angular.element($window).bind('deviceorientation', handleDeviceOrientationChange);

                $scope.remainingTime = gameTime;
                $scope.inProgress = true;

                // start the 60 second countdown
                countdownTimer = $interval(function(){
                    if ( $scope.remainingTime === 0 ) {
                        $interval.cancel(countdownTimer);
                        unlockOrientation();
                        stopStream();
                        // restore the header, if missing
                        $scope.page.showHeader = true;

                        $scope.inProgress = false;
                        angular.element($window).unbind('deviceorientation', handleDeviceOrientationChange);
                        $timeout(function(){
                            $scope.messageClass = "";
                            $scope.inProgress = false;
                            $scope.gameOver = true;
                        }, 500);

                        $scope.stats.push({"card": currentCard, "status": "PASS"});
                    }
                    else{
                        $scope.remainingTime--;
                    }
                }, 1000);
            }
        }
    }
]);