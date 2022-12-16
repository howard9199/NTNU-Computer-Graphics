var VSHADER_SOURCE = `
    precision mediump float;
    attribute vec4 a_Position;
    attribute vec4 a_Normal;
    attribute vec2 a_TexCoord;
    attribute vec3 a_Tagent;
    attribute vec3 a_Bitagent;
    attribute float a_crossTexCoord;
    uniform mat4 u_MvpMatrix;
    uniform mat4 u_modelMatrix;
    uniform mat4 u_lightMatrix;
    uniform mat4 u_normalMatrix;
    uniform mat4 u_ProjMatrixFromLight;
    uniform mat4 u_MvpMatrixOfLight;
    varying vec4 v_PositionFromLight;
    varying vec3 v_Normal;
    varying vec3 v_PositionInWorld;
    varying vec2 v_TexCoord;
    varying mat4 v_TBN;
    void main(){
        gl_Position = u_MvpMatrix * a_Position;
        v_PositionInWorld = (u_modelMatrix * a_Position).xyz; 
        v_Normal = normalize(vec3(u_normalMatrix * a_Normal));
        v_TexCoord = a_TexCoord;
        v_PositionFromLight = u_MvpMatrixOfLight * a_Position; //for shadow
        //create TBN matrix 
        vec3 tagent = normalize(a_Tagent);
        vec3 bitagent = normalize(a_Bitagent);
        vec3 nVector;
        if( a_crossTexCoord > 0.0){
          nVector = cross(tagent, bitagent);
        } else{
          nVector = cross(bitagent, tagent);
        }
        v_TBN = mat4(tagent.x, tagent.y, tagent.z, 0.0, 
                           bitagent.x, bitagent.y, bitagent.z, 0.0,
                           nVector.x, nVector.y, nVector.z, 0.0, 
                           0.0, 0.0, 0.0, 1.0);
    }    
`;

var FSHADER_SOURCE = `
    precision mediump float;
    uniform mat4 u_modelMatrix;
    uniform mat4 u_lightMatrix;
    uniform vec3 u_ViewPosition;
    uniform float u_Ka;
    uniform float u_Kd;
    uniform float u_Ks;
    uniform float u_shininess;
    uniform int tex_mode;
    uniform int is_light;
    uniform vec3 u_Color;
    uniform sampler2D u_Sampler0;
    uniform sampler2D u_Sampler2;
    uniform sampler2D u_ShadowMap;
    uniform mat4 u_normalMatrix;
    uniform bool u_normalMode;
    varying vec3 v_Normal;
    varying vec3 v_PositionInWorld;
    varying vec2 v_TexCoord;
    varying vec4 v_PositionFromLight;
    varying mat4 v_TBN;

    const float deMachThreshold = 0.005; //0.001 if having high precision depth
    void main(){
        vec3 u_LightPosition;
        if(is_light >= 1){
            u_LightPosition = vec3(0.0,5.0,3.0);
        }else{
            u_LightPosition = (u_lightMatrix * vec4(0.0,2.0,1.0,1.0)).xyz;
        }
        
        // let ambient and diffuse color are u_Color 
        // (you can also input them from ouside and make them different)
        vec3 texColor;
        if(tex_mode == 0){
          texColor = texture2D( u_Sampler0, v_TexCoord ).rgb;
        }else{
          texColor = u_Color;
        }
        vec3 ambientLightColor = texColor;
        vec3 diffuseLightColor = texColor;
        // assume white specular light (you can also input it from ouside)
        vec3 specularLightColor = vec3(1.0, 1.0, 1.0);        

        vec3 ambient = ambientLightColor * u_Ka;

        //vec3 normal = normalize(v_Normal);
        vec3 normal;
        if( u_normalMode ){
          //3D object's normal vector
          normal = normalize(v_Normal);
        }else{
        //normal vector from normal map
          vec3 nMapNormal = normalize( texture2D( u_Sampler2, v_TexCoord ).rgb * 2.0 - 1.0 );
          normal = normalize( vec3( u_normalMatrix * v_TBN * vec4( nMapNormal, 1.0) ) );
        }

        vec3 lightDirection = normalize(u_LightPosition - v_PositionInWorld);
        float nDotL = max(dot(lightDirection, normal), 0.0);
        vec3 diffuse = diffuseLightColor * u_Kd * nDotL;

        vec3 specular = vec3(0.0, 0.0, 0.0);
        if(nDotL > 0.0) {
            vec3 R = reflect(-lightDirection, normal);
            // V: the vector, point to viewer       
            vec3 V = normalize(u_ViewPosition - v_PositionInWorld); 
            float specAngle = clamp(dot(R, V), 0.0, 1.0);
            specular = u_Ks * pow(specAngle, u_shininess) * specularLightColor; 
        }
        //***** shadow
        vec3 shadowCoord = (v_PositionFromLight.xyz/v_PositionFromLight.w)/2.0 + 0.5;
        vec4 rgbaDepth = texture2D(u_ShadowMap, shadowCoord.xy);
        /////////******** LOW precision depth implementation ********///////////
        float depth = rgbaDepth.r;
        float visibility = (shadowCoord.z > depth + deMachThreshold) ? 0.3 : 1.0;

        gl_FragColor = vec4( (ambient + diffuse + specular)*visibility, 1.0 );
        if(is_light >= 1){
            gl_FragColor = vec4(1.0,1.0,1.0, 1.0 );
        }
    }
`;

var VSHADER_SHADOW_SOURCE = `
      attribute vec4 a_Position;
      uniform mat4 u_MvpMatrix;
      void main(){
          gl_Position = u_MvpMatrix * a_Position;
      }
  `;

var FSHADER_SHADOW_SOURCE = `
      precision mediump float;
      void main(){
        /////////** LOW precision depth implementation **/////
        gl_FragColor = vec4(gl_FragCoord.z, 0.0, 0.0, 1.0);
      }
  `;

var VSHADER_SOURCE_ENVCUBE = `
  attribute vec4 a_Position;
  varying vec4 v_Position;
  void main() {
    v_Position = a_Position;
    gl_Position = a_Position;
  } 
`;

var FSHADER_SOURCE_ENVCUBE = `
  precision mediump float;
  uniform samplerCube u_envCubeMap;
  uniform mat4 u_viewDirectionProjectionInverse;
  varying vec4 v_Position;
  void main() {
    vec4 t = u_viewDirectionProjectionInverse * v_Position;
    gl_FragColor = textureCube(u_envCubeMap, normalize(t.xyz / t.w));
  }
`;

