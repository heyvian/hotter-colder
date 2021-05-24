import * as THREE from 'three';

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
    this.previousDistance;
    this.viewerPosition = new THREE.Vector3();
    this.objectTappable = false;
    this.isHiding = true;
    this.isFinding = false;
    this.startedFinding = false;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, window.innerHeight / window.innerWidth, 1, 200);
    // XR UI
    this.body = document.querySelector('body');
    this.overlay = document.querySelector('.js-ar-overlay');
    this.closeXRbtn = document.querySelector('.js-close-webxr');
    this.hideBtn = document.querySelector('.js-hide-obj');
    this.findBtn = document.querySelector('.js-find-obj');
    this.timer;

    const hiddenObjGeo = new THREE.SphereGeometry( 0.1, 16, 16 );
    const hiddenObjMat = new THREE.MeshPhongMaterial({
        color: '#27CDF2',
        shininess: 100
    });
    // hiddenObjMat.emissiveIntensity = 1;
    this.hiddenObj = new THREE.Mesh( hiddenObjGeo, hiddenObjMat );
    this.hiddenObj.position.set(0, 1, -1);
    this.scene.add( this.hiddenObj );

    var viewerLight = new THREE.PointLight( '#fff', 0.5, 1, 2 );
    this.scene.add(viewerLight);
    this.hiddenObj.add(viewerLight);
    viewerLight.position.set(0.25, 0.25, 0.25);

    var ambientLight = new THREE.AmbientLight( '#fff', 0.45 )
    this.scene.add( ambientLight );

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

    this.closeXRbtn.addEventListener('click', e => {
        this.currentSession.end();
    });

    this.hideBtn.addEventListener('click', e => {
        XR.hideObject();
    });

    this.findBtn.addEventListener('click', e => {
        XR.findObject();
    });
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
    XR.referenceSpace = await XR.currentSession.requestReferenceSpace("viewer").catch(e => {
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

    XR.initControllers();

    XR.setHiding();
}

XR.onSessionEnded = async function() {

    XR.currentSession.removeEventListener('end', XR.onSessionEnded);
    XR.currentSession = null;

    XR.isHiding = false;
    XR.isFinding = false;
    XR.startedFinding = false;
    XR.stopTimer();

    document.querySelector('body').classList.remove('has-xr', 'has-ar', 'has-vr', 'is-hiding', 'is-finding', 'started-finding');
    XR.overlay.classList.remove('is-warmer', 'is-colder');

}

XR.animate = function() {
    XR.renderer.setAnimationLoop(XR.render);
}

XR.render = function(time, frame) {
    // console.log(renderer);

    XR.camera.getWorldPosition(XR.viewerPosition);

    if (XR.hiddenObj && XR.isHiding) {
        var dist = 0.5;
        var cwd = new THREE.Vector3();
        
        XR.camera.getWorldDirection(cwd);
        
        cwd.multiplyScalar(dist);
        cwd.add(XR.camera.position);
        
        XR.hiddenObj.position.set(cwd.x, cwd.y + 0.08, cwd.z);
        XR.hiddenObj.setRotationFromQuaternion(XR.camera.quaternion);

    } else if (XR.hiddenObj && !XR.isHiding) {

        if(XR.hiddenObj.material.opacity > 0.25) {
            XR.hiddenObj.material.opacity += -0.005;
        }

    }

    if (XR.hiddenObj && XR.isFinding && XR.startedFinding) {
        // XR.hitTestResults = frame.getHitTestResults(XR.hitTestSource);
        var distance = XR.viewerPosition.distanceTo(XR.hiddenObj.position);
        var absDist = Math.abs(XR.previousDistance - distance);
        
        if(absDist > 0.02) {
            if(distance > XR.previousDistance) {
                // console.log('%c colder', 'color: #00f');
                XR.overlay.classList.remove('is-warmer');
                XR.overlay.classList.add('is-colder');
            } else if (distance < XR.previousDistance) {
                // console.log('%c warmer', 'color: #f00');
                XR.overlay.classList.remove('is-colder');
                XR.overlay.classList.add('is-warmer');
            } 

            if (distance < 0.25) {
                XR.hiddenObj.opacity = 1;
                XR.objectTappable = true;
                // XR.stopTimer();
            } else {
                XR.hiddenObj.opacity = 0.75;
                XR.objectTappable = false;
            }
    
            XR.previousDistance = distance;
        }
        
    }

    if (XR.renderer.xr.isPresenting) {
        XR.renderer.render(XR.scene, XR.camera);
    }
}

XR.initControllers = function() {

    // controllers
    XR.controller1 = XR.renderer.xr.getController( 0 );
    XR.controller1.addEventListener('select', onSelect);
    XR.scene.add( XR.controller1 );

}

XR.setHiding = function() {
    XR.isHiding = true;
    XR.isFinding = false;
    XR.body.classList.add('is-hiding');
    XR.body.classList.remove('is-finding');
}

XR.setFinding = function() {
    XR.isFinding = true;
    XR.isHiding = false;
    XR.body.classList.add('is-finding');
    XR.body.classList.remove('is-hiding');
}

XR.hideObject = function() {
    XR.previousDistance = XR.viewerPosition.distanceTo(XR.hiddenObj.position);

    XR.setFinding();

    console.log('Hidden the object: ', XR.previousDistance);
}

XR.findObject = function() {
    XR.startedFinding = true;

    XR.body.classList.add('started-finding');

    // XR.startTimer();
    // XR.startFastTimer();
    XR.startMillTimer();

    console.log('Start finding object: ', XR.previousDistance);
}

XR.startTimer = function() {
    var minutesEl = document.querySelector('.js-timer-minutes');
    var secondsEl = document.querySelector('.js-timer-seconds');
    var centecondsEl = document.querySelector('.js-timer-centeconds');
    var totalSeconds = 0;
    XR.timer = setInterval(setTime, 1000);

    function setTime() {
        ++totalSeconds;
        // centecondsEl.innerHTML = pad(parseInt(totalSeconds % 100));
        secondsEl.innerHTML = pad(parseInt(totalSeconds % 60));
        minutesEl.innerHTML = pad(parseInt(totalSeconds / 60));
    }

    function pad(val) {
        var valString = val + "";
        if (valString.length < 2) {
            return "0" + valString;
        } else {
            return valString;
        }
    }
}

XR.startFastTimer = function() {
    var minutesEl = document.querySelector('.js-timer-minutes');
    var secondsEl = document.querySelector('.js-timer-seconds');
    var centecondsEl = document.querySelector('.js-timer-centeconds');
    var deconds = 0;
    XR.timer = setInterval(setTime, 100);

    function setTime() {
        ++deconds;
        centecondsEl.innerHTML = pad(parseInt(deconds % 10));
        secondsEl.innerHTML = pad(parseInt(deconds / 10 % 60));
        minutesEl.innerHTML = pad(parseInt(deconds / 10 / 60));
    }

    function pad(val) {
        var valString = val + "";
        if (valString.length < 2) {
            return "0" + valString;
        } else {
            return valString;
        }
    }
}

XR.startMillTimer = function() {
    var minutesEl = document.querySelector('.js-timer-minutes');
    var secondsEl = document.querySelector('.js-timer-seconds');
    var centecondsEl = document.querySelector('.js-timer-centeconds');
    var centeconds = 0;
    XR.timer = setInterval(setTime, 10);

    function setTime() {
        ++centeconds;
        centecondsEl.innerHTML = pad(parseInt(centeconds % 100));
        secondsEl.innerHTML = pad(parseInt(centeconds / 100 % 60));
        minutesEl.innerHTML = pad(parseInt(centeconds / 100 / 60));
    }

    function pad(val) {
        var valString = val + "";
        if (valString.length < 2) {
            return "0" + valString;
        } else {
            return valString;
        }
    }
}

XR.stopTimer = function() {
    clearInterval(XR.timer);
}

function onSelect(e) {
    console.log('onSelect()', e);    
}

export { XR };