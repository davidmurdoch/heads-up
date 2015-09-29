/* global headsUpApp */

// loads Audio Files into a buffer so they can be played back later
headsUpApp.factory("BufferLoader", [ "$http", "$q", function($http, $q){

    var loadBuffer = function (context, url, index) {

        return $http({"method":"GET", "url": url, "responseType": "arraybuffer" }).then(function(response) {

            // Asynchronously decode the audio file data
            return $q(function(resolve, reject){
                if(!context || !context.decodeAudioData) {
                    reject("AudioContext not supported");
                    return;
                }
                context.decodeAudioData(
                    response.data,
                    function(buffer) {
                        if (!buffer) {
                            console.error('error decoding file data: ' + url);
                            return {};
                        }
                        resolve({
                            'url': url,
                            'index': index,
                            'buffer': buffer
                        });
                    },
                    function(error) {
                        console.error('decodeAudioData error', error);
                        reject(error);
                    }
                );
            });
        }, function(err) {
            console.error(err);
            return err;
        });
    };

    return {
        'load': function(context, urlList) {
            var promises = [];
            for (var i = 0, l = urlList.length; i < l; ++i){
                promises.push( loadBuffer(context, urlList[i], i) );
            }
            return $q.all(promises);
        }
    };
}]);

headsUpApp.factory('audio', ['$window', 'BufferLoader', '$q', function($window, BufferLoader, $q){

    var AudioContext = $window.AudioContext || $window.webkitAudioContext;

    var context = AudioContext ? new AudioContext() : null;

    function playSound(buffer) {
        if(!context) return;
        var source = context.createBufferSource();
        source.buffer = buffer;
        source.connect(context.destination);
        source.start(0);
    }

    return {
        'load': function(files){
            return BufferLoader.load(
                context,
                files
            ).then(function(buffers){
                return buffers.map(function(buffer){
                    buffer.play = function(){
                        if ( buffer.buffer) {
                            playSound(buffer.buffer);
                        }
                    };
                    return buffer;
                });
            }, function(err){
                return null;
            });
        }
    };
}]);