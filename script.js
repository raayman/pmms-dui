const maxTimeDifference = 2;

var resourceName = 'nass_musicplayer';
var isRDR = true;
var audioVisualizations = {};
var currentServerEndpoint = '127.0.0.1:30120';


function sendMessage(name, params) {
    return fetch(`https://${resourceName}/${name}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(params)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json(); // Assuming the response is JSON
    })
    .catch(error => {
        console.error('There was a problem with the fetch operation:', error);
        return null; // Handle the error gracefully, you can return null or handle it differently based on your requirements
    });
}

function applyPhonographFilter(player) {
    var context = new (window.AudioContext || window.webkitAudioContext)();

    var source = context.createMediaElementSource(player.getIframe());

    if (source) {
        var splitter = context.createChannelSplitter(2);
        var merger = context.createChannelMerger(2);

        var gainNode = context.createGain();
        gainNode.gain.value = 0.5;

        var lowpass = context.createBiquadFilter();
        lowpass.type = 'lowpass';
        lowpass.frequency.value = 3000;
        lowpass.gain.value = -1;

        var highpass = context.createBiquadFilter();
        highpass.type = 'highpass';
        highpass.frequency.value = 300;
        highpass.gain.value = -1;

        source.connect(splitter);
        splitter.connect(merger, 0, 0);
        splitter.connect(merger, 1, 0);
        splitter.connect(merger, 0, 1);
        splitter.connect(merger, 1, 1);
        merger.connect(gainNode);
        gainNode.connect(lowpass);
        lowpass.connect(highpass);
        highpass.connect(context.destination);
    }

    var noise = document.createElement('audio');
    noise.id = player.a.id + '_noise';
    noise.src = 'https://redm.khzae.net/phonograph/noise.webm';
    noise.volume = 0;
    document.body.appendChild(noise);
    noise.play();

    player.a.style.filter = 'sepia()';

    player.addEventListener('onStateChange', event => {
        if (event.data == YT.PlayerState.PLAYING) {
            noise.play();
        } else if (event.data == YT.PlayerState.PAUSED) {
            noise.pause();
        }
    });
}

function applyRadioFilter(player) {
    var context = new (window.AudioContext || window.webkitAudioContext)();

    var source = context.createMediaElementSource(player.getIframe());

    if (source) {
        var splitter = context.createChannelSplitter(2);
        var merger = context.createChannelMerger(2);

        var gainNode = context.createGain();
        gainNode.gain.value = 0.5;

        var lowpass = context.createBiquadFilter();
        lowpass.type = 'lowpass';
        lowpass.frequency.value = 5000;
        lowpass.gain.value = -1;

        var highpass = context.createBiquadFilter();
        highpass.type = 'highpass';
        highpass.frequency.value = 200;
        highpass.gain.value = -1;

        source.connect(splitter);
        splitter.connect(merger, 0, 0);
        splitter.connect(merger, 1, 0);
        splitter.connect(merger, 0, 1);
        splitter.connect(merger, 1, 1);
        merger.connect(gainNode);
        gainNode.connect(lowpass);
        lowpass.connect(highpass);
        highpass.connect(context.destination);
    }
}

function createAudioVisualization(player, visualization) {
    var waveCanvas = document.createElement('canvas');
    waveCanvas.id = player.a.id + '_visualization';
    waveCanvas.style.position = 'absolute';
    waveCanvas.style.top = '0';
    waveCanvas.style.left = '0';
    waveCanvas.style.width = '100%';
    waveCanvas.style.height = '100%';

    document.body.appendChild(waveCanvas);

    var doc = document;

    var wave = new Wave();

    var options;

    if (visualization) {
        options = audioVisualizations[visualization] || {};

        if (options.type == undefined) {
            options.type = visualization;
        }
    } else {
        options = {type: 'cubes'}
    }

    options.skipUserEventsWatcher = true;
    options.elementDoc = doc;

    wave.fromElement(player.a.id, waveCanvas.id, options);
}

function showLoadingIcon() {
    document.getElementById('loading').style.display = 'block';
}

function hideLoadingIcon() {
    document.getElementById('loading').style.display = 'none';
}

function resolveUrl(url) {
    if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
    } else {
        return 'http://' + currentServerEndpoint + '/pmms/media/' + url;
    }
}

function initPlayer(id, handle, options) {
    var player = new YT.Player(id, {
        videoId: options.url,
        events: {
            'onReady': function(event) {
                hideLoadingIcon();
                event.target.playVideo();
            },
            'onStateChange': function(event) {
                if (event.data == YT.PlayerState.PLAYING) {
                    if (options.filter && !event.target.filterAdded) {
                        if (isRDR) {
                            applyPhonographFilter(event.target);
                        } else {
                            applyRadioFilter(event.target);
                        }
                        event.target.filterAdded = true;
                    }
                }
            }
        }
    });

    document.body.appendChild(player.a);

    return player;
}

function getPlayer(handle, options) {
    if (handle == undefined) {
        return;
    }

    var id = 'player_' + handle.toString();

    var player = YT.get(id);

    if (!player && options && options.url) {
        player = initPlayer(id, handle, options);
    }

    return player;
}

function parseTimecode(timecode) {
    if (typeof timecode != "string") {
        return timecode;
    } else if (timecode.includes(':')) {
        var a = timecode.split(':');
        return parseInt(a[0]) * 3600 + parseInt(a[1]) * 60 + parseInt(a[2]);
    } else {
        return parseInt(timecode);
    }
}

function init(data) {
    if (data.url == '') {
        return;
    }

    showLoadingIcon();

    data.options.offset = parseTimecode(data.options.offset);

    if (!data.options.title) {
        data.options.title = data.options.url;
    }

    getPlayer(data.handle, data.options);
}

function play(handle) {
    var player = getPlayer(handle);
    if (player) {
        player.playVideo();
    }
}

function stop(handle) {
    var player = getPlayer(handle);

    if (player) {
        var noise = document.getElementById(player.a.id + '_noise');
        if (noise) {
            noise.remove();
        }

        player.stopVideo();
        document.body.removeChild(player.a);
    }
}

function setAttenuationFactor(player, target) {
    if (player.pmms.attenuationFactor > target) {
        player.pmms.attenuationFactor -= 0.1;
    } else {
        player.pmms.attenuationFactor += 0.1;
    }
}

function setVolumeFactor(player, target) {
    if (player.pmms.volumeFactor > target) {
        player.pmms.volumeFactor -= 0.01;
    } else {
        player.pmms.volumeFactor += 0.01;
    }
}

function setVolume(player, target) {
    if (Math.abs(player.getVolume() - target * 100) > 10) {
        if (player.getVolume() > target * 100) {
            player.setVolume(player.getVolume() - 5);
        } else {
            player.setVolume(player.getVolume() + 5);
        }
    }
}

function update(data) {
    var player = getPlayer(data.handle, data.options);

    if (player) {
        if (data.options.paused || data.distance < 0 || data.distance > data.options.range) {
            if (player.getPlayerState() == YT.PlayerState.PLAYING) {
                player.pauseVideo();
            }
        } else {
            if (data.sameRoom) {
                setAttenuationFactor(player, data.options.attenuation.sameRoom);
                setVolumeFactor(player, 1.0);
            } else {
                setAttenuationFactor(player, data.options.attenuation.diffRoom);
                setVolumeFactor(player, data.options.diffRoomVolume);
            }

            if (player.getPlayerState() != YT.PlayerState.UNSTARTED) {
                var volume;

                if (data.options.muted || data.volume == 0) {
                    volume = 0;
                } else {
                    volume = (((100 - data.distance * player.pmms.attenuationFactor) / 100) * player.pmms.volumeFactor) * (data.volume / 100);
                }

                if (volume > 0) {
                    if (data.distance > 100) {
                        setVolume(player, volume);
                    } else {
                        player.setVolume(volume * 100);
                    }
                } else {
                    player.setVolume(0);
                }

                if (data.options.duration) {
                    var currentTime = data.options.offset % player.getDuration();

                    if (Math.abs(currentTime - player.getCurrentTime()) > maxTimeDifference) {
                        player.seekTo(currentTime);
                    }
                }

                if (player.getPlayerState() == YT.PlayerState.PAUSED) {
                    player.playVideo();
                }
            }
        }
    }
}

function setResourceNameFromUrl() {
    var url = new URL(window.location);
    var params = new URLSearchParams(url.search);
    resourceName = params.get('resourceName') || resourceName;
}

window.addEventListener('message', event => {
    switch (event.data.type) {
        case 'init':
            init(event.data);
            break;
        case 'play':
            play(event.data.handle);
            break;
        case 'stop':
            stop(event.data.handle);
            break;
        case 'update':
            update(event.data);
            break;
        case 'DuiBrowser:init':
            sendMessage('DuiBrowser:initDone', {handle: event.data.handle});
            break;
    }
});

window.addEventListener('load', () => {
    setResourceNameFromUrl();

    sendMessage('duiStartup', {}).then(resp => resp.json()).then(resp => {
        if (resp.isRDR != undefined) {
            isRDR = resp.isRDR;
        }
        if (resp.audioVisualizations != undefined) {
            audioVisualizations = resp.audioVisualizations;
        }
        if (resp.currentServerEndpoint != undefined) {
            currentServerEndpoint = resp.currentServerEndpoint;
        }
    });
});

