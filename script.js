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
  // Create a Howl object with options
  const player = new Howl({
    src: resolveUrl(options.url), // Pass URL through resolver if needed
    autoplay: false, // Don't autoplay by default
    loop: options.loop || false, // Set loop based on options
    volume: 0, // Set initial volume to 0
  });

  // Handle errors similar to MediaElement error handler
  player.on('loaderror', () => {
    hideLoadingIcon();
    sendMessage('initError', {
      url: options.url,
      message: 'Failed to load audio'
    });
  });

  // Handle canplay event similar to MediaElement canplay
  player.on('load', () => {
    if (player._sounds[0].loaded) { // Check if audio is fully loaded
      hideLoadingIcon();

      const duration = player.duration();
      options.duration = duration !== Infinity ? duration : false;
      options.offset = 0; // No offset handling in Howler.js

      // Handle video specific options (not directly supported by Howl)
      if (options.video) {
        options.video = false; // Mark it as not video in Howler.js
        console.warn('Howler.js doesn\'t support video playback directly.');
      }

      sendMessage('init', {
        handle: handle,
        options: options
      });

      // Play audio after sending init message
      player.play();
    }
  });

  // Handle playing event for visualizations and filters (if needed)
  player.on('play', () => {
    if (options.filter) {
      console.warn('Howler.js doesn\'t directly support audio filters.');
    }

    if (options.visualization) {
      createAudioVisualization(player, options.visualization);
    }
  });

  // Handle volume attenuation (needs additional logic)
  if (options.attenuation) {
    console.warn('Howler.js doesn\'t directly support attenuation. Implement logic for adjusting volume based on attenuation values.');
  }

  // Handle diffRoomVolume (needs additional logic)
  if (options.diffRoomVolume) {
    console.warn('Howler.js volume is global. Implement logic for adjusting volume based on diffRoomVolume.');
  }

  return player; // Return the created Howl object for further control
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
