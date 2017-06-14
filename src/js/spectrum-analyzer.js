
import DefaultRenderer from './renderers/DefaultRenderer';
import WebGlRenderer from './renderers/WebGlRenderer';


/**
 * App logic
 */
var SpectrumAnalyzer = function()
{
    this.audio;
    this.audioContext;
    this.audioAnimation;
    this.sourceNode;
    this.analyser;

    this.supportsWebAudio = false;
    this.fftSize = 256;

    // Set to 'new <renderer>()' from /renderers
    this.renderer = null;
    this.timeout = null;
    this.baseURL = 'https://soundcloud.com/';


    // Initialize - and grab an SC URL?
    this.init = function(playDefault)
    {
        // Initialize existing links
        var els = document.querySelectorAll('.song');
        for ( var i = 0; i < els.length; i++ ) {
            els[i].addEventListener( 'click', this.loadSongFromClick.bind( this ) );
        }

        this.initAudio();

        if ( ! this.supportsWebAudio )
            document.querySelector('p.compatibility').innerHTML = "(Your browser does not support WebAudio)";

        // TODO: Check support for WebGL and if so:
        // this.renderer = new WebGlRenderer();
        //
        // Check renderer
        if (this.renderer) {
            console.log('Found renderer', this.renderer);
        } else {
            console.warn('No renderer set, fall back to default');
            this.renderer = new DefaultRenderer();
        }

        this.renderer.init();

        var dropTarget = document.getElementById( 'drop-target' );
        dropTarget.addEventListener( 'drop', this.dropHandler.bind(this), false );
        dropTarget.addEventListener( 'dragenter', this.dragHandler.bind(this), false );
        dropTarget.addEventListener( 'dragover', this.dragHandler.bind(this), false );
        dropTarget.addEventListener( 'dragleave', this.dragHandler.bind(this), false );

        window.addEventListener( 'hashchange', this.hashChange.bind(this) );
        window.addEventListener( 'mousemove', this.mouseHandler.bind(this) );
        window.addEventListener( 'resize', this.resize.bind(this) );

        this.hideNav();

        // Check for URL to load
        var url = this.getURL();
        if (url != null)
        {
            this.loadSongFromSC(url);

            // Load track now because URL will be disregarded in setURL (??)
            this.trackEvent('Load SoundCloud URL', url, null, false);

        // Play default song
        } else if (playDefault) {
            this.updateStatus('Loading in 5s...');

            var time = new Date().getTime();
            this.defaultInterval = setInterval(function() {
                this.initDefaultPlayback(time);
            }.bind(this), 1000);
        }
    };

    this.defaultInterval = null;
    this.defaultTime = null;

    this.initDefaultPlayback = function(time) {
        var delta = new Date().getTime() - time;
        if (delta < 5000) {
            var msg = 'Loading in ' + Math.round(5 - delta / 1000) + 's...';
            this.updateStatus(msg);

        } else {
            clearTimeout(this.defaultInterval);

            var url = document.querySelector('.song').getAttribute('href');
            this.loadSongFromSC(url);
        }
    };

    this.initAudio = function()
    {
        if ( typeof AudioContext !== "undefined" || typeof webkitAudioContext !== "undefined" )
        {
            this.audioContext = ( AudioContext ) ? new AudioContext() : new webkitAudioContext() ;
            this.supportsWebAudio = true;
        }

        this.audio = document.getElementsByTagName('audio')[0];
        this.audio.setAttribute( 'crossOrigin', 'anonymous' );
        this.audio.setAttribute( 'preload', 'auto' );

        // Older versions of FF?
        var canPlay = !! ( this.audio.canPlayType && this.audio.canPlayType('audio/mpeg;').replace(/no/, ''));
        if ( ! canPlay )
        {
            alert( "Doesn't support playback" );
            return;
        }

        this.audio.addEventListener("canplay", this.audioHandler.bind(this), false );
        this.audio.addEventListener("playing", this.audioHandler.bind(this), false );
        this.audio.addEventListener("timeupdate", this.audioHandler.bind(this), false );
        this.audio.addEventListener("pause", this.audioHandler.bind(this), false );
        this.audio.addEventListener("play", this.audioHandler.bind(this), false );

        // Debug
        this.audio.addEventListener("seeked", this.audioHandler.bind(this), false ); // Occasionally not firing in Chrome
        // this.audio.addEventListener("seeking", this.audioHandler.bind(this), false );
        // this.audio.addEventListener("emptied", this.audioHandler.bind(this), false );
        // this.audio.addEventListener("abort", this.audioHandler.bind(this), false );
        // this.audio.addEventListener("ended", this.audioHandler.bind(this), false );
    };


    /** Event handlers **/

    this.audioHandler = function(e)
    {
        // console.log(e.type);

        if (e.type == 'canplay')
        {
            // Hide loading graphic

            if ( this.supportsWebAudio )
            {
                cancelAnimationFrame( this.audioAnimation );
                this.setupAudioNodes();
            }
            else
            {
                this.audio.play();
            }
        }
        else if (e.type == 'playing')
        {
            // console.log( "Playing a duration of", this.audio.duration );
        }
        else if (e.type == 'timeupdate')
        {
        }
        else if (e.type == 'pause')
        {
        }
        else if (e.type == 'play')
        {
        }
    };

    this.dropHandler = function( e )
    {
        e.stopPropagation();
        e.preventDefault();

        this.updateStatus('Loading...');

        var data = e.dataTransfer || e.originalEvent.dataTransfer;
        if ( data.files.length > 0
                && data.files[0].name.indexOf( '.mp3' ) > -1
                )
        {
            // Ref: http://stackoverflow.com/questions/10413548/javascript-filereader-using-a-lot-of-memory
            var url = window.URL || window.webkitURL;
            var src = url.createObjectURL( data.files[0] );
            this.updateStatus( data.files[0].name );
            this.loadSong( src );
        }
        else if ( data.getData("URL").indexOf('soundcloud.com') > -1 )
        {
            this.loadSongFromSC( data.getData("URL") );
        }
        else
        {
            this.updateStatus( "Sorry, that didn't work - try something else." )
        }

        e.currentTarget.classList.remove( 'over' );

        return false;
    };

    this.dragHandler = function(e)
    {
        // Unclear what this does..
        if ( e.type == 'dragover' )
        {
            e.stopPropagation();
            e.preventDefault();
        }
        else if ( e.type == 'dragenter' )
        {
            document.querySelector('#drop-target').classList.add( 'over' );
        }
        else if ( e.type == 'dragleave' )
        {
            document.querySelector('#drop-target').classList.remove( 'over' );
        }
    };

    this.mouseHandler = function(e)
    {
        this.showNav();
    };

    this.resize = function(e)
    {
        var WIDTH = window.innerWidth;
        var HEIGHT = window.innerHeight;

        if (this.renderer) {
            this.renderer.resize( WIDTH, HEIGHT );
        } else {
            console.warn('No renderer set');
        }
    };

    this.hashChange = function(e)
    {
        if ( e.newURL != this.getURL() )
            this.loadSongFromSC( this.getURL(e.newURL) );
    };


    /** Nav **/

    this.showNav = function()
    {
        var els = document.querySelectorAll('.nav');
        for ( var i = 0; i < els.length; i++ )
            els[i].classList.remove('hide');

        this.hideNav();
    };

    this.hideNav = function()
    {
        if ( this.timeout )
            clearTimeout( this.timeout );

        this.timeout = setTimeout( function(e) {
            var els = document.querySelectorAll('.nav');
            for ( var i = 0; i < els.length; i++ )
                els[i].classList.add('hide');
        }, 3500 );
    };


    /** Web audio **/

    this.setupAudioNodes = function()
    {
        this.analyser = (this.analyser || this.audioContext.createAnalyser());
        this.analyser.smoothingTimeConstant = 0.25; // 0.7;
        this.analyser.fftSize = this.fftSize;

        // Firefox used to fail silently at this point
        // Ref: https://bugzilla.mozilla.org/show_bug.cgi?id=937718
        //
        // Triggers error in Chrome when seeking position via media UI
        this.sourceNode = (this.sourceNode || this.audioContext.createMediaElementSource(this.audio));
        this.sourceNode.connect(this.analyser);
        this.sourceNode.connect(this.audioContext.destination);

        this.audio.play();

        this.update();
    };

    this.update = function()
    {
        // console.log('update');

        var array =  new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.getByteFrequencyData(array);

        // Normalize values to 0-1
        var values = [];
        for ( var i = 0; i < (array.length); i++ )
        {
            values[ i ] = array[ i ] / 255;
        }

        this.renderer.render( values );

        this.audioAnimation = requestAnimationFrame( this.update.bind(this) );
    };

    this.updateStatus = function( str )
    {
        document.querySelector('p.status').innerHTML = str;
    };



    this.loadSongFromClick = function(e)
    {
        e.preventDefault();


        // Unstyle links
        document.querySelectorAll('.song').forEach(el => {
            el.classList.remove('enabled');
        });

        // Style active link
        e.currentTarget.classList.add('enabled');


        var path = e.currentTarget.getAttribute('href');
        if ( path.indexOf( 'soundcloud' ) > -1 )
        {
            this.loadSongFromSC( path );
        }
        else
        {
            this.loadSong( path );
        }
    };

    // Resolve SC stream from URL
    this.loadSongFromSC = function( url )
    {
        var scClientId = 'a20b2507998bc9f8f0874f12de0efb84';
        var resolvedUrl = 'http://api.soundcloud.com/resolve.json?url=' + url + '&client_id=' + scClientId;

        this.updateStatus('Loading...');

        $.ajax({
            url: resolvedUrl,
            type: 'GET',
            success: function( result )
            {
                // console.log( result );
                if ( result.streamable )
                {
                    var a = document.createElement('a');
                    a.appendChild( document.createTextNode( result.title ) );
                    a.setAttribute( 'href', result.permalink_url );

                    var el = document.querySelector('p.status');
                    if ( el.childNodes.length > 0 )
                        el.removeChild( el.childNodes[0] );

                    el.appendChild( a );

                    var songUrl = result.stream_url + '?client_id=' + scClientId;
                    this.loadSong( songUrl );

                    // Update location for linking
                    this.setURL( url );
                }
                else
                {
                    alert( "Sorry, that link can't be streamed" );
                }
            }.bind(this),
            error: function( data ) {
                alert( "Sorry, that link couldn't be streamed.." );
            }
        });
    };

    // Load an alreadu-resolved SC URL
    this.loadSong = function(url)
    {
        if (this.sourceNode) this.sourceNode.disconnect();

        this.audio.src = url;
    };



    /** Getters and setters **/

    this.getURL = function( url )
    {
        if ( url )
            return this.baseURL + url.substr( url.indexOf( 'url=' ) + 4 );

        if ( window.location.href.indexOf( 'url=' ) > -1 )
            return this.baseURL + window.location.hash.substr( window.location.hash.indexOf( 'url=' ) + 4 );

        return null;
    };

    this.setURL = function( url )
    {
        if ( this.getURL() == url )
            return;

        this.trackEvent( 'Load SoundCloud URL', url, null, false );

        url = url.replace( this.baseURL,'' );
        window.location.hash = 'url=' + url;
    };



    /** CONVENIENCE **/

    this.trackEvent = function( action, label, value, noninteraction ) {};
};


export default SpectrumAnalyzer;