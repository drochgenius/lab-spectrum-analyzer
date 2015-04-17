

var DropTarget = function()
{
    this.dropTarget;


    this.init = function()
    {
        this.dropTarget = document.getElementById( 'drop-target' );
        this.dropTarget.addEventListener( 'drop', this.drop, false );
        this.dropTarget.addEventListener( 'dragenter', this.dragHandler, false );
        this.dropTarget.addEventListener( 'dragover', this.dragHandler, false );
        this.dropTarget.addEventListener( 'dragleave', this.dragHandler.bind(this), false );
    };

    this.drop = function( e )
    {
        e.stopPropagation();
        e.preventDefault();

        lab.updateNote('Loading...');

        var data = e.dataTransfer || e.originalEvent.dataTransfer;
        if ( data.files.length > 0
                && data.files[0].name.indexOf( '.mp3' ) > -1
                )
        {
            // Ref: http://stackoverflow.com/questions/10413548/javascript-filereader-using-a-lot-of-memory
            var url = window.URL || window.webkitURL;
            var src = url.createObjectURL( data.files[0] );
            lab.updateNote( data.files[0].name )
            lab.loadSong( src );
        }
        else if ( data.getData("URL").indexOf('soundcloud.com') > -1 )
        {
            lab.loadSongFromSC( data.getData("URL") );
        }
        else
        {
            lab.updateNote( "Sorry, that didn't work - try something else." )
        }

        e.currentTarget.classList.remove( 'over' );

        return false;
    };

    this.dragHandler = function(e)
    {
        if ( e.type == 'dragover' )
        {
            e.stopPropagation();
            e.preventDefault();
        }
        else if ( e.type == 'dragenter' )
        {
            $('#drop-target').addClass( 'over' );
        }
        else if ( e.type == 'dragleave' )
        {
            $('#drop-target').removeClass( 'over' );
        }
    };
};

var drop = new DropTarget();
drop.init();