function compileShader(gl, vShaderText, fShaderText) {
    //////Build vertex and fragment shader objects
    var vertexShader = gl.createShader(gl.VERTEX_SHADER);
    var fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    //The way to  set up shader text source
    gl.shaderSource(vertexShader, vShaderText);
    gl.shaderSource(fragmentShader, fShaderText);
    //compile vertex shader
    gl.compileShader(vertexShader);
    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
        console.log("vertex shader ereror");
        var message = gl.getShaderInfoLog(vertexShader);
        console.log(message); //print shader compiling error message
    }
    //compile fragment shader
    gl.compileShader(fragmentShader);
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
        console.log("fragment shader ereror");
        var message = gl.getShaderInfoLog(fragmentShader);
        console.log(message); //print shader compiling error message
    }

    /////link shader to program (by a self-define function)
    var program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    //if not success, log the program info, and delete it.
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        alert(gl.getProgramInfoLog(program) + "");
        gl.deleteProgram(program);
    }

    return program;
}

/////BEGIN:///////////////////////////////////////////////////////////////////////////////////////////////
/////The folloing three function is for creating vertex buffer, but link to shader to user later//////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////
function initAttributeVariable(gl, a_attribute, buffer) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.vertexAttribPointer(a_attribute, buffer.num, buffer.type, false, 0, 0);
    gl.enableVertexAttribArray(a_attribute);
}

function initArrayBufferForLaterUse(gl, data, num, type) {
    // Create a buffer object
    var buffer = gl.createBuffer();
    if (!buffer) {
        console.log("Failed to create the buffer object");
        return null;
    }
    // Write date into the buffer object
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);

    // Store the necessary information to assign the object to the attribute variable later
    buffer.num = num;
    buffer.type = type;

    return buffer;
}

function initVertexBufferForLaterUse(gl, vertices, normals, texCoords, tagents, bitagents, crossTexCoords) {
    var nVertices = vertices.length / 3;

    var o = new Object();
    o.vertexBuffer = initArrayBufferForLaterUse(gl, new Float32Array(vertices), 3, gl.FLOAT);
    if (normals != null) o.normalBuffer = initArrayBufferForLaterUse(gl, new Float32Array(normals), 3, gl.FLOAT);
    if (texCoords != null) o.texCoordBuffer = initArrayBufferForLaterUse(gl, new Float32Array(texCoords), 2, gl.FLOAT);
    if (tagents != null) o.tagentsBuffer = initArrayBufferForLaterUse(gl, new Float32Array(tagents), 3, gl.FLOAT);
    if (bitagents != null) o.bitagentsBuffer = initArrayBufferForLaterUse(gl, new Float32Array(bitagents), 3, gl.FLOAT);
    if (crossTexCoords != null)
        o.crossTexCoordsBuffer = initArrayBufferForLaterUse(gl, new Float32Array(crossTexCoords), 1, gl.FLOAT);
    //you can have error check here
    o.numVertices = nVertices;

    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

    return o;
}
/*function initVertexBufferForLaterUse(gl, vertices, normals, texCoords) {
    var nVertices = vertices.length / 3;

    var o = new Object();
    o.vertexBuffer = initArrayBufferForLaterUse(gl, new Float32Array(vertices), 3, gl.FLOAT);
    if (normals != null) o.normalBuffer = initArrayBufferForLaterUse(gl, new Float32Array(normals), 3, gl.FLOAT);
    if (texCoords != null) o.texCoordBuffer = initArrayBufferForLaterUse(gl, new Float32Array(texCoords), 2, gl.FLOAT);
    //you can have error check here
    o.numVertices = nVertices;

    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

    return o;
}*/

/////END://///////////////////////////////////////////////////////////////////////////////////////////////
/////The folloing three function is for creating vertex buffer, but link to shader to user later//////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////

var mouseLastX, mouseLastY;
var mouseDragging = false;
var angleX = 0,
    angleY = 0;
var zoom = 1;
var tx = 0;
var tz = 0;
var joint1 = 0;
var joint2 = 0;

var gl, canvas;
var mvpMatrix;
var modelMatrix;
var normalMatrix;
var nVertex;
var cameraX = 0,
    cameraY = 1.2,
    cameraZ = 0;
var shiftX = 0;
var shiftY = 0;
var shiftZ = 0;
var initialX = 0,
    initialY = 1.2,
    initialZ = 0;
/*var initialX = 0,
    initialY = 2,
    initialZ = 1;*/
var lightX = 0,
    lightY = 5,
    lightZ = 3;
var cameraDirX = 0,
    cameraDirY = 0,
    cameraDirZ = -1;
var objScale = 1.0;
var ground = [];
var pyramid = [];
var trashcan = [];
var lid = [];
var cylinder = [];
var disc = [];
var vacuum = [];
var pyramid = [];
var sphere = [];
var table = [];
var chair = [];
var sonic = [];
var bomb = [];
var textures = {};
var texCount = 0;
var numTextures = 1; //brick
var offScreenWidth = 2048,
    offScreenHeight = 2048;
var fbo;
var cubebo;
var fixed = 0;
var quadObj;
var cubeMapTex;
var viewMode = 1;
var rotatebomb = 0;

// Matrix pop and push
var mdlMatrix = new Matrix4();
var lightMatrix = new Matrix4();
var matStack = [];
var u_modelMatrix;
function pushMatrix() {
    matStack.push(new Matrix4(mdlMatrix));
}
function popMatrix() {
    mdlMatrix = matStack.pop();
}

async function create_obj(obj_name, objComponents, limit_mode, limit_obj) {
    response = await fetch(obj_name);
    text = await response.text();
    obj = parseOBJ(text);

    for (let i = 0; i < obj.geometries.length; i++) {
        if (limit_mode == 1 && limit_obj.indexOf(obj.geometries[i].object) != -1) {
            continue;
        } else if (limit_mode == 2 && limit_obj.indexOf(obj.geometries[i].object) == -1) {
            continue;
        }
        let tagentSpace = calculateTangentSpace(obj.geometries[i].data.position, obj.geometries[i].data.texcoord);
        let o = initVertexBufferForLaterUse(
            gl,
            obj.geometries[i].data.position,
            obj.geometries[i].data.normal,
            obj.geometries[i].data.texcoord,
            tagentSpace.tagents,
            tagentSpace.bitagents,
            tagentSpace.crossTexCoords
        );
        objComponents.push(o);
    }
}

