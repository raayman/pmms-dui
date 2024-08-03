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

function initYouTubePlayer(playerId, videoId, options) {
    return new YT.Player(playerId, {
        videoId: videoId,
        playerVars: {
            'autoplay': options.autoplay ? 1 : 0,
            'controls': 1,
            'disablekb': 1,
            'modestbranding': 1,
            'rel': 0,
            'iv_load_policy': 3,
            'playsinline': 1
        },
        events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange
        }
    });
}

function onPlayerReady(event) {
    event.target.playVideo();
}

function onPlayerStateChange(event) {
    if (event.data == YT.PlayerState.UNSTARTED) {
        event.target.playVideo();
    } else if (event.data == YT.PlayerState.PLAYING) {
        // Handle ad blocking here if necessary
    }
}

function initPlayer(id, handle, options) {
    var player = document.createElement('div');
    player.id = id;
    document.body.appendChild(player);

    var videoId = extractVideoId(options.url);
    initYouTubePlayer(id, videoId, options);
}

function extractVideoId(url) {
    var videoId = '';
    var urlParts = url.split('v=');
    if (urlParts.length > 1) {
        videoId = urlParts[1].split('&')[0];
    }
    return videoId;
}

function getPlayer(handle, options) {
    if (handle == undefined) {
        return;
    }

    var id = 'player_' + handle.toString();
    var player = document.getElementById(id);

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

function showLoadingIcon() {
    document.getElementById('loading').style.display = 'block';
}

function hideLoadingIcon() {
    document.getElementById('loading').style.display = 'none';
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

function setResourceNameFromUrl() {
    var url = new URL(window.location);
    var params = new URLSearchParams(url.search);
    resourceName = params.get('resourceName') || resourceName;
}

function play(handle) {
    var player = getPlayer(handle);
}

function stop(handle) {
    var player = getPlayer(handle);

    if (player) {
        var noise = document.getElementById(player.id + '_noise');
        if (noise) {
            noise.remove();
        }

        player.remove();
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
    if (Math.abs(player.volume - target) > 0.1) {
        if (player.volume > target) {
            player.volume -= 0.05;
        } else{
            player.volume += 0.05;
        }
    }
}

function update(data) {
    var player = getPlayer(data.handle, data.options);

    if (player) {
        if (data.options.paused || data.distance < 0 || data.distance > data.options.range) {
            if (!player.paused) {
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

            if (player.readyState > 0) {
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
                        player.volume = volume;
                    }
                } else {
                    player.volume = 0;
                }

                if (data.options.duration) {
                    var currentTime = data.options.offset % player.duration;

                    if (Math.abs(currentTime - player.currentTime) > maxTimeDifference) {
                        player.currentTime = currentTime;
                    }
                }

                if (player.paused) {
                    player.play();
                }
            }
        }
    }
}
