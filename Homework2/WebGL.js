var VSHADER_SOURCE = `
        attribute vec4 a_Position;
        attribute vec4 a_Color;
        varying vec4 v_Color;
        uniform mat4 u_modelMatrix;
        void main(){
            gl_Position = u_modelMatrix * a_Position;
            v_Color = a_Color;
        }    
    `;

var FSHADER_SOURCE = `
        precision mediump float;
        varying vec4 v_Color;
        void main(){
            gl_FragColor = v_Color;
        }
    `;

function createProgram(gl, vertexShader, fragmentShader){
    //create the program and attach the shaders
    var program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    
    //if success, return the program. if not, log the program info, and delete it.
    if(gl.getProgramParameter(program, gl.LINK_STATUS)){
        return program;
    }
    alert(gl.getProgramInfoLog(program) + "");
    gl.deleteProgram(program);
}

function compileShader(gl, vShaderText, fShaderText){
    //////Build vertex and fragment shader objects
    var vertexShader = gl.createShader(gl.VERTEX_SHADER)
    var fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)
    //The way to  set up shader text source
    gl.shaderSource(vertexShader, vShaderText)
    gl.shaderSource(fragmentShader, fShaderText)
    //compile vertex shader
    gl.compileShader(vertexShader)
    if(!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)){
        console.log('vertex shader ereror');
        var message = gl.getShaderInfoLog(vertexShader); 
        console.log(message);//print shader compiling error message
    }
    //compile fragment shader
    gl.compileShader(fragmentShader)
    if(!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)){
        console.log('fragment shader ereror');
        var message = gl.getShaderInfoLog(fragmentShader);
        console.log(message);//print shader compiling error message
    }

    /////link shader to program (by a self-define function)
    var program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    //if not success, log the program info, and delete it.
    if(!gl.getProgramParameter(program, gl.LINK_STATUS)){
        alert(gl.getProgramInfoLog(program) + "");
        gl.deleteProgram(program);
    }

    return program;
}

function initArrayBuffer( gl, data, num, type, attribute){
    var buffer = gl.createBuffer();
    if(!buffer){
        console.log("failed to create the buffere object");
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);

    var a_attribute = gl.getAttribLocation(gl.getParameter(gl.CURRENT_PROGRAM), attribute);

    gl.vertexAttribPointer(a_attribute, num, type, false, 0, 0);
    gl.enableVertexAttribArray(a_attribute);

    return true;
}

var transformMat = new Matrix4();
var matStack = [];
var u_modelMatrix;
function pushMatrix(){
    matStack.push(new Matrix4(transformMat));
}
function popMatrix(){
    transformMat = matStack.pop();
}
//variables for tx, red,green and yellow arms angle 
var tx = 0;
var ty = 0;
var scale = 1;
var iAngle = 30;
var TriangleAngle = 60;
var SAngle = 0;
var CAngle = 0;

