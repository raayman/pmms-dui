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

function applyPhonographFilter(sound) {
    sound._node.forEach(node => {
        let context = node._audioNode[0].context;
        let source = node._audioNode[0];
        
        let gainNode = context.createGain();
        gainNode.gain.value = 0.5;

        let lowpass = context.createBiquadFilter();
        lowpass.type = 'lowpass';
        lowpass.frequency.value = 3000;

        let highpass = context.createBiquadFilter();
        highpass.type = 'highpass';
        highpass.frequency.value = 300;

        source.connect(gainNode);
        gainNode.connect(lowpass);
        lowpass.connect(highpass);
        highpass.connect(context.destination);
    });
}

function applyRadioFilter(sound) {
    sound._node.forEach(node => {
        let context = node._audioNode[0].context;
        let source = node._audioNode[0];
        
        let gainNode = context.createGain();
        gainNode.gain.value = 0.5;

        let lowpass = context.createBiquadFilter();
        lowpass.type = 'lowpass';
        lowpass.frequency.value = 5000;

        let highpass = context.createBiquadFilter();
        highpass.type = 'highpass';
        highpass.frequency.value = 200;

        source.connect(gainNode);
        gainNode.connect(lowpass);
        lowpass.connect(highpass);
        highpass.connect(context.destination);
    });
}

function createAudioVisualization(player, visualization) {
	// Visualization code remains unchanged
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
    var player = document.createElement('div');
    player.id = id;
    document.body.appendChild(player);

    if (options.attenuation == null) {
        options.attenuation = { sameRoom: 0, diffRoom: 0 };
    }

    var sound = new Howl({
        src: [resolveUrl(options.url)],
        volume: options.diffRoomVolume || 0,
        onloaderror: function(id, error) {
            hideLoadingIcon();
            sendMessage('initError', {
                url: options.url,
		id:id,
                message: error
            });
            sound.unload();
        },
        onplayerror: function(id, error) {
            hideLoadingIcon();
            sendMessage('playError', {
                url: options.url,
                message: error.message
            });
            sound.unload();
        },
        onload: function() {
            hideLoadingIcon();

            options.duration = sound.duration();
            options.video = false;

            sendMessage('init', {
                handle: handle,
                options: options
            });

            sound.play();
        },
        onplay: function() {
            if (options.filter) {
                applyAudioFilter(sound);
            }
        }
    });

    sound.play();
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

function play(handle) {
	var player = getPlayer(handle);
	if (player && player.sound) {
		player.sound.play();
	}
}

function stop(handle) {
	var player = getPlayer(handle);
	if (player && player.sound) {
		player.sound.stop();
		player.remove();
	}
}

function setAttenuationFactor(player, target) {
	if (player.sound._volume > target) {
		player.sound.volume(player.sound._volume - 0.1);
	} else {
		player.sound.volume(player.sound._volume + 0.1);
	}
}

function setVolumeFactor(player, target) {
	if (player.sound._volume > target) {
		player.sound.volume(player.sound._volume - 0.01);
	} else {
		player.sound.volume(player.sound._volume + 0.01);
	}
}

function update(data) {
	var player = getPlayer(data.handle, data.options);

	if (player && player.sound) {
		if (data.options.paused || data.distance < 0 || data.distance > data.options.range) {
			if (player.sound.playing()) {
				player.sound.pause();
			}
		} else {
			if (data.sameRoom) {
				setAttenuationFactor(player, data.options.attenuation.sameRoom);
				setVolumeFactor(player, 1.0);
			} else {
				setAttenuationFactor(player, data.options.attenuation.diffRoom);
				setVolumeFactor(player, data.options.diffRoomVolume);
			}

			if (player.sound._state === 'loaded') {
				var volume;
				if (data.options.muted || data.volume == 0) {
					volume = 0;
				} else {
					volume = (((100 - data.distance * player.sound._volume) / 100) * player.sound._volume) * (data.volume / 100);
				}

				if (volume > 0) {
					if (data.distance > 100) {
						player.sound.volume(volume);
					} else {
						player.sound.volume(volume);
					}
				} else {
					player.sound.volume(0);
				}

				if (data.options.duration) {
					var currentTime = data.options.offset % player.sound.duration();
					if (Math.abs(currentTime - player.sound.seek()) > maxTimeDifference) {
						player.sound.seek(currentTime);
					}
				}

				if (!player.sound.playing()) {
					player.sound.play();
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
			init(event.data.data);
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
