import * as THREE from 'three';
import {
    MeshSurfaceSampler
} from "three/examples/jsm/math/MeshSurfaceSampler.js";
import gsap from "gsap";

function WebXR() { };

let XR = new WebXR();

XR.init = function(XRtype) {
    console.log('|||| Init WebXR');
    this.XRtype = XRtype;
    this.container = document.querySelector('.js-xr-container');
    this.camera;
    this.gl;
    this.scene;
    this.controls;
    this.renderer;
    this.referenceSpace;
    this.hitTestSource;
    this.hitTestResults;
    this.session;
    this.currentSession = null;
    this.controller;
    // ThreeJS
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, window.innerHeight / window.innerWidth, 1, 200);
    // Positioning
    this.viewerPosition = new THREE.Vector3();
    this.previousDistance;
    this.isClose;
    this.isTouching;
    this.showObject = true;
    // State management
    this.isHiding = true;
    this.isReadyFinding = false;
    this.isStartedFinding = false;
    this.isFound = false;
    // XR UI
    this.body = document.querySelector('body');
    this.overlay = document.querySelector('.js-ar-overlay');
    this.closeXRbtn = document.querySelector('.js-close-webxr');
    this.feedbackWarmer = document.querySelector('.js-feedback-warmer');
    this.feedbackColder = document.querySelector('.js-feedback-colder');
    this.hideUI = document.querySelector('.js-hide-ui');
    this.findUI = document.querySelector('.js-find-ui');
    this.foundUI = document.querySelector('.js-found-ui');
    this.hideBtn = document.querySelector('.js-hide-obj');
    this.findBtn = document.querySelector('.js-find-obj');
    this.timerUI = document.querySelector('.js-find-timer');
    this.playAgainBtn = document.querySelector('.js-play-again');
    this.timer;

    this.doughnutGenerator();

    this.lighting();

    this.renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true
    });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(document.body.clientWidth, document.body.clientHeight);
    this.renderer.xr.enabled = true;
    this.container.appendChild(this.renderer.domElement);

    if(this.XRtype == 'ar') {
        this.session = {
            requiredFeatures: ['local-floor', 'hit-test']
        };
    } else if (this.XRtype == 'vr') {
        this.session = {
            optionalFeatures: [ 'local-floor', 'bounded-floor', 'hand-tracking', 'hit-test' ]
        };
    }

    if (this.session.domOverlay === undefined && this.XRtype == 'ar') {

        if ( this.session.optionalFeatures === undefined) {
            this.session.optionalFeatures = [];
        }

        this.session.optionalFeatures.push('dom-overlay');
        this.session.domOverlay = {
            root: this.overlay
        };

    }

    this.setupUI();
}

XR.doughnutGenerator = function() {

    // Create doughnut
    const doughnutObjGeo = new THREE.TorusGeometry( 0.065, 0.04, 16, 100 );
    const doughnutObjMat = new THREE.MeshToonMaterial({
        color: '#D99D4F',
        transparent: true,
    });
    var doughnutObj = new THREE.Mesh( doughnutObjGeo, doughnutObjMat );
    doughnutObj.name = 'Doughnut';
    
    // Create icing (second smaller doughnut slightly shifted)
    const icingObjGeo = new THREE.TorusGeometry( 0.063, 0.041, 16, 100 );
    icingObjGeo.scale(1, 1, 0.7);
    icingObjGeo.translate(0, 0, 0.012);
    const icingObjMat = new THREE.MeshToonMaterial({
        color: '#07b0f2',
        transparent: true
    });
    var icingObj = new THREE.Mesh( icingObjGeo, icingObjMat );
    icingObj.name = 'Icing';

    // Create sprinkles
    this.sprinkles = new THREE.Group();
    var sprinkColours = ['#81C928', '#27cdf2', '#bf3f34', '#f58000', '#f2b705', '#F21F49', '#DC1FF2'];
    this.sprinkles.name = 'Sprinkles';

    const sampler = new MeshSurfaceSampler( icingObj )
	.setWeightAttribute( 'color' )
	.build();
    const _position = new THREE.Vector3();

    for ( let i = 0; i < 680; i ++ ) {
        var sprinkleGeo = new THREE.SphereGeometry( 0.0025, 12, 12 );
        var sprinkleMat =  new THREE.MeshToonMaterial({
            color: sprinkColours[Math.floor(Math.random() * sprinkColours.length)],
            transparent: true
        });
        var sprinkle = new THREE.Mesh(sprinkleGeo, sprinkleMat);

        sampler.sample( _position );

        sprinkle.position.set(_position.x, _position.y, _position.z);
        
        this.sprinkles.add( sprinkle );
    
    }

    this.hiddenObj = new THREE.Group();
    this.hiddenObj.add( doughnutObj );
    this.hiddenObj.add( icingObj );
    this.hiddenObj.add( this.sprinkles );
    this.hiddenObjOpacity = 1;

    this.scene.add( this.hiddenObj );
}