function bind_img_tex(img_name, texture_name) {
    var imageChess = new Image();
    imageChess.onload = function () {
        initTexture(gl, imageChess, texture_name);
    };
    imageChess.src = img_name;
}

async function main() {
    set_mine();
    canvas = document.getElementById("webgl");
    gl = canvas.getContext("webgl2");
    if (!gl) {
        console.log("Failed to get the rendering context for WebGL");
        return;
    }
    var quad = new Float32Array([-1, -1, 1, 1, -1, 1, -1, 1, 1, -1, 1, 1, 1, -1, 1, 1, 1, 1]); //just a quad

    programEnvCube = compileShader(gl, VSHADER_SOURCE_ENVCUBE, FSHADER_SOURCE_ENVCUBE);
    programEnvCube.a_Position = gl.getAttribLocation(programEnvCube, "a_Position");
    programEnvCube.u_envCubeMap = gl.getUniformLocation(programEnvCube, "u_envCubeMap");
    programEnvCube.u_viewDirectionProjectionInverse = gl.getUniformLocation(
        programEnvCube,
        "u_viewDirectionProjectionInverse"
    );

    quadObj = initVertexBufferForLaterUse(gl, quad);

    cubeMapTex = initCubeTexture(
        "./texture/cubemap/pos-x.jpg",
        "./texture/cubemap/neg-x.jpg",
        "./texture/cubemap/pos-y.jpg",
        "./texture/cubemap/neg-y.jpg",
        "./texture/cubemap/pos-z.jpg",
        "./texture/cubemap/neg-z.jpg",
        512,
        512
    );

    //setup shaders and prepare shader variables
    shadowProgram = compileShader(gl, VSHADER_SHADOW_SOURCE, FSHADER_SHADOW_SOURCE);
    shadowProgram.a_Position = gl.getAttribLocation(shadowProgram, "a_Position");
    shadowProgram.u_MvpMatrix = gl.getUniformLocation(shadowProgram, "u_MvpMatrix");

    program = compileShader(gl, VSHADER_SOURCE, FSHADER_SOURCE);

    var txSlider = document.getElementById("zoom");
    txSlider.oninput = function () {
        zoom = this.value / 50.0; //convert sliders value to -1 to +1
        draw();
    };

    //setup the call back function of tx Sliders
    var txSlider = document.getElementById("Translate-X");
    txSlider.oninput = function () {
        tx = this.value / 100.0; //convert sliders value to -1 to +1
        draw();
    };

    //setup the call back function of tx Sliders
    var tzSlider = document.getElementById("Translate-Z");
    tzSlider.oninput = function () {
        tz = this.value / 100.0; //convert sliders value to -1 to +1
        draw();
    };

    var j1Slider = document.getElementById("joint1");
    j1Slider.oninput = function () {
        joint1 = this.value / 1.0; //convert sliders value to -1 to +1
        draw();
    };

    var j2Slider = document.getElementById("joint2");
    j2Slider.oninput = function () {
        joint2 = this.value / 1.0; //convert sliders value to -1 to +1
        draw();
    };

    gl.useProgram(program);

    program.a_Position = gl.getAttribLocation(program, "a_Position");
    program.a_TexCoord = gl.getAttribLocation(program, "a_TexCoord");
    program.a_Normal = gl.getAttribLocation(program, "a_Normal");
    program.a_Tagent = gl.getAttribLocation(program, "a_Tagent");
    program.a_Bitagent = gl.getAttribLocation(program, "a_Bitagent");
    program.a_crossTexCoord = gl.getAttribLocation(program, "a_crossTexCoord");
    program.u_MvpMatrix = gl.getUniformLocation(program, "u_MvpMatrix");
    program.u_modelMatrix = gl.getUniformLocation(program, "u_modelMatrix");
    program.u_normalMatrix = gl.getUniformLocation(program, "u_normalMatrix");
    program.u_lightMatrix = gl.getUniformLocation(program, "u_lightMatrix");
    program.u_normalMode = gl.getUniformLocation(program, "u_normalMode");

    //program.u_LightPosition = gl.getUniformLocation(program, "u_LightPosition");
    program.u_ViewPosition = gl.getUniformLocation(program, "u_ViewPosition");
    program.u_MvpMatrixOfLight = gl.getUniformLocation(program, "u_MvpMatrixOfLight");
    program.u_Ka = gl.getUniformLocation(program, "u_Ka");
    program.u_Kd = gl.getUniformLocation(program, "u_Kd");
    program.u_Ks = gl.getUniformLocation(program, "u_Ks");
    program.u_shininess = gl.getUniformLocation(program, "u_shininess");
    program.u_ShadowMap = gl.getUniformLocation(program, "u_ShadowMap");
    program.u_Sampler0 = gl.getUniformLocation(program, "u_Sampler0");
    program.u_Sampler2 = gl.getUniformLocation(program, "u_Sampler2");
    program.u_Color = gl.getUniformLocation(program, "u_Color");
    program.tex_mode = gl.getUniformLocation(program, "tex_mode");
    program.is_light = gl.getUniformLocation(program, "is_light");

    create_obj("sonic.obj", sonic, 0);
    create_obj("./obj/bomb-obj/bomb.obj", bomb, 0);

    create_obj("cube.obj", ground, 0);
    create_obj("pyramid.obj", pyramid, 0);
    //create_obj("trash-can.obj", lid, 1, "Cylinder");
    //create_obj("trash-can.obj", trashcan, 2, ["Cylinder"]);
    create_obj("hollow-cylinder.obj", cylinder, 0);
    create_obj("cylinder.obj", disc, 0);
    create_obj("vacuum.obj", vacuum, 0);
    create_obj("pyramid.obj", pyramid, 0);
    create_obj("sphere.obj", sphere, 0);
    create_obj("table.obj", table, 0);
    create_obj("chair.obj", chair, 0);

    bind_img_tex("chess.jpg", "chessTex");
    //bind_img_tex("webglIcon.jpg", "webglIconTex");
    bind_img_tex("plastic.jpg", "plasticTex");
    bind_img_tex("Wood.jpg", "woodTex");
    bind_img_tex("table_tex.jpg", "tableTex");

    bind_img_tex("./texture/mine/mine100.jpg", "mine100Tex");
    bind_img_tex("./texture/mine/mine0.jpg", "mine0Tex");
    bind_img_tex("./texture/mine/mine1.jpg", "mine1Tex");
    bind_img_tex("./texture/mine/mine2.jpg", "mine2Tex");
    bind_img_tex("./texture/mine/mine3.jpg", "mine3Tex");
    bind_img_tex("./texture/mine/mine4.jpg", "mine4Tex");
    bind_img_tex("./texture/mine/mine5.jpg", "mine5Tex");
    bind_img_tex("./texture/mine/grass.jpg", "grassTex");
    bind_img_tex("./texture/mine/ongrass.jpg", "ongrassTex");
    bind_img_tex("./normalmap/foxnormal.jpeg", "normalmap");
    bind_img_tex("./normalmap/hole.png", "holenormal");

    mvpMatrix = new Matrix4();
    modelMatrix = new Matrix4();
    normalMatrix = new Matrix4();

    gl.enable(gl.DEPTH_TEST);
    fbo = initFrameBuffer(gl);
    cubebo = initFrameBuffer(gl);

    canvas.onmousedown = function (ev) {
        mouseDown(ev);
    };
    canvas.onmousemove = function (ev) {
        mouseMove(ev);
    };
    canvas.onmouseup = function (ev) {
        mouseUp(ev);
    };
    document.onkeydown = function (ev) {
        keydown(ev);
    };
    var tick = function () {
        rotatebomb += 0.45;
        draw();
        requestAnimationFrame(tick);
    };
    tick();
}

