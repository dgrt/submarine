/**
 * @author dgrt
 */

THREE.VignettePass = function(){

	THREE.Pass.call(this);

	if(THREE.VignetteShader === undefined)
		console.error(
      "THREE.WaveDistortionPasss relies on THREE.VignettePass"
    );

	var shader = THREE.VignetteShader;


	this.offset = 0.1;
  this.darkness =255.0;

	this.uniforms = THREE.UniformsUtils.clone(shader.uniforms);

	if(this.offset !== undefined) this.uniforms["offset"].value = this.offset;
	if(this.darkness !== undefined) this.uniforms["darkness"].value = this.darkness;

	this.material = new THREE.ShaderMaterial({
		uniforms: this.uniforms,
		vertexShader: shader.vertexShader,
		fragmentShader: shader.fragmentShader
	});

	this.camera = new THREE.OrthographicCamera(- 1, 1, 1, - 1, 0, 1);
	this.scene = new THREE.Scene();

	this.quad = new THREE.Mesh(new THREE.PlaneBufferGeometry(2, 2), null);
	this.scene.add(this.quad);
};

THREE.VignettePass.prototype = Object.create(THREE.Pass.prototype);

THREE.VignettePass.prototype = {

	constructor: THREE.VignettePass,

	render: function(renderer, writeBuffer, readBuffer, delta, maskActive){
		this.uniforms["tDiffuse"].value = readBuffer;
		//this.uniforms["offset"].value = this.offset;
	//	this.uniforms["darkness"].value = this.darkness;
  //  this.time += 1
  //  this.uniforms["dpi"].value = this.dpi;
    //this.uniforms["time"].value = this.time;

		this.quad.material = this.material;

		if(this.renderToScreen) renderer.render(this.scene, this.camera);
		else renderer.render(this.scene, this.camera, writeBuffer, this.clear);
	}
};
