'use strict';

const remote = require('remote');
const Mousetrap = require('mousetrap');
var THREE = require('three');

/* Shader */
require('./js/shaders/CopyShader.js');
require('./js/shaders/VignetteShader.js');
require('./js/shaders/WaveDistortionShader.js');

/* Compositing */
require('./js/postprocessing/EffectComposer.js');
require('./js/postprocessing/RenderPass.js');
require('./js/postprocessing/MaskPass.js');
require('./js/postprocessing/ShaderPass.js');
require('./js/postprocessing/WaveDistortionPass.js');
require('./js/postprocessing/VignettePass.js');


const VIDEO_SOURCE_LABEL = 'USB-Videogerät (046d:0807)';
const AUDIO_SOURCE_LABEL = 'Mikrofon (USB-Audiogerät)';

const minFrequency = 40;
const maxFrequency = 140;
const fftSize = 2048;
const AVERAGING_FACTOR = 0.31;
const SMOOTHING_FACTOR = 0.31;
const NEAR = 1;
const FAR = 10000;
const FOV = 60;


let video;

let videoSource;
let videoStream;
let audioSource;
let audioStream;

let scene;
let camera;
let videoTexture;
let videoMaterial;
let submarineMesh;
let windowMesh;
let bgMesh;


let renderer;
let wavePass;
let composer;

let analyser;
let frequencyData;
let sampleRate;
let frequencyStep;


let smoothedFactor = 0;
let averageVol = 0;

window.onload = function(e){
  initializeScene();
  bindControls();
  findDevices();
  loadAssets();
  requestAnimationFrame(loop); // hit it
}


function initializeScene(){
  video =  document.querySelector('#liveVideo');
  var height = window.innerHeight;
  var width = window.innerWidth;

	scene = new THREE.Scene();
	camera = new THREE.PerspectiveCamera(FOV, width/height, NEAR, FAR);
	camera.position.z = 600;

  var light = new THREE.AmbientLight( 0x444444 ); // soft white light
  scene.add(light);
  var directionalLight = new THREE.PointLight( 0xffffff, 1.0 );
  directionalLight.position.set( 0, 10, 600 );
  scene.add( directionalLight );


    var directionalLight2 = new THREE.PointLight( 0xffffff, 1.0 );
    directionalLight2.position.set( 100, 100, -300 );
    scene.add( directionalLight2 );

	//geometry = new THREE.BoxGeometry(200, 200, 200);
	renderer = new THREE.WebGLRenderer();
	renderer.setSize(width, height);

	document.getElementById("three").appendChild(renderer.domElement);

  composer = new THREE.EffectComposer(renderer);
  composer.addPass(new THREE.RenderPass(scene, camera));

  var vignettePass = new THREE.VignettePass();
    composer.addPass(vignettePass);
  wavePass = new THREE.WaveDistortionPass();
  wavePass.renderToScreen = true;
  composer.addPass(wavePass);
    //vignettePass.renderToScreen = true;
      //ignette.uniforms.darkness.value = 10
    //  vignette.uniforms.offset.value = 10.8


}

function bindControls(){
  Mousetrap.bind(['command+f', 'ctrl+f', 'f11'], (e)=>{
    var win = remote.getCurrentWindow();
    if (!win.isFullScreen()){
        win.setResizable(true);
        win.setFullScreen(true);
    }else{
        winwin.setFullScreen(false);
        win.setResizable(false);
    }
    return false;
  });
}

function findDevices(){
  navigator.mediaDevices.enumerateDevices().then((devices)=>{
    devices.forEach(function(device){
      console.log(device.kind, device.label, VIDEO_SOURCE_LABEL, AUDIO_SOURCE_LABEL);
      if(device.kind === 'videoinput' && device.label === VIDEO_SOURCE_LABEL){
        videoSource = device;
      }else if(device.kind === 'audioinput' && device.label === AUDIO_SOURCE_LABEL){
        audioSource = device;
      }
    });
    initializeAudio();
    initializeVideo();
  })
  .catch((err)=>{
    console.error(err);
  });
}