XR.lighting = function() {
    this.objectLightMain = new THREE.PointLight( '#fff', 1, 10, 2 );
    this.scene.add(this.objectLightMain);
    // this.camera.add(this.objectLightMain);
    // this.objectLightMain.position.set(1, 1, 1);

    this.objectLightFill = new THREE.PointLight( '#fff', 3, 2, 2 );
    // this.scene.add(this.objectLightFill);
    // this.hiddenObj.add(objectLightFill);
    // this.objectLightFill.position.set(-1, 1, 1);

    var ambientLight = new THREE.AmbientLight( '#fff', 0.5 )
    this.scene.add( ambientLight );
}

XR.startXRSession = function() {
    if (this.currentSession === null) {
        navigator.xr.requestSession('immersive-' + XR.XRtype, this.session).then(XR.onSessionStarted);
    }
}

XR.onSessionStarted = async function(session) {
    console.log('|||| ' + XR.XRtype.toUpperCase() + ' session started');
    XR.animate();
    session.addEventListener('end', XR.onSessionEnded);

    await XR.renderer.xr.setSession(session);
    XR.currentSession = session;

    XR.camera = new THREE.PerspectiveCamera();
    XR.camera.matrixAutoUpdate = false;

    // A 'local' reference space has a native origin that is located
    // near the viewer's position at the time the session was created.
    XR.referenceSpace = await XR.currentSession.requestReferenceSpace("local-floor").catch(e => {
        console.error(e)
    });

    // Create another XRReferenceSpace that has the viewer as the origin.
    XR.viewerSpace = await XR.currentSession.requestReferenceSpace('viewer').catch(e => {
        console.error(e)
    });

    if(XR.XRtype == 'ar') {
        // Perform hit testing using the viewer as origin.
        XR.hitTestSource = await XR.currentSession.requestHitTestSource({
            space: XR.viewerSpace
        }).catch(e => {
            console.error(e)
        });
    }

    document.querySelector('body').classList.add('has-xr');
    
    if(XR.XRtype == 'ar') {
        document.querySelector('body').classList.add('has-ar');
    }

    // XR.initControllers();

    XR.setHiding();
}

XR.onSessionEnded = async function() {

    XR.currentSession.removeEventListener('end', XR.onSessionEnded);
    XR.currentSession = null;

    document.querySelector('body').classList.remove('has-xr', 'has-ar', 'has-vr');

}

XR.animate = function() {
    XR.renderer.setAnimationLoop(XR.render);
}
var deg = 0;
XR.render = function(time, frame) {
    // console.log(renderer);

    XR.camera.getWorldPosition(XR.viewerPosition);

    if( XR.hiddenObj ) {
        // If hiding or found stick doughnut to front of viewer else leave in last recorded place
        if (XR.isHiding || XR.isFound) {
            var dist = 0.5;
            var cwd = new THREE.Vector3();
            
            XR.camera.getWorldDirection(cwd);
            
            cwd.multiplyScalar(dist);
            cwd.add(XR.camera.position);
            
            XR.hiddenObj.position.set(cwd.x, cwd.y + 0.1, cwd.z);
            XR.hiddenObj.setRotationFromQuaternion(XR.camera.quaternion);
            XR.hiddenObj.rotateX(THREE.Math.degToRad( -32 ));
            XR.hiddenObj.rotateY(THREE.Math.degToRad( -10 )); 

            XR.objectLightMain.setRotationFromQuaternion(XR.camera.quaternion);
            XR.objectLightMain.position.set(cwd.x + 0.5, cwd.y + 0.2, cwd.z + 0.5);
            XR.objectLightFill.position.set(cwd.x, cwd.y + 0.09, cwd.z);

            if (XR.isFound) {
                deg += 1;
                XR.hiddenObj.rotateZ(THREE.Math.degToRad( deg ));
            }        
    
        } else if ( XR.isReadyFinding ) {
    
            XR.fadeOutHiddenObj(0.2);
    
        }
    
        if (XR.isStartedFinding ) {
            var distance = XR.viewerPosition.distanceTo(XR.hiddenObj.position);
            var absDist = Math.abs(XR.previousDistance - distance);
            
            if(absDist > 0.01 && XR.isFound == false) {
                if(distance > XR.previousDistance) {
                    // console.log('%c colder', 'color: #00f');
                    XR.setColder();
                } else if (distance < XR.previousDistance) {
                    // console.log('%c warmer', 'color: #f00');
                    XR.setWarmer();
                } 
    
                XR.previousDistance = distance;
            }
            
            // Fade in if in range
            if (distance > 0.6) {

                XR.fadeOutHiddenObj(0.2);    

            } else {

                // XR.showObject = true;
                XR.fadeInHiddenObj(0.2);

            }
            
            // Booped!
            if (distance < 0.25) {

                XR.setFound();

            }
            
        }

    }

    if (XR.renderer.xr.isPresenting) {
        XR.renderer.render(XR.scene, XR.camera);
    }
}