function draw() {
    ///// off scree shadow
    normalMode = 1;
    gl.useProgram(shadowProgram);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.viewport(0, 0, offScreenWidth, offScreenHeight);
    gl.clearColor(0.0, 0.0, 0.0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);

    //let mdlMatrix = new Matrix4(); //model matrix of objects
    let sphereMatrix = new Matrix4();
    sphereMatrix.setIdentity();
    sphereMatrix.translate(0, 2, 1);
    sphereMatrix.scale(0.2, 0.2, 0.2);
    let sphereMvpFromLight = new Matrix4(); //drawOffScreen(sphere, sphereMatrix);

    /*let cubeMatrix = new Matrix4();
    cubeMatrix.setIdentity();
    cubeMatrix.translate(1.5, 1.3, 1.6);
    cubeMatrix.scale(0.2, 0.2, 0.2);
    let cubeMvpFromLight = drawOffScreen(ground, cubeMatrix);*/

    let groundMatrix = new Matrix4();
    groundMatrix.setIdentity();
    groundMatrix.scale(1.92, 0.1, 1.92);
    let groundMvpFromLight = drawOffScreen(ground, groundMatrix);

    let sonicMatrix = new Matrix4();
    sonicMatrix.setIdentity();
    sonicMatrix.scale(0.01, 0.01, 0.01);
    sonicMatrix.translate(shiftX * 100, 15, shiftZ * 100);
    let sonicMvpFromLight = drawOffScreen(sonic, sonicMatrix);

    let bombMatrix = new Matrix4();
    bombMatrix.setIdentity();
    bombMatrix.scale(0.05, 0.05, 0.05);
    bombMatrix.translate(shiftX * 20, 0, shiftZ * 20);
    bombMatrix.rotate(rotatebomb * 10, 0, 1, 0);
    bombMatrix.translate(0, 5, 12);
    let bombMvpFromLight = drawOffScreen(bomb, bombMatrix);

    /*let tableMatrix = new Matrix4();
    tableMatrix.translate(1.5, -0.1, 1.5);
    tableMatrix.scale(0.6, 0.6, 0.6);
    let tableMvpFromLight = drawOffScreen(table, tableMatrix);

    let chairMatrix = new Matrix4();
    chairMatrix.setIdentity();
    chairMatrix.translate(1.5, -0.1, 1);
    chairMatrix.scale(0.025, 0.025, 0.025);
    let chairMvpFromLight = drawOffScreen(chair, chairMatrix);

    let vacuumMatrix = new Matrix4();
    vacuumMatrix.translate(0 + tx, 0.14, 0 + tz);
    vacuumMatrix.scale(0.4, 0.4, 0.4);
    let vacuumMvpFromLight = drawOffScreen(vacuum, vacuumMatrix);
    mdlMatrix = vacuumMatrix;
    //console.log(vacuumMatrix);

    let pyramidMatrix = new Matrix4();
    pyramidMatrix.translate(0 + tx, 0.14, 0 + tz);
    pyramidMatrix.scale(0.4, 0.4, 0.4);
    pyramidMatrix.translate(-0.4, 0, 0);
    mdlMatrix = pyramidMatrix;
    pushMatrix();
    pyramidMatrix.scale(0.02, 0.02, 0.02);
    let pyramidMvpFromLight = drawOffScreen(pyramid, pyramidMatrix);
    popMatrix();
    //console.log(vacuumMatrix);

    let poleMatrix = mdlMatrix;
    poleMatrix.translate(0, 0.3, 0);
    poleMatrix.rotate(tx * 30 + joint1, 0, 0, 1);
    poleMatrix.translate(0, 0.6, 0);
    mdlMatrix = poleMatrix;
    pushMatrix();
    poleMatrix.scale(0.1, 0.5, 0.1);
    let poleMvpFromLight = drawOffScreen(ground, poleMatrix);
    popMatrix();

    let vacsphereMatrix = mdlMatrix;
    vacsphereMatrix.translate(0, 0.5, 0);
    mdlMatrix = vacsphereMatrix;
    pushMatrix();
    vacsphereMatrix.scale(0.3, 0.3, 0.3);
    let vacsphereMvpFromLight = drawOffScreen(sphere, vacsphereMatrix);
    popMatrix();

    let discMatrix = mdlMatrix;
    discMatrix.rotate(tz * 30 + joint2, 1, 0, 0);
    discMatrix.translate(0, 0.3, 0);
    mdlMatrix = discMatrix;
    pushMatrix();
    discMatrix.scale(0.071, 0.001, 0.071);
    let discMvpFromLight = drawOffScreen(disc, discMatrix);
    popMatrix();

    let cylinderMatrix = mdlMatrix;
    cylinderMatrix.translate(0, 0.73, 0);
    cylinderMatrix.scale(1.5, 1.5, 1.5);
    let cylinderMvpFromLight = drawOffScreen(cylinder, cylinderMatrix);*/

    //
    gl.useProgram(program);
    /*gl.bindFramebuffer(gl.FRAMEBUFFER, cubebo);
    gl.viewport(0, 0, offScreenWidth, offScreenHeight);
    //gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.4, 0.4, 0.4, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    fixed = 1;

    gl.uniform1i(program.is_light, 1);
    drawOneObject(sphere, "chessTex", sphereMatrix, sphereMvpFromLight, 1, 1, 1, 1);
    gl.uniform1i(program.is_light, 0);
    drawOneObject(ground, "chessTex", cubeMatrix, cubeMvpFromLight, 1, 1, 0, 1);
    drawOneObject(ground, "chessTex", groundMatrix, groundMvpFromLight, 0, 1, 0, 1);
    drawOneObject(sonic, "chessTex", sonicMatrix, sonicMvpFromLight, 1, 1, 0, 1);
    drawOneObject(bomb, "chessTex", bombMatrix, bombMvpFromLight, 1, 0, 0, 0);*/
    /*drawOneObject(table, "tableTex", tableMatrix, tableMvpFromLight, 0, 0.3, 0.4, 0.6);
    drawOneObject(chair, "woodTex", chairMatrix, chairMvpFromLight, 0, 0.3, 0.4, 0.6);
    drawOneObject(vacuum, "plasticTex", vacuumMatrix, vacuumMvpFromLight, 0, 0, 1, 0);
    drawOneObject(pyramid, "chessTex", pyramidMatrix, pyramidMvpFromLight, 1, 1, 1, 0);
    drawOneObject(ground, "chessTex", poleMatrix, poleMvpFromLight, 1, 1, 1, 1);
    drawOneObject(sphere, "chessTex", vacsphereMatrix, vacsphereMvpFromLight, 1, 1, 1, 1);
    drawOneObject(disc, "chessTex", discMatrix, discMvpFromLight, 1, 1, 0, 0);
    drawOneObject(cylinder, "chessTex", cylinderMatrix, cylinderMvpFromLight, 1, 1, 0, 0);*/

    fixed = 0;
    //textures["cubeTex"] = cubebo.texture;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform1i(program.is_light, 1);
    drawOneObject(sphere, "chessTex", sphereMatrix, sphereMvpFromLight, 1, 1, 1, 1);
    gl.uniform1i(program.is_light, 0);
    //drawOneObject(ground, "cubeTex", cubeMatrix, cubeMvpFromLight, 0, 1, 0, 1);
    drawOneObject(ground, "chessTex", groundMatrix, groundMvpFromLight, 0, 1, 0, 1);
    drawOneObject(sonic, "chessTex", sonicMatrix, sonicMvpFromLight, 1, 1, 0, 1);
    drawOneObject(bomb, "chessTex", bombMatrix, bombMvpFromLight, 1, 0, 0, 0);

    let mineMatrix = new Matrix4();
    normalMode = 0;
    for (let i = 0; i < 12; i++) {
        mineMatrix.setIdentity();
        mineMatrix.scale(0.16, 0.01, 0.16);
        mineMatrix.translate(-11, 10, -11 + 2 * i);
        for (let j = 0; j < 12; j++) {
            let mineMvpFromLight = drawOffScreen(ground, mineMatrix);
            drawOneObject(ground, "mine" + map[i * 12 + j] + "Tex", mineMatrix, mineMvpFromLight, 0, 1, 0, 1);
            mineMatrix.translate(2, 0, 0);
        }
    }
    normalMode = 1;

    let dirtMatrix = new Matrix4();

    for (let i = 0; i < 12; i++) {
        dirtMatrix.setIdentity();
        dirtMatrix.scale(0.16, 0.04, 0.16);
        dirtMatrix.translate(-11, 3, -11 + 2 * i);
        for (let j = 0; j < 12; j++) {
            if (dirt[i * 12 + j] == 0) {
                let dirtMvpFromLight = drawOffScreen(ground, dirtMatrix);
                if (
                    0.16 * (-12 + 2 * j) <= shiftX &&
                    shiftX <= 0.16 * (-12 + 2 * (j + 1)) &&
                    0.16 * (-12 + 2 * i) <= shiftZ &&
                    shiftZ <= 0.16 * (-12 + 2 * (i + 1))
                ) {
                    drawOneObject(ground, "ongrassTex", dirtMatrix, dirtMvpFromLight, 0, 1, 0, 1);
                } else {
                    drawOneObject(ground, "grassTex", dirtMatrix, dirtMvpFromLight, 0, 1, 0, 1);
                }
            }
            dirtMatrix.translate(2, 0, 0);
        }
    }
    /*drawOneObject(table, "tableTex", tableMatrix, tableMvpFromLight, 0, 0.3, 0.4, 0.6);
    drawOneObject(chair, "woodTex", chairMatrix, chairMvpFromLight, 0, 0.3, 0.4, 0.6);
    drawOneObject(vacuum, "plasticTex", vacuumMatrix, vacuumMvpFromLight, 0, 0, 1, 0);
    drawOneObject(pyramid, "chessTex", pyramidMatrix, pyramidMvpFromLight, 1, 1, 1, 0);
    drawOneObject(ground, "chessTex", poleMatrix, poleMvpFromLight, 1, 1, 1, 1);
    drawOneObject(sphere, "chessTex", vacsphereMatrix, vacsphereMvpFromLight, 1, 1, 1, 1);
    drawOneObject(disc, "chessTex", discMatrix, discMvpFromLight, 1, 1, 0, 0);
    drawOneObject(cylinder, "chessTex", cylinderMatrix, cylinderMvpFromLight, 1, 1, 0, 0);*/
    //mdlMatrix.setIdentity();

    /*mdlMatrix.rotate(tz * 90, 1, 0, 0);
    drawOneObject(lid, "chessTex", mdlMatrix, 1, 1, 0, 0);*/

    /*mdlMatrix.setIdentity();
    mdlMatrix.translate(-0.9, 0.75, 0.3);
    mdlMatrix.scale(0.5, 0.5, 0.5);
    drawOneObject(pyramid, "webglIconTex", mdlMatrix, 0);*/
}

