//This tempalte is just for your reference
//You do not have to follow this template 
//You are very welcome to write your program from scratch

//shader
var VSHADER_SOURCE = `
    attribute vec4 a_Position;
    attribute vec4 a_Color;
    varying vec4 v_Color;
    void main(){
        gl_Position = a_Position;
        gl_PointSize = 10.0;
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



var shapeFlag = 'p'; //p: point, h: hori line: v: verti line, t: triangle, q: square, c: circle
var colorFlag = 'r'; //r g b 
var g_points = [];
var g_horiLines = [];
var g_vertiLines = [];
var g_triangles = [];
var g_squares = [];
var g_circles = [];
//var ... of course you may need more variables
var unit_n = 5;

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

function main(){
    //////Get the canvas context
    var canvas = document.getElementById('webgl');
    //var gl = canvas.getContext('webgl') || canvas.getContext('exprimental-webgl') ;
    var gl = canvas.getContext('webgl2');
    if(!gl){
        console.log('Failed to get the rendering context for WebGL');
        return ;
    }

    // compile shader and use program
    let renderProgram = compileShader(gl, VSHADER_SOURCE, FSHADER_SOURCE);

    gl.useProgram(renderProgram);

    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // mouse and key event...
    canvas.onmousedown = function(ev){click(ev,canvas,gl,renderProgram)};
    document.onkeydown = function(ev){keydown(ev)};
}



function keydown(ev){ //you may want to define more arguments for this function
    //implment keydown event here
    var colorType = ['r','g','b'];
    var shapeType = ['p','h','v','t','q','c'];
    if(colorType.includes(ev.key)){ //an example for user press 'r'... 
        //......  
        colorFlag = ev.key;
        console.log("color: " + ev.key);
    }else if(shapeType.includes(ev.key)){
        shapeFlag = ev.key;
        console.log("shape: " + ev.key);
    }
}

function click(ev,canvas,gl,program){ //you may want to define more arguments for this function
    //mouse click: recall our quiz1 in calss
    var x = ev.clientX;
    var y = ev.clientY;
    var rect = ev.target.getBoundingClientRect();

    x = ((x - rect.left) - canvas.height/2)/(canvas.height/2)
    y = (canvas.width/2 - (y - rect.top))/(canvas.height/2)
    var xyrgb = [];
    var shape = [];

    console.log("x: " + x);
    console.log("y: " + y);
    console.log("rect. left, top, width, height: " + rect.left + " "  + rect.top + " " + rect.width + " " + rect.height );
    
    //you might want to do something here
    var rgb = [];
    if(colorFlag == 'r'){
        rgb.push(1.0,0.0,0.0);
    }else if(colorFlag == 'g'){
        rgb.push(0.0,1.0,0.0);
    }else if(colorFlag == 'b'){
        rgb.push(0.0,0.0,1.0);
    }
    

    if(shapeFlag == 'p'){
        if(g_points.length == 5 * unit_n) g_points.splice(0,5);
        xyrgb = xyrgb.concat([x,y],rgb);
        g_points = g_points.concat(xyrgb);
    }else if(shapeFlag == 'h'){
        if(g_horiLines.length == 10 * unit_n) g_horiLines.splice(0,10);
        xyrgb = xyrgb.concat([1,y],rgb,[-1,y],rgb);
        g_horiLines = g_horiLines.concat(xyrgb);
    }else if(shapeFlag == 'v'){
        if(g_vertiLines.length == 10 * unit_n) g_vertiLines.splice(0,10);
        xyrgb = xyrgb.concat([x,1],rgb,[x,-1],rgb);
        g_vertiLines = g_vertiLines.concat(xyrgb);
    }else if(shapeFlag == 't'){
        if(g_triangles.length == 15 * unit_n) g_triangles.splice(0,15);
        xyrgb = xyrgb.concat([x,y+0.03],rgb,[x-0.03,y-0.03],rgb,[x+0.03,y-0.03],rgb);
        g_triangles = g_triangles.concat(xyrgb);
    }else if(shapeFlag == 'q'){
        if(g_squares.length == 30 * unit_n) g_squares.splice(0,30);
        xyrgb = xyrgb.concat([x-0.05,y+0.05],rgb,[x+0.05,y+0.05],rgb,[x-0.05,y-0.05],rgb,[x+0.05,y+0.05],rgb,[x-0.05,y-0.05],rgb,[x+0.05,y-0.05],rgb);
        g_squares = g_squares.concat(xyrgb);
    }else if(shapeFlag == 'c'){
        if(g_circles.length == (15*200) * unit_n) g_circles.splice(0,(15*200));
        var r = 0.03;
        for(var i = 0; i < 200; i ++){
            var circle = [];
            xyrgb = xyrgb.concat([x,y],rgb);
            circle.push(x + r*Math.cos(i * Math.PI / 100),y + r*Math.sin(i * Math.PI / 100));
            circle = circle.concat(rgb);
            circle.push(x + r*Math.cos((i+1) * Math.PI / 100),y + r*Math.sin((i+1) * Math.PI / 100));
            xyrgb = xyrgb.concat(circle,rgb);
            console.log(xyrgb);
        }
        g_circles = g_circles.concat(xyrgb);
    }

    //self-define draw() function
    //I suggest that you can clear the canvas
    //and redraw whole frame(canvas) after any mouse click
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    draw(gl,program);
}


function draw(gl,program){ //you may want to define more arguments for this function
    //redraw whole canvas here
    //Note: you are only allowed to same shapes of this frame by single gl.drawArrays() call
    var vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);

    // points
    var float_points = new Float32Array(g_points);
    gl.bufferData(gl.ARRAY_BUFFER,float_points , gl.STATIC_DRAW);
    var FSIZE_points = float_points.BYTES_PER_ELEMENT;

    var a_Position = gl.getAttribLocation(program, 'a_Position');
    gl.vertexAttribPointer(a_Position, 2, gl.FLOAT, false, FSIZE_points*5, 0);
    gl.enableVertexAttribArray(a_Position);

    var a_Color = gl.getAttribLocation(program, 'a_Color');
    gl.vertexAttribPointer(a_Color, 3, gl.FLOAT, false, FSIZE_points*5, FSIZE_points*2);
    gl.enableVertexAttribArray(a_Color);

    console.log("n: " + g_points.length/5);
    gl.drawArrays(gl.POINTS, 0, g_points.length/5);

    // horizontal line
    var float_horiLines = new Float32Array(g_horiLines);
    gl.bufferData(gl.ARRAY_BUFFER,float_horiLines , gl.STATIC_DRAW);
    var FSIZE_horiLines = float_horiLines.BYTES_PER_ELEMENT;

    var a_Position = gl.getAttribLocation(program, 'a_Position');
    gl.vertexAttribPointer(a_Position, 2, gl.FLOAT, false, FSIZE_horiLines*5, 0);
    gl.enableVertexAttribArray(a_Position);

    var a_Color = gl.getAttribLocation(program, 'a_Color');
    gl.vertexAttribPointer(a_Color, 3, gl.FLOAT, false, FSIZE_horiLines*5, FSIZE_horiLines*2);
    gl.enableVertexAttribArray(a_Color);

    console.log("n: " + g_horiLines.length/5);
    gl.drawArrays(gl.LINES, 0, g_horiLines.length/5);

    // vertical line
    var float_vertiLines = new Float32Array(g_vertiLines);
    gl.bufferData(gl.ARRAY_BUFFER,float_vertiLines , gl.STATIC_DRAW);
    var FSIZE_vertiLines = float_vertiLines.BYTES_PER_ELEMENT;

    var a_Position = gl.getAttribLocation(program, 'a_Position');
    gl.vertexAttribPointer(a_Position, 2, gl.FLOAT, false, FSIZE_vertiLines*5, 0);
    gl.enableVertexAttribArray(a_Position);

    var a_Color = gl.getAttribLocation(program, 'a_Color');
    gl.vertexAttribPointer(a_Color, 3, gl.FLOAT, false, FSIZE_vertiLines*5, FSIZE_vertiLines*2);
    gl.enableVertexAttribArray(a_Color);

    console.log("n: " + g_vertiLines.length/5);
    gl.drawArrays(gl.LINES, 0, g_vertiLines.length/5);

    // triangle
    var float_triangles = new Float32Array(g_triangles);
    gl.bufferData(gl.ARRAY_BUFFER,float_triangles , gl.STATIC_DRAW);
    var FSIZE_triangles = float_triangles.BYTES_PER_ELEMENT;

    var a_Position = gl.getAttribLocation(program, 'a_Position');
    gl.vertexAttribPointer(a_Position, 2, gl.FLOAT, false, FSIZE_triangles*5, 0);
    gl.enableVertexAttribArray(a_Position);

    var a_Color = gl.getAttribLocation(program, 'a_Color');
    gl.vertexAttribPointer(a_Color, 3, gl.FLOAT, false, FSIZE_triangles*5, FSIZE_triangles*2);
    gl.enableVertexAttribArray(a_Color);

    console.log("n: " + g_triangles.length/5);
    gl.drawArrays(gl.TRIANGLES, 0, g_triangles.length/5);


    // square
    var float_squares = new Float32Array(g_squares);
    gl.bufferData(gl.ARRAY_BUFFER,float_squares , gl.STATIC_DRAW);
    var FSIZE_squares = float_squares.BYTES_PER_ELEMENT;

    var a_Position = gl.getAttribLocation(program, 'a_Position');
    gl.vertexAttribPointer(a_Position, 2, gl.FLOAT, false, FSIZE_squares*5, 0);
    gl.enableVertexAttribArray(a_Position);

    var a_Color = gl.getAttribLocation(program, 'a_Color');
    gl.vertexAttribPointer(a_Color, 3, gl.FLOAT, false, FSIZE_squares*5, FSIZE_squares*2);
    gl.enableVertexAttribArray(a_Color);

    console.log("n: " + g_squares.length/5);
    gl.drawArrays(gl.TRIANGLES, 0, g_squares.length/5);

    // square
    var float_circles = new Float32Array(g_circles);
    gl.bufferData(gl.ARRAY_BUFFER,float_circles , gl.STATIC_DRAW);
    var FSIZE_circles = float_circles.BYTES_PER_ELEMENT;

    var a_Position = gl.getAttribLocation(program, 'a_Position');
    gl.vertexAttribPointer(a_Position, 2, gl.FLOAT, false, FSIZE_circles*5, 0);
    gl.enableVertexAttribArray(a_Position);

    var a_Color = gl.getAttribLocation(program, 'a_Color');
    gl.vertexAttribPointer(a_Color, 3, gl.FLOAT, false, FSIZE_circles*5, FSIZE_circles*2);
    gl.enableVertexAttribArray(a_Color);

    console.log("n: " + g_circles.length/5);
    gl.drawArrays(gl.TRIANGLES, 0, g_circles.length/5);
}
