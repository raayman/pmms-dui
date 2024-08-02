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
    var source;

    if (player.youTubeApi) {
        var html5Player = player.youTubeApi.getIframe().contentWindow.document.querySelector('.html5-main-video');
        source = context.createMediaElementSource(html5Player);
        // Inject ad-blocking functionality
        handleYouTubePlayer(player.youTubeApi);
    } else if (player.hlsPlayer) {
        source = context.createMediaElementSource(player.hlsPlayer.media);
    } else if (player.originalNode) {
        source = context.createMediaElementSource(player.originalNode);
    } else {
        source = context.createMediaElementSource(player);
    }

    if (source) {
        var splitter = context.createChannelSplitter(2);
        var merger = context.createChannelMerger(2);
        source.connect(splitter);
        splitter.connect(merger, 0, 0);
        splitter.connect(merger, 1, 1);
        merger.connect(context.destination);
    }
}

// Function to handle YouTube player and skip ads
function handleYouTubePlayer(player) {
    player.addEventListener('onStateChange', function(event) {
        if (event.data === YT.PlayerState.AD_START) {
            player.seekTo(player.getDuration(), true); // Skip to end of the video
        }
    });
}

// Load YouTube IFrame Player API and create the player
function onYouTubeIframeAPIReady() {
    var player;
    if (document.getElementById('player')) {
        player = new YT.Player('player', {
            events: {
                'onReady': onPlayerReady,
                'onStateChange': onPlayerStateChange
            }
        });
    }
}

function onPlayerReady(event) {
    // Player is ready
}

function onPlayerStateChange(event) {
    if (event.data === YT.PlayerState.AD_START) {
        event.target.seekTo(event.target.getDuration(), true); // Skip to end of the video
    }
}