XR.fadeOutHiddenObj = function(rate) {
    if(XR.hiddenObjOpacity > 0) {
        XR.hiddenObj.traverse( function( node ) {
            if( node.material ) {
                node.material.opacity += -rate;
            }
        });

        XR.hiddenObjOpacity += -rate;
    }
}

XR.fadeInHiddenObj = function(rate) {
    if(XR.hiddenObjOpacity < 1) {
        XR.hiddenObj.traverse( function( node ) {
            if( node.material ) {
                node.material.opacity += rate;
            }
        });

        XR.hiddenObjOpacity += rate;
    }
}

XR.goldHiddenObj = function(rate) {
    console.log( XR.hiddenObj);
    XR.hiddenObj.traverse( function( node ) {
        console.log(node);
        if( node.material ) {
            node.material.setValues({color: '#f4cd04'});
        }
    });
}

XR.initControllers = function() {

    // controllers
    XR.controller1 = XR.renderer.xr.getController( 0 );
    XR.controller1.addEventListener('select', onSelect);
    XR.scene.add( XR.controller1 );

}

// Overlay UI

XR.setupUI = function() {
    gsap.set(XR.hideUI, {'display' : 'flex', 'opacity': 1});
    gsap.set(XR.timerUI, {'display' : 'none', 'opacity': 0});
    gsap.set(XR.findUI, {'display' : 'none', 'opacity': 0});
    gsap.set(XR.foundUI, {'display' : 'none', 'opacity': 0});
    gsap.set(XR.feedbackWarmer, {'display' : 'none', 'opacity': 0});
    gsap.set(XR.feedbackColder, {'display' : 'none', 'opacity': 0});

    XR.initButtons();
}

XR.initButtons = function() {
    XR.closeXRbtn.addEventListener('click', e => {
        XR.currentSession.end();
        XR.reset();
    });

    XR.hideBtn.addEventListener('click', e => {
        XR.hideObject();
    });

    XR.findBtn.addEventListener('click', e => {
        XR.findObject();
    });

    XR.playAgainBtn.addEventListener('click', e => {
        XR.playAgain();
    });
}

XR.setHiding = function() {
    gsap.set(XR.timerUI, {'display' : 'none', 'opacity': 0});
    gsap.set(XR.findUI, {'display' : 'none', 'opacity': 0});
    gsap.set(XR.foundUI, {'display' : 'none', 'opacity': 0});
    gsap.to(XR.hideUI, {'display' : 'flex', 'opacity': 1});
    XR.isHiding = true;
    XR.isFinding = false;
    XR.body.classList.add('is-hiding');
    XR.body.classList.remove('is-finding');
}

XR.setReadyFinding = function() {
    gsap.set(XR.hideUI, {'display' : 'none', 'opacity': 0});
    gsap.set(XR.findBtn, {'display' : 'flex', 'opacity': 1});
    gsap.to(XR.findUI, {'display' : 'flex', 'opacity': 1});
    XR.isReadyFinding = true;
    XR.isHiding = false;
    XR.body.classList.add('is-ready-finding');
    XR.body.classList.remove('is-hiding');
}

XR.setStartedFinding = function() {
    XR.startMillTimer();
    gsap.set(XR.findBtn, {'display' : 'none', 'opacity': 0});
    gsap.to(XR.timerUI, {'display' : 'flex', 'opacity': 1});
    XR.isStartedFinding = true;
    XR.isReadyFinding = false;
    XR.body.classList.add('is-started-finding');
    XR.body.classList.remove('is-ready-finding');
}

