const maxTimeDifference = 2;

var resourceName = 'pmms';
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
    });
}

function applyPhonographFilter(player) {
    var context = new (window.AudioContext || window.webkitAudioContext)();
    var source = context.createMediaElementSource(player._sounds[0]._node);

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

    var noise = new Howl({
        src: ['https://redm.khzae.net/phonograph/noise.webm'],
        volume: 0,
        html5: true
    });

    player.noise = noise;
    noise.play();

    player._sounds[0]._node.style.filter = 'sepia()';

    player.on('play', () => {
        noise.play();
    });
    player.on('pause', () => {
        noise.pause();
    });
    player.on('volume', () => {
        noise.volume(player.volume());
    });
    player.on('seek', () => {
        noise.seek(player.seek());
    });
}

function applyRadioFilter(player) {
    var context = new (window.AudioContext || window.webkitAudioContext)();
    var source = context.createMediaElementSource(player._sounds[0]._node);

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
    waveCanvas.id = player.id + '_visualization';
    waveCanvas.style.position = 'absolute';
    waveCanvas.style.top = '0';
    waveCanvas.style.left = '0';
    waveCanvas.style.width = '100%';
    waveCanvas.style.height = '100%';

    document.body.appendChild(waveCanvas);

    var options = audioVisualizations[visualization] || {};
    options.element = waveCanvas;
    options.type = options.type || visualization;

    var wave = new Wave();
    wave.fromElement(player._sounds[0]._node.id, waveCanvas.id, options);
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
    var playerContainer = document.createElement('div');
    playerContainer.id = id;
    document.body.appendChild(playerContainer);

    if (options.attenuation == null) {
        options.attenuation = {sameRoom: 0, diffRoom: 0};
    }

    const sound = new Howl({
        src: [resolveUrl(options.url)],
        html5: true,
        volume: 0,
        onloaderror: function(id, error) {
            hideLoadingIcon();
            sendMessage('initError', {
                url: options.url,
                message: error
            });
        },
        onplayerror: function(id, error) {
            hideLoadingIcon();
            sendMessage('playError', {
                url: options.url,
                message: error
            });
            if (!sound._pmms.initialized) {
                sound.unload();
            }
        },
        onload: function() {
            hideLoadingIcon();
            sound._pmms = {
                initialized: false,
                attenuationFactor: options.attenuation.diffRoom,
                volumeFactor: options.diffRoomVolume
            };

            if (!isFinite(sound.duration()) || sound.duration() === 0) {
                options.offset = 0;
                options.duration = false;
                options.loop = false;
            } else {
                options.duration = sound.duration();
            }

            options.video = true;
            options.videoSize = 0;

            sendMessage('init', {
                handle: handle,
                options: options
            });

            sound._pmms.initialized = true;
            sound.play();
        },
        onplay: function() {
            if (options.filter && !sound._pmms.filterAdded) {
                if (isRDR) {
                    applyPhonographFilter(sound);
                } else {
                    applyRadioFilter(sound);
                }
                sound._pmms.filterAdded = true;
            }

            if (options.visualization && !sound._pmms.visualizationAdded) {
                createAudioVisualization(sound, options.visualization);
                sound._pmms.visualizationAdded = true;
            }
        }
    });

    playerContainer.sound = sound;
    return sound;
}

function getPlayer(handle, options) {
    if (handle == undefined) {
        return;
    }

    var id = 'player_' + handle.toString();
    var playerContainer = document.getElementById(id);

    if (!playerContainer && options && options.url) {
        playerContainer = initPlayer(id, handle, options);
    }

    return playerContainer ? playerContainer.sound : null;
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
    if (player && !player.playing()) {
        player.play();
    }
}

function stop(handle) {
    var player = getPlayer(handle);

    if (player) {
        if (player.noise) {
            player.noise.unload();
        }
        player.unload();
    }
}

function setAttenuationFactor(player, target) {
    if (player._pmms.attenuationFactor > target) {
        player._pmms.attenuationFactor -= 0.1;
    } else {
        player._pmms.attenuationFactor += 0.1;
    }
}

function setVolumeFactor(player, target) {
    if (player._pmms.volumeFactor > target) {
        player._pmms.volumeFactor -= 0.01;
    } else {
        player._pmms.volumeFactor += 0.01;
    }
}

function setVolume(player, target) {
    if (Math.abs(player.volume() - target) > 0.1) {
        if (player.volume() > target) {
            player.volume(player.volume() - 0.05);
        } else {
            player.volume(player.volume() + 0.05);
        }
    }
}

function update(data) {
    var player = getPlayer(data.handle, data.options);

    if (player && player._pmms) {
        if (data.options.paused || data.distance < 0 || data.distance > data.options.range) {
            if (player.playing()) {
                player.pause();
            }
        } else {
            if (data.sameRoom) {
                setAttenuationFactor(player, data.options.attenuation.sameRoom);
                setVolumeFactor(player, 1.0);
            } else {
                setAttenuationFactor(player, data.options.attenuation.diffRoom);
                setVolumeFactor(player, data.options.diffRoomVolume);
            }

            var volume;
            if (data.options.muted || data.volume == 0) {
                volume = 0;
            } else {
                volume = (((100 - data.distance * player._pmms.attenuationFactor) / 100) * player._pmms.volumeFactor) * (data.volume / 100);
            }

            if (volume > 0) {
                setVolume(player, volume);
            } else {
                player.volume(0);
            }

            if (data.options.duration) {
                var currentTime = data.options.offset % player.duration();

                if (Math.abs(currentTime - player.seek()) > maxTimeDifference) {
                    player.seek(currentTime);
                }
            }

            if (!player.playing()) {
                player.play();
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