function main(){
    //////Get the canvas context
    var canvas = document.getElementById('webgl');
    var gl = canvas.getContext('webgl2');
    if(!gl){
        console.log('Failed to get the rendering context for WebGL');
        return ;
    }

    program = compileShader(gl, VSHADER_SOURCE, FSHADER_SOURCE);
    redraw(gl); //call redarw here to show the initial image

    //setup the call back function of tx Sliders
    var txSlider = document.getElementById("Translate-X");
    txSlider.oninput = function() {
        tx = this.value / 100.0; //convert sliders value to -1 to +1
        redraw(gl);
    }

    //setup the call back function of tx Sliders
    var tySlider = document.getElementById("Translate-Y");
    tySlider.oninput = function() {
        ty = this.value / 100.0; //convert sliders value to -1 to +1
        redraw(gl);
    }

    //setup the call back function of red arm rotation Sliders
    var jointiSlider = document.getElementById("jointFori");
    jointiSlider.oninput = function() {
        iAngle = this.value * -1; 
        redraw(gl);
    }

    //setup the call back function of green arm rotation Sliders
    var jointTriangleSlider = document.getElementById("jointForTriangle");
    jointTriangleSlider.oninput = function() {
        TriangleAngle = this.value * -1; //convert sliders value to 0 to 45 degrees
        redraw(gl);
    }

    //setup the call back function of yellow arm rotation Sliders
    var jointSSlider = document.getElementById("jointForS");
    jointSSlider.oninput = function() {
        SAngle = this.value; //convert sliders value to 0 to -45 degrees
        redraw(gl);
    }

    //setup the call back function of yellow arm rotation Sliders
    var jointCSlider = document.getElementById("jointForC");
    jointCSlider.oninput = function() {
        CAngle = this.value; //convert sliders value to 0 to -45 degrees
        redraw(gl);
    }

    var RobotSizeSlider = document.getElementById("RobotSize");
    RobotSizeSlider.oninput = function() {
        scale = this.value/50.0; //convert sliders value to 0 to -45 degrees
        console.log('scale: ' + scale);
        redraw(gl);
    }
}

// circle
function init_circle(r,color){
    var circle = [];
    var x = 0;
    var y = 0;
    for(var i = 0; i < 200; i ++){
        circle.push(0,0);
        circle.push(color[0],color[1],color[2]);
        circle.push(x + r*Math.cos(i * Math.PI / 100),y + r*Math.sin(i * Math.PI / 100));
        circle.push(color[0],color[1],color[2]);
        circle.push(x + r*Math.cos((i+1) * Math.PI / 100),y + r*Math.sin((i+1) * Math.PI / 100));
        circle.push(color[0],color[1],color[2]);
    }
    return circle;
}
function draw_circle(gl,program,float_circles){
    var buffer = gl.createBuffer();
    if(!buffer){
        console.log("failed to create the buffere object");
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER,float_circles , gl.STATIC_DRAW);
    var FSIZE_circles = float_circles.BYTES_PER_ELEMENT;

    var a_Position = gl.getAttribLocation(program, 'a_Position');
    gl.vertexAttribPointer(a_Position, 2, gl.FLOAT, false, FSIZE_circles*5, 0);
    gl.enableVertexAttribArray(a_Position);

    var a_Color = gl.getAttribLocation(program, 'a_Color');
    gl.vertexAttribPointer(a_Color, 3, gl.FLOAT, false, FSIZE_circles*5, FSIZE_circles*2);
    gl.enableVertexAttribArray(a_Color);
}

// hollow circle
function init_holcir(color){
    var circle = [];
    var x = 0;
    var y = 0;
    var r = 0.25;
    for(var i = 180; i > -360; i --){
        circle.push(x + r*Math.cos(i * Math.PI / 360),y + r*Math.sin(i * Math.PI / 360));
        circle.push(color[0],color[1],color[2]);
        circle.push(x + (r*0.7)*Math.cos((i) * Math.PI / 360),y + (r*0.7)*Math.sin((i) * Math.PI / 360));
        circle.push(color[0],color[1],color[2]);
    }
    return circle;
}