function drawOffScreen(obj, mdlMatrix) {
    let rotateMatrix = new Matrix4();
    rotateMatrix.setRotate(angleY, 1, 0, 0); //for mouse rotation
    rotateMatrix.rotate(angleX, 0, 1, 0); //for mouse rotation
    var viewDir = new Vector3([cameraDirX, cameraDirY, cameraDirZ]);
    var newViewDir = rotateMatrix.multiplyVector3(viewDir);

    var mvpFromLight = new Matrix4();
    //model Matrix (part of the mvp matrix)
    let modelMatrix = new Matrix4();
    //modelMatrix.setRotate(angleY, 1, 0, 0);
    //modelMatrix.rotate(angleX, 0, 1, 0);
    modelMatrix.multiply(mdlMatrix);
    //mvp: projection * view * model matrix
    mvpFromLight.setPerspective(70, offScreenWidth / offScreenHeight, 1, 15);
    mvpFromLight.lookAt(lightX, lightY, lightZ, 0, 0, 0, 0, 1, 0);
    mvpFromLight.multiply(modelMatrix);

    gl.uniformMatrix4fv(shadowProgram.u_MvpMatrix, false, mvpFromLight.elements);

    for (let i = 0; i < obj.length; i++) {
        initAttributeVariable(gl, shadowProgram.a_Position, obj[i].vertexBuffer);
        gl.drawArrays(gl.TRIANGLES, 0, obj[i].numVertices);
    }

    return mvpFromLight;
}

