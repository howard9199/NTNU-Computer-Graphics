var VSHADER_SOURCE = `
    precision mediump float;
    attribute vec4 a_Position;
    attribute vec4 a_Normal;
    attribute vec2 a_TexCoord;
    uniform mat4 u_MvpMatrix;
    uniform mat4 u_modelMatrix;
    uniform mat4 u_lightMatrix;
    uniform mat4 u_normalMatrix;
    varying vec3 v_Normal;
    varying vec3 v_PositionInWorld;
    varying vec2 v_TexCoord;
    void main(){
        gl_Position = u_MvpMatrix * a_Position;
        v_PositionInWorld = (u_modelMatrix * a_Position).xyz; 
        v_Normal = normalize(vec3(u_normalMatrix * a_Normal));
        v_TexCoord = a_TexCoord;
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
    varying vec3 v_Normal;
    varying vec3 v_PositionInWorld;
    varying vec2 v_TexCoord;
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

        vec3 normal = normalize(v_Normal);
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
        
        gl_FragColor = vec4( ambient + diffuse + specular, 1.0 );
        if(is_light >= 1){
            gl_FragColor = vec4(1.0,1.0,1.0, 1.0 );
        }
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

function initVertexBufferForLaterUse(gl, vertices, normals, texCoords) {
    var nVertices = vertices.length / 3;

    var o = new Object();
    o.vertexBuffer = initArrayBufferForLaterUse(
        gl,
        new Float32Array(vertices),
        3,
        gl.FLOAT
    );
    if (normals != null)
        o.normalBuffer = initArrayBufferForLaterUse(
            gl,
            new Float32Array(normals),
            3,
            gl.FLOAT
        );
    if (texCoords != null)
        o.texCoordBuffer = initArrayBufferForLaterUse(
            gl,
            new Float32Array(texCoords),
            2,
            gl.FLOAT
        );
    //you can have error check here
    o.numVertices = nVertices;

    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

    return o;
}
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

var gl, canvas;
var mvpMatrix;
var modelMatrix;
var normalMatrix;
var nVertex;
var cameraX = 3,
    cameraY = 3,
    cameraZ = 7;
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
var textures = {};
var texCount = 0;
var numTextures = 1; //brick

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
        if (
            limit_mode == 1 &&
            limit_obj.indexOf(obj.geometries[i].object) != -1
        ) {
            continue;
        } else if (
            limit_mode == 2 &&
            limit_obj.indexOf(obj.geometries[i].object) == -1
        ) {
            continue;
        }
        let o = initVertexBufferForLaterUse(
            gl,
            obj.geometries[i].data.position,
            obj.geometries[i].data.normal,
            obj.geometries[i].data.texcoord
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
    canvas = document.getElementById("webgl");
    gl = canvas.getContext("webgl2");
    if (!gl) {
        console.log("Failed to get the rendering context for WebGL");
        return;
    }

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

    gl.useProgram(program);

    program.a_Position = gl.getAttribLocation(program, "a_Position");
    program.a_TexCoord = gl.getAttribLocation(program, "a_TexCoord");
    program.a_Normal = gl.getAttribLocation(program, "a_Normal");
    program.u_MvpMatrix = gl.getUniformLocation(program, "u_MvpMatrix");
    program.u_modelMatrix = gl.getUniformLocation(program, "u_modelMatrix");
    program.u_normalMatrix = gl.getUniformLocation(program, "u_normalMatrix");
    program.u_lightMatrix = gl.getUniformLocation(program, "u_lightMatrix");

    //program.u_LightPosition = gl.getUniformLocation(program, "u_LightPosition");
    program.u_ViewPosition = gl.getUniformLocation(program, "u_ViewPosition");
    program.u_Ka = gl.getUniformLocation(program, "u_Ka");
    program.u_Kd = gl.getUniformLocation(program, "u_Kd");
    program.u_Ks = gl.getUniformLocation(program, "u_Ks");
    program.u_shininess = gl.getUniformLocation(program, "u_shininess");
    program.u_Sampler0 = gl.getUniformLocation(program, "u_Sampler0");
    program.u_Color = gl.getUniformLocation(program, "u_Color");
    program.tex_mode = gl.getUniformLocation(program, "tex_mode");
    program.is_light = gl.getUniformLocation(program, "is_light");

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
    bind_img_tex("webglIcon.jpg", "webglIconTex");
    bind_img_tex("plastic.jpg", "plasticTex");
    bind_img_tex("Wood.jpg", "woodTex");

    mvpMatrix = new Matrix4();
    modelMatrix = new Matrix4();
    normalMatrix = new Matrix4();

    gl.enable(gl.DEPTH_TEST);

    canvas.onmousedown = function (ev) {
        mouseDown(ev);
    };
    canvas.onmousemove = function (ev) {
        mouseMove(ev);
    };
    canvas.onmouseup = function (ev) {
        mouseUp(ev);
    };
}

function draw() {
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    //let mdlMatrix = new Matrix4(); //model matrix of objects
    gl.uniform1i(program.is_light, 1);
    mdlMatrix.setIdentity();
    mdlMatrix.translate(0, 2, 1);
    mdlMatrix.scale(0.2, 0.2, 0.2);
    drawOneObject(sphere, "chessTex", mdlMatrix, 1, 1, 1, 1);
    gl.uniform1i(program.is_light, 0);

    mdlMatrix.setIdentity();
    mdlMatrix.scale(2, 0.1, 2);
    drawOneObject(ground, "chessTex", mdlMatrix, 1, 1, 0, 1);

    mdlMatrix.setIdentity();
    mdlMatrix.translate(1.5, -0.1, 1.5);
    mdlMatrix.scale(0.6, 0.6, 0.6);
    drawOneObject(table, "chessTex", mdlMatrix, 1, 0.3, 0.4, 0.6);

    mdlMatrix.setIdentity();
    mdlMatrix.translate(1.5, -0.1, 1);
    mdlMatrix.scale(0.025, 0.025, 0.025);
    drawOneObject(chair, "woodTex", mdlMatrix, 0, 0.3, 0.4, 0.6);

    mdlMatrix.setIdentity();
    mdlMatrix.translate(0 + tx, 0.14, 0 + tz);
    mdlMatrix.scale(0.4, 0.4, 0.4);
    drawOneObject(vacuum, "plasticTex", mdlMatrix, 0, 0, 1, 0);

    mdlMatrix.translate(-0.4, 0, 0);
    pushMatrix();
    mdlMatrix.scale(0.02, 0.02, 0.02);
    drawOneObject(pyramid, "chessTex", mdlMatrix, 1, 1, 1, 0);
    popMatrix();

    mdlMatrix.translate(0, 0.3, 0);
    mdlMatrix.rotate(tx * 30, 0, 0, 1);
    mdlMatrix.translate(0, 0.6, 0);
    pushMatrix();
    mdlMatrix.scale(0.1, 0.5, 0.1);
    drawOneObject(ground, "chessTex", mdlMatrix, 1, 1, 1, 1);
    popMatrix();

    mdlMatrix.translate(0, 0.5, 0);
    pushMatrix();
    mdlMatrix.scale(0.3, 0.3, 0.3);
    drawOneObject(sphere, "chessTex", mdlMatrix, 1, 1, 1, 1);
    popMatrix();

    mdlMatrix.rotate(tz * 30, 1, 0, 0);
    mdlMatrix.translate(0, 0.3, 0);
    pushMatrix();
    mdlMatrix.scale(0.071, 0.001, 0.071);
    drawOneObject(disc, "chessTex", mdlMatrix, 1, 1, 0, 0);
    popMatrix();

    mdlMatrix.translate(0, 0.73, 0);
    mdlMatrix.scale(1.5, 1.5, 1.5);
    drawOneObject(cylinder, "chessTex", mdlMatrix, 1, 1, 0, 0);

    //mdlMatrix.setIdentity();

    /*mdlMatrix.rotate(tz * 90, 1, 0, 0);
    drawOneObject(lid, "chessTex", mdlMatrix, 1, 1, 0, 0);*/

    /*mdlMatrix.setIdentity();
    mdlMatrix.translate(-0.9, 0.75, 0.3);
    mdlMatrix.scale(0.5, 0.5, 0.5);
    drawOneObject(pyramid, "webglIconTex", mdlMatrix, 0);*/
}

//obj: the object components
//mdlMatrix: the model matrix without mouse rotation
//colorR, G, B: object color
function drawOneObject(
    obj,
    tex_name,
    mdlMatrix,
    tex_mode,
    colorR,
    colorG,
    colorB
) {
    //model Matrix (part of the mvp matrix)
    modelMatrix.setRotate(angleY, 1, 0, 0); //for mouse rotation
    modelMatrix.rotate(angleX, 0, 1, 0); //for mouse rotation
    modelMatrix.scale(zoom, zoom, zoom);

    lightMatrix.setRotate(angleY, 1, 0, 0); //for mouse rotation
    lightMatrix.rotate(angleX, 0, 1, 0); //for mouse rotation
    lightMatrix.scale(zoom, zoom, zoom);
    //console.log(zoom);
    modelMatrix.multiply(mdlMatrix);
    //mvp: projection * view * model matrix
    mvpMatrix.setPerspective(30, 1, 1, 100);
    mvpMatrix.lookAt(cameraX, cameraY, cameraZ, 0, 0, 0, 0, 1, 0);
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
    gl.uniform1i(program.tex_mode, tex_mode);
    if (tex_mode == 1) {
        gl.uniform3f(program.u_Color, colorR, colorG, colorB);
    }

    gl.uniformMatrix4fv(program.u_MvpMatrix, false, mvpMatrix.elements);
    gl.uniformMatrix4fv(program.u_modelMatrix, false, modelMatrix.elements);
    gl.uniformMatrix4fv(program.u_normalMatrix, false, normalMatrix.elements);
    gl.uniformMatrix4fv(program.u_lightMatrix, false, lightMatrix.elements);

    //gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, textures[tex_name]);

    for (let i = 0; i < obj.length; i++) {
        initAttributeVariable(gl, program.a_Position, obj[i].vertexBuffer);
        initAttributeVariable(gl, program.a_TexCoord, obj[i].texCoordBuffer);
        initAttributeVariable(gl, program.a_Normal, obj[i].normalBuffer);
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
            const index =
                objIndex + (objIndex >= 0 ? 0 : objVertexData[i].length);
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
        geometry.data = Object.fromEntries(
            Object.entries(geometry.data).filter(
                ([, array]) => array.length > 0
            )
        );
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