XR.setFound = function() {
    XR.stopTimer();
    gsap.set(XR.findUI, {'display' : 'none', 'opacity': 0});
    gsap.to(XR.foundUI, {'display' : 'flex', 'opacity': 1});
    XR.isFound = true;
    XR.isStartedFinding = false;
    XR.body.classList.add('is-found');
    XR.body.classList.remove('is-started-finding');
    // Warmer / Colder reset
    gsap.to([XR.feedbackColder, XR.feedbackWarmer], { 'display' : 'none', 'opacity': 0, yPercent: -100, duration: 0.5 });
    XR.overlay.classList.remove('is-warmer', 'is-colder');
    XR.goldHiddenObj();
}

XR.setWarmer = function() {
    gsap.killTweensOf([XR.feedbackColder, XR.feedbackWarmer]);
    gsap.set(XR.feedbackColder, { 'display' : 'none', 'opacity': 0, yPercent: -100 });
    gsap.to(XR.feedbackWarmer, { 'display' : 'block', 'opacity': 1, yPercent: 0, ease: "back.out(2)", duration: 0.5 });
    XR.isWarmer = true;
    XR.isColder = false;
    XR.overlay.classList.add('is-warmer');
    XR.overlay.classList.remove('is-colder');
}

XR.setColder = function() {
    gsap.killTweensOf([XR.feedbackColder, XR.feedbackWarmer]);
    gsap.set(XR.feedbackWarmer, { 'display' : 'none', 'opacity': 0, yPercent: -100 });
    gsap.to(XR.feedbackColder, { 'display' : 'block', 'opacity': 1, yPercent: 0, ease: "back.out(2)", duration: 0.5 });
    XR.isColder = true;
    XR.isWarmer = false;
    XR.overlay.classList.add('is-colder');
    XR.overlay.classList.remove('is-warmer');
}

XR.hideObject = function() {
    XR.previousDistance = XR.viewerPosition.distanceTo(XR.hiddenObj.position);
    XR.showObject = false;
    XR.setReadyFinding();

    console.log('Hidden the object: ');
}

XR.findObject = function() {
    XR.setStartedFinding();

    console.log('Start finding object: ');
}

XR.reset = function() {
    XR.isHiding = false;
    XR.isReadyFinding = false;
    XR.isStartedFinding = false;
    XR.isFound = false;
    XR.resetTimer();

    document.querySelector('body').classList.remove('is-hiding', 'is-started-finding', 'is-ready-finding', 'is-found');
    XR.overlay.classList.remove('is-warmer', 'is-colder');

    XR.fadeInHiddenObj(1);
    
    while(XR.scene.children.length > 0){ 
        XR.scene.remove(XR.scene.children[0]); 
    }

    XR.doughnutGenerator();
    XR.lighting();
}

XR.playAgain = function() {
    XR.reset();
    XR.setHiding();
}

XR.startTimer = function() {
    var minutesEl = XR.timerUI.querySelector('.js-find-timer-minutes');
    var secondsEl = XR.timerUI.querySelector('.js-find-timer-seconds');
    var totalSeconds = 0;
    XR.timer = setInterval(setTime, 1000);

    function setTime() {
        ++totalSeconds;
        // centecondsEl.innerHTML = pad(parseInt(totalSeconds % 100));
        secondsEl.innerHTML = pad(parseInt(totalSeconds % 60));
        minutesEl.innerHTML = pad(parseInt(totalSeconds / 60));
    }
}

XR.startMillTimer = function() {
    var minutesEl = XR.timerUI.querySelector('.js-find-timer-minutes');
    var secondsEl = XR.timerUI.querySelector('.js-find-timer-seconds');
    var centecondsEl = XR.timerUI.querySelector('.js-find-timer-centeconds');
    var centeconds = 0;
    XR.timer = setInterval(setTime, 10);

    function setTime() {
        ++centeconds;
        centecondsEl.innerHTML = pad(parseInt(centeconds % 100));
        secondsEl.innerHTML = pad(parseInt(centeconds / 100 % 60));
        minutesEl.innerHTML = pad(parseInt(centeconds / 100 / 60));
    }
}

XR.stopTimer = function() {
    clearInterval(XR.timer);
}

XR.resetTimer = function() {
    XR.stopTimer();
    var minutesEl = XR.timerUI.querySelector('.js-find-timer-minutes');
    var secondsEl = XR.timerUI.querySelector('.js-find-timer-seconds');
    var centecondsEl = XR.timerUI.querySelector('.js-find-timer-centeconds');

    centecondsEl.innerHTML = pad(0);
    secondsEl.innerHTML = pad(0);
    minutesEl.innerHTML = pad(0);
    
}

function pad(val) {
    var valString = val + "";
    if (valString.length < 2) {
        return "0" + valString;
    } else {
        return valString;
    }
}

function onSelect(e) {
    console.log('onSelect()', e);    
}

export { XR };