//obj: the object components
//mdlMatrix: the model matrix without mouse rotation
//colorR, G, B: object color
function drawOneObject(obj, tex_name, mdlMatrix, mvpFromLight, tex_mode, colorR, colorG, colorB) {
    let rotateMatrix = new Matrix4();
    rotateMatrix.setRotate(angleY, 1, 0, 0); //for mouse rotation
    rotateMatrix.rotate(angleX, 0, 1, 0); //for mouse rotation
    var viewDir = new Vector3([cameraDirX, cameraDirY, cameraDirZ]);
    var newViewDir = rotateMatrix.multiplyVector3(viewDir);

    var vpFromCamera = new Matrix4();
    vpFromCamera.setPerspective(90, 1, 1, 15);
    var viewMatrixRotationOnly = new Matrix4();
    if (fixed == 1) {
        viewMatrixRotationOnly.lookAt(0, 2, 10, 0, 0, -1, 0, 1, 0);
    } else {
        viewMatrixRotationOnly.lookAt(
            cameraX,
            cameraY,
            cameraZ,
            cameraX + newViewDir.elements[0],
            cameraY + newViewDir.elements[1],
            cameraZ + newViewDir.elements[2],
            0,
            1,
            0
        );
    }
    viewMatrixRotationOnly.elements[12] = 0; //ignore translation
    viewMatrixRotationOnly.elements[13] = 0;
    viewMatrixRotationOnly.elements[14] = 0;
    vpFromCamera.multiply(viewMatrixRotationOnly);
    var vpFromCameraInverse = vpFromCamera.invert();

    //quad
    gl.useProgram(programEnvCube);
    gl.depthFunc(gl.LEQUAL);
    gl.uniformMatrix4fv(programEnvCube.u_viewDirectionProjectionInverse, false, vpFromCameraInverse.elements);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, cubeMapTex);
    gl.uniform1i(programEnvCube.u_envCubeMap, 2);
    initAttributeVariable(gl, programEnvCube.a_Position, quadObj.vertexBuffer);
    gl.drawArrays(gl.TRIANGLES, 0, quadObj.numVertices);

    gl.useProgram(program);
    //model Matrix (part of the mvp matrix)
    //modelMatrix.setRotate(angleY, 1, 0, 0); //for mouse rotation
    //modelMatrix.rotate(angleX, 0, 1, 0); //for mouse rotation
    modelMatrix.setIdentity();
    modelMatrix.scale(zoom, zoom, zoom);

    //lightMatrix.setRotate(angleY, 1, 0, 0); //for mouse rotation
    //lightMatrix.rotate(angleX, 0, 1, 0); //for mouse rotation
    lightMatrix.setIdentity();
    lightMatrix.scale(zoom, zoom, zoom);
    //console.log(zoom);
    modelMatrix.multiply(mdlMatrix);
    //mvp: projection * view * model matrix
    mvpMatrix.setPerspective(30, 1, 1, 100);
    if (fixed == 1) {
        mvpMatrix.lookAt(0, 2, 10, 0, 0, -1, 0, 1, 0);
    } else {
        mvpMatrix.lookAt(
            cameraX,
            cameraY,
            cameraZ,
            cameraX + newViewDir.elements[0],
            cameraY + newViewDir.elements[1],
            cameraZ + newViewDir.elements[2],
            0,
            1,
            0
        );
    }
    mvpMatrix.multiply(modelMatrix);

    //normal matrix
    normalMatrix.setInverseOf(modelMatrix);
    normalMatrix.transpose();

    /*var ini_light = [0, 5, 3];
    ini_light = modelMatrix * ini_light;
    console.log(ini_light);*/

    //gl.uniform3f(program.u_LightPosition, 0, 5, 3);
    gl.uniform3f(program.u_ViewPosition, cameraX, cameraY, cameraZ);
    gl.uniform1f(program.u_Ka, 0.2);
    gl.uniform1f(program.u_Kd, 0.7);
    gl.uniform1f(program.u_Ks, 1.0);
    gl.uniform1f(program.u_shininess, 100.0);
    gl.uniform1i(program.u_Sampler0, 0);
    gl.uniform1i(program.u_Sampler2, 2);
    gl.uniform1i(program.u_ShadowMap, 1);
    gl.uniform1i(program.tex_mode, tex_mode);
    if (tex_mode == 1) {
        gl.uniform3f(program.u_Color, colorR, colorG, colorB);
    }

    gl.uniformMatrix4fv(program.u_MvpMatrix, false, mvpMatrix.elements);
    gl.uniformMatrix4fv(program.u_modelMatrix, false, modelMatrix.elements);
    gl.uniformMatrix4fv(program.u_normalMatrix, false, normalMatrix.elements);
    gl.uniformMatrix4fv(program.u_lightMatrix, false, lightMatrix.elements);
    gl.uniformMatrix4fv(program.u_MvpMatrixOfLight, false, mvpFromLight.elements);
    gl.uniform1i(program.u_normalMode, normalMode);
    gl.uniform1i(program.u_Sampler1, 1);

    //gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, textures[tex_name]);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, fbo.texture);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, textures["holenormal"]); // problem fbo.texture?

    for (let i = 0; i < obj.length; i++) {
        initAttributeVariable(gl, program.a_Position, obj[i].vertexBuffer);
        initAttributeVariable(gl, program.a_TexCoord, obj[i].texCoordBuffer);
        initAttributeVariable(gl, program.a_Normal, obj[i].normalBuffer);
        initAttributeVariable(gl, program.a_Tagent, obj[i].tagentsBuffer);
        initAttributeVariable(gl, program.a_Bitagent, obj[i].bitagentsBuffer);
        initAttributeVariable(gl, program.a_crossTexCoord, obj[i].crossTexCoordsBuffer);
        gl.drawArrays(gl.TRIANGLES, 0, obj[i].numVertices);
    }
}