function loadAssets(){
  console.log("loadAssets")
  var loader = new THREE.ObjectLoader();

/*  loader.load('./model/bg.json', (geometry, materials)=>{

})*/

  loader.load('./model/submarinescene.json', (object)=>{
    console.log("assets loaded")
      console.log(object);
    /*  var parameters = {color: 0x0000FF};
      submarineMesh = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial(parameters))
      submarineMesh.rotation.x = Math.PI/2;
      submarineMesh.rotation.y = Math.PI/2;;*/
      //  console.log(object.children)
      object.children.forEach((child)=>{
        //child.scale.x = child.scale.y = child.scale.z = 100
      //  child.rotation.z = Math.PI/2;
     	//	scene.add(child);
      //  scene.add(child);
      })
      windowMesh = object.children[2]
      scene.add(windowMesh);
      submarineMesh = object.children[1]
      scene.add(submarineMesh);
      bgMesh = object.children[0]
      scene.add(bgMesh);

      //bgMesh.rotation.x = Math.PI/2;
      //bgMesh.rotation.y = Math.PI/2;
      //submarineMesh.rotation.x = Math.PI/2;
      //submarineMesh.rotation.y = Math.PI/2;
      //scene.add(bgMesh);
    //  setVideoTexture();

   });
}

function setVideoTexture(){
  if(videoStream && submarineMesh){
    video.src = window.URL.createObjectURL(videoStream);

    videoTexture = new THREE.VideoTexture( document.getElementById("liveVideo") );
    videoTexture.minFilter = THREE.LinearFilter;
    videoTexture.magFilter = THREE.LinearFilter;
    videoTexture.format = THREE.RGBFormat;
    var parameters = {color: 0xffffff, map: videoTexture};

    videoMaterial = new THREE.MeshLambertMaterial(parameters);
    windowMesh.material.map = videoMaterial;
  }
}

function analyzeAudio(){
  if(audioStream && analyser){
    console.log("analyzeAudio")
    analyser.getByteFrequencyData(frequencyData);
    var oavg = 0;
    var avg = 0;
    var count = 0
    for(var i = 0; i<analyser.frequencyBinCount; i++){
      var freq = frequencyStep * i;
      oavg += frequencyData[i];
      if(freq > minFrequency && freq < maxFrequency){
        avg+=frequencyData[i];
        count++;
      }
    }
    var overallVol = oavg/(analyser.frequencyBinCount*0xFF)
    averageVol += (overallVol - averageVol) * AVERAGING_FACTOR
    var factor = avg/(count*0xFF);
    smoothedFactor += (factor - smoothedFactor) * SMOOTHING_FACTOR;
  }
}


function loop(){
    requestAnimationFrame(loop);


    analyzeAudio();

    if(scene && submarineMesh && composer){
      camera.position.z = 900 - smoothedFactor * 200;
      if(wavePass)  wavePass.dpi = 10  + averageVol * 50;
      if(submarineMesh){
  		  //submarineMesh.rotation.x += 0.01;
       	submarineMesh.rotation.z += 0.02;
        windowMesh.rotation.z = bgMesh.rotation.z = submarineMesh.rotation.z
      }
      composer.render();
    }
}

function initializeAudio(){
  console.log(audioSource)
  if(audioSource){
    // audio
    navigator.webkitGetUserMedia(
      {
        audio:{
          mandatory:{
            sourceId:audioSource.deviceId
          }
        },
        video: false
      },
      (stream)=>{
        audioStream = stream;
        var actx = new window.AudioContext();
        sampleRate = actx.sampleRate;
        analyser = actx.createAnalyser();
        analyser.fftSize = fftSize;
        analyser.smoothingTimeConstant = 0;
        frequencyData = new Uint8Array(analyser.frequencyBinCount);
        frequencyStep = sampleRate / fftSize;
        var input = actx.createMediaStreamSource(stream);
        var volume = actx.createGain();
        volume.gain.value = 1.0;
        input.connect(volume);
        volume.connect(analyser);
      },
      (error)=>{
        console.error(error);
      }
    );
  }
}
function initializeVideo(){
  console.log(videoSource)
  if(videoSource){
    // video
    navigator.webkitGetUserMedia(
        {
          audio: false,
          video: {
            mandatory: {
              minWidth: 640,
              minHeight: 480,
              sourceId:videoSource.deviceId
            }
          }
        },
        (stream)=>{
          videoStream = stream;
          setVideoTexture();
        },
        (error)=>{
          console.error(error);
        }
    );
  }
}