//Call this funtion when we have to update the screen (eg. user input happens)
function redraw(gl)
{
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(program);
    u_modelMatrix = gl.getUniformLocation(gl.getParameter(gl.CURRENT_PROGRAM), 'u_modelMatrix');
    
    rectVertices = [-0.5, 0.5, 0.5, 0.5, -0.5, -0.5, 0.5, -0.5];
    triVertices = [-0.5, 1, 0.5, 1, 0, 0];
    //var E_Vertices = [-0.5, 0.1, 0.5, 0.1, -0.5, 0.0, 0.5, 0.0];
    var brownColor = [148.0/256.0, 20.0/256.0, 45.0/256.0, 148.0/256.0, 20.0/256.0, 45.0/256.0, 148.0/256.0, 20.0/256.0, 45.0/256.0, 148.0/256.0, 20.0/256.0, 45.0/256.0];
    var bblueColor = [0.203, 0.164, 0.535, 0.203, 0.164, 0.535, 0.203, 0.164, 0.535];
    var SColor = [143.0/256.0, 170.0/256.0, 204.0/256.0, 143.0/256.0, 170.0/256.0, 204.0/256.0, 143.0/256.0, 170.0/256.0, 204.0/256.0, 143.0/256.0, 170.0/256.0, 204.0/256.0 ];
    var a_SColor = [143.0/256.0, 170.0/256.0, 204.0/256.0];
    var a_CColor = [255.0/256.0, 153.0/256.0, 51.0/256.0];

    var redColor = [1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0 ];
    var greenColor = [0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0 ];
    var blueColor = [0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0 ];
    var yellowColor = [1.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0, 1.0, 0.0 ];
    buffer0 = initArrayBuffer(gl, new Float32Array(rectVertices), 2, gl.FLOAT, 'a_Position');
    
    buffer1 = initArrayBuffer(gl, new Float32Array(brownColor), 3, gl.FLOAT, 'a_Color');

    transformMat.setIdentity();
    //TODO-1: translate whole robot here
    transformMat.translate(0.0+tx, -0.5+ty, 0.0);
    pushMatrix();
    transformMat.scale(0.5*scale, 0.05*scale, 0.0);
    gl.uniformMatrix4fv(u_modelMatrix, false, transformMat.elements);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, rectVertices.length/2);//draw the E

    for(var i = 0; i < 2; i ++){
        popMatrix();
        transformMat.translate(0.0, 0.1*scale, 0.0);
        pushMatrix();
        transformMat.scale(0.5*scale, 0.05*scale, 0.0);
        gl.uniformMatrix4fv(u_modelMatrix, false, transformMat.elements);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, rectVertices.length/2);//draw the E
    }

    popMatrix();
    transformMat.translate(-0.23*scale, -0.1*scale, 0.0);
    pushMatrix();
    transformMat.scale(0.05*scale, 0.25*scale, 0.0);
    gl.uniformMatrix4fv(u_modelMatrix, false, transformMat.elements);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, rectVertices.length/2);//draw the E

    popMatrix();
    transformMat.translate(0.23*scale, 0.25*scale, 0.0);
    pushMatrix();
    transformMat.scale(0.05*scale, 0.3*scale, 0.0);
    gl.uniformMatrix4fv(u_modelMatrix, false, transformMat.elements);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, rectVertices.length/2);//draw the I

    // draw circles
    var g_circles = init_circle(0.03,[1,1,0]);
    var float_circles = new Float32Array(g_circles);
    draw_circle(gl,program,float_circles);
    popMatrix();
    transformMat.translate(0*scale, 0.2*scale, 0.0);
    pushMatrix();
    transformMat.scale(scale, scale, 0.0);
    gl.uniformMatrix4fv(u_modelMatrix, false, transformMat.elements);
    gl.drawArrays(gl.TRIANGLES, 0, float_circles.length/2);//draw the i

    buffer0 = initArrayBuffer(gl, new Float32Array(rectVertices), 2, gl.FLOAT, 'a_Position');
    buffer1 = initArrayBuffer(gl, new Float32Array(brownColor), 3, gl.FLOAT, 'a_Color');
    popMatrix();
    transformMat.rotate(iAngle, 0.0, 0.0, 1.0);
    transformMat.translate(0.0*scale, 0.15*scale, 0.0);
    pushMatrix();
    transformMat.scale(0.03*scale, 0.2*scale, 0.0);
    gl.uniformMatrix4fv(u_modelMatrix, false, transformMat.elements);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, rectVertices.length/2);//draw the cs-i

    
    buffer0 = initArrayBuffer(gl, new Float32Array(triVertices), 2, gl.FLOAT, 'a_Position');
    buffer1 = initArrayBuffer(gl, new Float32Array(bblueColor), 3, gl.FLOAT, 'a_Color');
    popMatrix();
    transformMat.translate(0.0*scale, 0.1*scale, 0.0);
    transformMat.rotate(TriangleAngle, 0.0, 0.0, 1.0);
    pushMatrix();
    transformMat.scale(0.08*scale, 0.08*scale, 0.0);
    gl.uniformMatrix4fv(u_modelMatrix, false, transformMat.elements);
    gl.drawArrays(gl.TRIANGLES, 0, rectVertices.length/2);//draw the triangle

    buffer0 = initArrayBuffer(gl, new Float32Array(rectVertices), 2, gl.FLOAT, 'a_Position');
    buffer1 = initArrayBuffer(gl, new Float32Array(SColor), 3, gl.FLOAT, 'a_Color');
    popMatrix();
    transformMat.translate(0.0*scale, 0.1*scale, 0.0);
    pushMatrix();
    transformMat.scale(0.3*scale, 0.07*scale, 0.0);
    gl.uniformMatrix4fv(u_modelMatrix, false, transformMat.elements);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, rectVertices.length/2);//draw the S-

    // draw circles
    var g_circles = init_circle(0.03,[1,1,0]);
    var float_circles = new Float32Array(g_circles);
    draw_circle(gl,program,float_circles);
    popMatrix();
    transformMat.translate(0.2*scale, 0*scale, 0.0);
    pushMatrix();
    transformMat.scale(scale, scale, 0.0);
    gl.uniformMatrix4fv(u_modelMatrix, false, transformMat.elements);
    gl.drawArrays(gl.TRIANGLES, 0, float_circles.length/2);

    // draw S
    popMatrix();
    pushMatrix();
    transformMat.rotate(SAngle, 0.0, 0.0, 1.0);
    transformMat.translate(0.04*scale, -0.22*scale, 0.0);
    transformMat.scale(scale, scale, 0.0);

    var eye_circles = init_circle(0.05,[1,1,1]);
    var float_circles = new Float32Array(eye_circles);
    draw_circle(gl,program,float_circles);
    gl.uniformMatrix4fv(u_modelMatrix, false, transformMat.elements);
    gl.drawArrays(gl.TRIANGLES, 0, float_circles.length/2);

    var g_holcir = init_holcir(a_SColor);
    var float_holcir = new Float32Array(g_holcir);
    draw_circle(gl,program,float_holcir);
    gl.uniformMatrix4fv(u_modelMatrix, false, transformMat.elements);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, float_circles.length/2);

    // draw circles
    var float_circles = new Float32Array(g_circles);
    draw_circle(gl,program,float_circles);
    popMatrix();
    transformMat.translate(-0.4*scale, 0*scale, 0.0);
    pushMatrix();
    transformMat.scale(scale, scale, 0.0);
    gl.uniformMatrix4fv(u_modelMatrix, false, transformMat.elements);
    gl.drawArrays(gl.TRIANGLES, 0, float_circles.length/2);

    // draw C
    popMatrix();
    pushMatrix();
    transformMat.rotate(parseFloat(CAngle)+parseFloat(180), 0.0, 0.0, 1.0);
    transformMat.translate(0.04*scale, -0.22*scale, 0.0);
    transformMat.scale(scale, scale, 0.0);
    
    var float_circles = new Float32Array(eye_circles);
    draw_circle(gl,program,float_circles);
    gl.uniformMatrix4fv(u_modelMatrix, false, transformMat.elements);
    gl.drawArrays(gl.TRIANGLES, 0, float_circles.length/2);

    var g_holcir = init_holcir(a_CColor);
    var float_holcir = new Float32Array(g_holcir);
    draw_circle(gl,program,float_holcir);
    gl.uniformMatrix4fv(u_modelMatrix, false, transformMat.elements);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, float_circles.length/2);
}