function parseOBJ(text) {
    // because indices are base 1 let's just fill in the 0th data
    const objPositions = [[0, 0, 0]];
    const objTexcoords = [[0, 0]];
    const objNormals = [[0, 0, 0]];

    // same order as `f` indices
    const objVertexData = [objPositions, objTexcoords, objNormals];

    // same order as `f` indices
    let webglVertexData = [
        [], // positions
        [], // texcoords
        [], // normals
    ];

    const materialLibs = [];
    const geometries = [];
    let geometry;
    let groups = ["default"];
    let material = "default";
    let object = "default";

    const noop = () => {};

    function newGeometry() {
        // If there is an existing geometry and it's
        // not empty then start a new one.
        if (geometry && geometry.data.position.length) {
            geometry = undefined;
        }
    }

    function setGeometry() {
        if (!geometry) {
            const position = [];
            const texcoord = [];
            const normal = [];
            webglVertexData = [position, texcoord, normal];
            geometry = {
                object,
                groups,
                material,
                data: {
                    position,
                    texcoord,
                    normal,
                },
            };
            geometries.push(geometry);
        }
    }

    function addVertex(vert) {
        const ptn = vert.split("/");
        ptn.forEach((objIndexStr, i) => {
            if (!objIndexStr) {
                return;
            }
            const objIndex = parseInt(objIndexStr);
            const index = objIndex + (objIndex >= 0 ? 0 : objVertexData[i].length);
            webglVertexData[i].push(...objVertexData[i][index]);
        });
    }

    const keywords = {
        v(parts) {
            objPositions.push(parts.map(parseFloat));
        },
        vn(parts) {
            objNormals.push(parts.map(parseFloat));
        },
        vt(parts) {
            // should check for missing v and extra w?
            objTexcoords.push(parts.map(parseFloat));
        },
        f(parts) {
            setGeometry();
            const numTriangles = parts.length - 2;
            for (let tri = 0; tri < numTriangles; ++tri) {
                addVertex(parts[0]);
                addVertex(parts[tri + 1]);
                addVertex(parts[tri + 2]);
            }
        },
        s: noop, // smoothing group
        mtllib(parts, unparsedArgs) {
            // the spec says there can be multiple filenames here
            // but many exist with spaces in a single filename
            materialLibs.push(unparsedArgs);
        },
        usemtl(parts, unparsedArgs) {
            material = unparsedArgs;
            newGeometry();
        },
        g(parts) {
            groups = parts;
            newGeometry();
        },
        o(parts, unparsedArgs) {
            object = unparsedArgs;
            newGeometry();
        },
    };

    const keywordRE = /(\w*)(?: )*(.*)/;
    const lines = text.split("\n");
    for (let lineNo = 0; lineNo < lines.length; ++lineNo) {
        const line = lines[lineNo].trim();
        if (line === "" || line.startsWith("#")) {
            continue;
        }
        const m = keywordRE.exec(line);
        if (!m) {
            continue;
        }
        const [, keyword, unparsedArgs] = m;
        const parts = line.split(/\s+/).slice(1);
        const handler = keywords[keyword];
        if (!handler) {
            console.warn("unhandled keyword:", keyword); // eslint-disable-line no-console
            continue;
        }
        handler(parts, unparsedArgs);
    }

    // remove any arrays that have no entries.
    for (const geometry of geometries) {
        geometry.data = Object.fromEntries(Object.entries(geometry.data).filter(([, array]) => array.length > 0));
    }

    return {
        geometries,
        materialLibs,
    };
}

function mouseDown(ev) {
    var x = ev.clientX;
    var y = ev.clientY;
    var rect = ev.target.getBoundingClientRect();
    if (rect.left <= x && x < rect.right && rect.top <= y && y < rect.bottom) {
        mouseLastX = x;
        mouseLastY = y;
        mouseDragging = true;
    }
}

function mouseUp(ev) {
    mouseDragging = false;
}

function mouseMove(ev) {
    var x = ev.clientX;
    var y = ev.clientY;
    if (mouseDragging) {
        var factor = 100 / canvas.height; //100 determine the spped you rotate the object
        var dx = factor * (x - mouseLastX);
        var dy = factor * (y - mouseLastY);

        angleX += dx; //yes, x for y, y for x, this is right
        angleY += dy;
    }
    mouseLastX = x;
    mouseLastY = y;

    draw();
}

function keydown(ev) {
    //implment keydown event here
    let rotateMatrix = new Matrix4();
    rotateMatrix.setRotate(angleY, 1, 0, 0); //for mouse rotation
    rotateMatrix.rotate(angleX, 0, 1, 0); //for mouse rotation
    var viewDir = new Vector3([cameraDirX, cameraDirY, cameraDirZ]);
    var newViewDir = rotateMatrix.multiplyVector3(viewDir);

    if (ev.key == "w") {
        shiftX += newViewDir.elements[0] * 1;
        if (viewMode == 1) {
            cameraX = initialX + shiftX;
        } else {
            cameraX = 0;
        }

        //cameraY += newViewDir.elements[1] * 0.1;
        if (viewMode == 1) {
            cameraY = initialY;
        } else {
            cameraY = 20;
        }

        shiftZ += newViewDir.elements[2] * 1;
        if (viewMode == 1) {
            cameraZ = initialZ + shiftZ;
        } else {
            cameraZ = 0;
        }
    } else if (ev.key == "s") {
        shiftX -= newViewDir.elements[0] * 1;
        if (viewMode == 1) {
            cameraX = initialX + shiftX;
        } else {
            cameraX = 0;
        }

        //cameraY += newViewDir.elements[1] * 0.1;
        if (viewMode == 1) {
            cameraY = initialY;
        } else {
            cameraY = 20;
        }

        //cameraY += newViewDir.elements[1] * 0.1;
        shiftZ -= newViewDir.elements[2] * 1;
        if (viewMode == 1) {
            cameraZ = initialZ + shiftZ;
        } else {
            cameraZ = 0;
        }
    } else if (ev.key == "a") {
        shiftX += newViewDir.elements[2] * 1;
        if (viewMode == 1) {
            cameraX = initialX + shiftX;
        } else {
            cameraX = 0;
        }

        //cameraY += newViewDir.elements[1] * 0.1;
        if (viewMode == 1) {
            cameraY = initialY;
        } else {
            cameraY = 20;
        }

        shiftZ -= newViewDir.elements[0] * 1;
        if (viewMode == 1) {
            cameraZ = initialZ + shiftZ;
        } else {
            cameraZ = 0;
        }
    } else if (ev.key == "d") {
        shiftX -= newViewDir.elements[2] * 1;
        if (viewMode == 1) {
            cameraX = initialX + shiftX;
        } else {
            cameraX = 0;
        }

        //cameraY += newViewDir.elements[1] * 0.1;
        if (viewMode == 1) {
            cameraY = initialY;
        } else {
            cameraY = 20;
        }

        //cameraY += newViewDir.elements[1] * 0.1;
        shiftZ += newViewDir.elements[0] * 1;
        if (viewMode == 1) {
            cameraZ = initialZ + shiftZ;
        } else {
            cameraZ = 0;
        }
    } else if (ev.key == "o") {
        for (let i = 0; i < 12; i++) {
            for (let j = 0; j < 12; j++) {
                if (dirt[i * 12 + j] == 0) {
                    if (
                        0.16 * (-12 + 2 * j) <= shiftX &&
                        shiftX <= 0.16 * (-12 + 2 * (j + 1)) &&
                        0.16 * (-12 + 2 * i) <= shiftZ &&
                        shiftZ <= 0.16 * (-12 + 2 * (i + 1))
                    ) {
                        open_dirt(i, j);
                    }
                }
            }
        }
    } else if (ev.key == "l") {
        if (viewMode == 1) {
            console.log("viewmode: 第三人稱");
            viewMode = 3;
            //angleX = 0;
            //angleY = 0;
            //cameraDirY = -1;
            //cameraDirZ = 0;
        } else {
            console.log("viewmode: 第一人稱");
            viewMode = 1;
        }
    }

    //console.log(cameraX, cameraY, cameraZ);
    draw();
}