var SpectrumAnalyzer = function()
{
    this.audio;
    this.audioContext;
    this.audioAnimation;
    this.sourceNode;
    this.analyser;

    this.supportsWebAudio = false;
    this.fftSize = 256;
    this.renderer = null;
    this.timeout = null;


    // Initialize - and grab an SC URL?
    this.init = function()
    {
        // Initialize existing links
        var els = document.querySelectorAll('.song');
        for ( var i = 0; i < els.length; i++ )
            els[i].addEventListener( 'click', this.loadDefaultSong.bind( this ) );

        this.initAudio();

        if ( ! this.supportsWebAudio )
            document.querySelector('p.compatibility').innerHTML = "(Note, your browser does not support WebAudio)";

        this.renderer.init();

        // Check for URL to load
        var url = this.getURL();
        if ( url != null )
        {
            this.loadSongFromSC( url );
        }

        this.hideNav();

        window.addEventListener( 'mousemove', this.mouseHandler.bind(this) );
        window.addEventListener( 'resize', this.resize.bind(this) );
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


        this.audio.addEventListener("canplay", function(e) {
            // Hide loading graphic

            // Does nothing in FF
            if ( this.supportsWebAudio )
            {
                this.setupAudioNodes();
            }
            else
            {
                this.audio.play();
            }

        }.bind(this), false);
        this.audio.addEventListener("playing", function(e) {
            // console.log( "Playing a duration of", this.audio.duration );
        }, false);
        this.audio.addEventListener("timeupdate", function(e) {
            // console.log( "timeupdate" );
        }, false);
        this.audio.addEventListener("pause", function(e) {
            // $('#drop-target').removeClass('over');
            // $('#drop-target').show();
        }, false);
        this.audio.addEventListener("play", function(e) {
            // $('#drop-target').removeClass('over');
            // $('#drop-target').hide();
        }, false);
    };



    this.mouseHandler = function(e)
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
        }, 5000 );
    };

    this.loadDefaultSong = function(e)
    {
        e.preventDefault();

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

    this.updateNote = function( str )
    {
        document.querySelector('p.note').innerHTML = str;
    };



    this.loadSong = function(url)
    {
        if (this.sourceNode) this.sourceNode.disconnect();

        cancelAnimationFrame( this.audioAnimation );

        this.audio.src = url;
    };

    // Resolve SC stream from URL
    this.loadSongFromSC = function( url )
    {
        var scClientId = 'a20b2507998bc9f8f0874f12de0efb84';
        var resolvedUrl = 'http://api.soundcloud.com/resolve.json?url=' + url + '&client_id=' + scClientId;

        this.updateNote('Loading...');

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

                    var el = document.querySelector('p.note');
                    if ( el.childNodes.length > 0 )
                        el.removeChild( el.childNodes[0] );

                    el.appendChild( a );

                    var songUrl = result.stream_url + '?client_id=' + scClientId;
                    this.loadSong( songUrl );

                    // Update location for linking
                    this.setURL( url );

                    _gaq.push(['_trackPageview']);
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






    this.resize = function(e)
    {
        WIDTH = window.innerWidth;
        HEIGHT = window.innerHeight;

        this.renderer.resize( WIDTH, HEIGHT );
    };

    this.getURL = function()
    {
        if ( window.location.href.indexOf( '?url=' ) > -1 )
            return decodeURIComponent( window.location.href.substr( window.location.href.indexOf( '?url=' ) + 5 ) );

        return null;
    };

    this.setURL = function( url )
    {
        if ( this.getURL() == url )
            return;

        var pos = ( window.location.href.indexOf( '?url=' ) == -1 ) ? window.location.href.length : window.location.href.indexOf( '?url=' ) ;
        var location = window.location.href.substr( 0, pos ) + '?url=' + encodeURIComponent( url );

        // Need to support updates when state changes
        window.history.pushState( {}, "", location );
    }
};


var CanvasRenderer = function()
{
    var canvas = document.getElementById('songcanvas');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    WIDTH = canvas.width;
    HEIGHT = canvas.height;
    var canvasContext = canvas.getContext("2d");


    var colours = document.getElementById('colourTable');
    var coloursContext = colours.getContext("2d");




    // Loop keeps playing even when no sound
    this.init = function()
    {
        // Colours
        var gradient = coloursContext.createLinearGradient(0,0,0,colours.height);
        gradient.addColorStop(0,'#ffcc00');
        gradient.addColorStop(0.5,'#006600');
        gradient.addColorStop(1.0,'#000066');
        coloursContext.fillStyle = gradient;
        coloursContext.fillRect( 0, 0, colours.width, colours.height );

        // Add noise
        var offsetX = colours.width * 0.075;
        var x,y;
        for ( var i = 0; i < 2500; i++ )
        {
            x = Math.floor( colours.width * Math.random() * 0.85 );
            y = Math.floor( colours.height * Math.random() );

            coloursContext.fillStyle = 'rgba( 255, 255, 255, 0.2 )';
            coloursContext.fillRect( x  + offsetX, y, 1, 1 );
            coloursContext.fill();
        }

        // Highlight
        gradient = coloursContext.createLinearGradient(0,0,colours.width,0);
        gradient.addColorStop( 0.1, "rgba( 255, 255, 255, 0 )" );
        gradient.addColorStop( 0.3, "rgba( 255, 255, 255, 0.25 )" );
        gradient.addColorStop( 0.485, "rgba( 255, 255, 255, 0.6 )" );
        gradient.addColorStop( 0.49, "rgba( 255, 255, 255, 0.8 )" );
        gradient.addColorStop( 0.5, "rgba( 255, 255, 255, 0.6 )" );
        gradient.addColorStop( 0.51, "rgba( 255, 255, 255, 0.8 )" );
        gradient.addColorStop( 0.515, "rgba( 255, 255, 255, 0.6 )" );
        gradient.addColorStop( 0.7, "rgba( 255, 255, 255, 0.25 )" );
        gradient.addColorStop( 0.9, "rgba( 255, 255, 255, 0 )" );
        coloursContext.fillStyle = gradient;
        coloursContext.fillRect( 0, 0, colours.width, colours.height );
    };

    this.render = function( values )
    {
        var h = canvas.height / values.length;
        var w = canvas.width / colours.width;
        var value;
        var x, y, sy;
        // console.log( h, w );

        canvasContext.clearRect(0, 0, WIDTH, HEIGHT);

        /*
         // Not a very interesting effect, could be better to play around with the form's boundary?
         canvasContext.fillStyle = "rgba( 0,0,0,0.2 )";
         canvasContext.rect(0, 0, WIDTH, HEIGHT);
         canvasContext.fill();
         */

        for ( var i = 0; i < ( values.length ); i++ )
        {
            value = values[i] * canvas.width;

            x = ( canvas.width - value ) * 0.5;
            y = canvas.height - h * i;
            sy = colours.height - ( i / values.length * colours.height );
            // console.log( sy );

            canvasContext.drawImage( colours, 0, sy, colours.width, 1, x, y, value, h - 1 );
        }
    };

    this.resize = function( w, h )
    {
        canvas.setAttribute( 'height', h );
        canvas.setAttribute( 'width', w );

        canvas.height = h;
        canvas.width = w;
    }
};