function initTexture(gl, img, texKey) {
    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);

    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    // Set the parameters so we can render any size image.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    // Upload the image into the texture.
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);

    textures[texKey] = tex;

    texCount++;
    if (texCount == numTextures) draw();
}

function initFrameBuffer(gl) {
    //create and set up a texture object as the color buffer
    var texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, offScreenWidth, offScreenHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

    //create and setup a render buffer as the depth buffer
    var depthBuffer = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, depthBuffer);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, offScreenWidth, offScreenHeight);

    //create and setup framebuffer: linke the color and depth buffer to it
    var frameBuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthBuffer);
    frameBuffer.texture = texture;
    return frameBuffer;
}

function initCubeTexture(posXName, negXName, posYName, negYName, posZName, negZName, imgWidth, imgHeight) {
    var texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);

    const faceInfos = [
        {
            target: gl.TEXTURE_CUBE_MAP_POSITIVE_X,
            fName: posXName,
        },
        {
            target: gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
            fName: negXName,
        },
        {
            target: gl.TEXTURE_CUBE_MAP_POSITIVE_Y,
            fName: posYName,
        },
        {
            target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
            fName: negYName,
        },
        {
            target: gl.TEXTURE_CUBE_MAP_POSITIVE_Z,
            fName: posZName,
        },
        {
            target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Z,
            fName: negZName,
        },
    ];
    faceInfos.forEach((faceInfo) => {
        const { target, fName } = faceInfo;
        // setup each face so it's immediately renderable
        gl.texImage2D(target, 0, gl.RGBA, imgWidth, imgHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

        var image = new Image();
        image.onload = function () {
            gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
            gl.texImage2D(target, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
            gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
        };
        image.src = fName;
    });
    gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);

    return texture;
}

function calculateTangentSpace(position, texcoord) {
    //iterate through all triangles
    let tagents = [];
    let bitagents = [];
    let crossTexCoords = [];
    for (let i = 0; i < position.length / 9; i++) {
        let v00 = position[i * 9 + 0];
        let v01 = position[i * 9 + 1];
        let v02 = position[i * 9 + 2];
        let v10 = position[i * 9 + 3];
        let v11 = position[i * 9 + 4];
        let v12 = position[i * 9 + 5];
        let v20 = position[i * 9 + 6];
        let v21 = position[i * 9 + 7];
        let v22 = position[i * 9 + 8];
        let uv00 = texcoord[i * 6 + 0];
        let uv01 = texcoord[i * 6 + 1];
        let uv10 = texcoord[i * 6 + 2];
        let uv11 = texcoord[i * 6 + 3];
        let uv20 = texcoord[i * 6 + 4];
        let uv21 = texcoord[i * 6 + 5];

        let deltaPos10 = v10 - v00;
        let deltaPos11 = v11 - v01;
        let deltaPos12 = v12 - v02;
        let deltaPos20 = v20 - v00;
        let deltaPos21 = v21 - v01;
        let deltaPos22 = v22 - v02;

        let deltaUV10 = uv10 - uv00;
        let deltaUV11 = uv11 - uv01;
        let deltaUV20 = uv20 - uv00;
        let deltaUV21 = uv21 - uv01;

        let r = 1.0 / (deltaUV10 * deltaUV21 - deltaUV11 * deltaUV20);
        for (let j = 0; j < 3; j++) {
            crossTexCoords.push(deltaUV10 * deltaUV21 - deltaUV11 * deltaUV20);
        }
        let tangentX = (deltaPos10 * deltaUV21 - deltaPos20 * deltaUV11) * r;
        let tangentY = (deltaPos11 * deltaUV21 - deltaPos21 * deltaUV11) * r;
        let tangentZ = (deltaPos12 * deltaUV21 - deltaPos22 * deltaUV11) * r;
        for (let j = 0; j < 3; j++) {
            tagents.push(tangentX);
            tagents.push(tangentY);
            tagents.push(tangentZ);
        }
        let bitangentX = (deltaPos20 * deltaUV10 - deltaPos10 * deltaUV20) * r;
        let bitangentY = (deltaPos21 * deltaUV10 - deltaPos11 * deltaUV20) * r;
        let bitangentZ = (deltaPos22 * deltaUV10 - deltaPos12 * deltaUV20) * r;
        for (let j = 0; j < 3; j++) {
            bitagents.push(bitangentX);
            bitagents.push(bitangentY);
            bitagents.push(bitangentZ);
        }
    }
    let obj = {};
    obj["tagents"] = tagents;
    obj["bitagents"] = bitagents;
    obj["crossTexCoords"] = crossTexCoords;
    return obj;
}
