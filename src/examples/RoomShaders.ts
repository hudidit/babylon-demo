// WebGL shaders requested by the existing room pipelines during startup.
// Register them once in the initial graph instead of fetching many tiny shader chunks.
import "@babylonjs/core/Shaders/bloomMerge.fragment.js";
import "@babylonjs/core/Shaders/chromaticAberration.fragment.js";
import "@babylonjs/core/Shaders/circleOfConfusion.fragment.js";
import "@babylonjs/core/Shaders/default.fragment.js";
import "@babylonjs/core/Shaders/default.vertex.js";
import "@babylonjs/core/Shaders/depthBoxBlur.fragment.js";
import "@babylonjs/core/Shaders/depthOfFieldMerge.fragment.js";
import "@babylonjs/core/Shaders/extractHighlights.fragment.js";
import "@babylonjs/core/Shaders/fxaa.fragment.js";
import "@babylonjs/core/Shaders/fxaa.vertex.js";
import "@babylonjs/core/Shaders/grain.fragment.js";
import "@babylonjs/core/Shaders/hdrFiltering.fragment.js";
import "@babylonjs/core/Shaders/hdrFiltering.vertex.js";
import "@babylonjs/core/Shaders/imageProcessing.fragment.js";
import "@babylonjs/core/Shaders/kernelBlur.fragment.js";
import "@babylonjs/core/Shaders/kernelBlur.vertex.js";
import "@babylonjs/core/Shaders/pass.fragment.js";
import "@babylonjs/core/Shaders/pbr.fragment.js";
import "@babylonjs/core/Shaders/pbr.vertex.js";
import "@babylonjs/core/Shaders/postprocess.vertex.js";
import "@babylonjs/core/Shaders/rgbdDecode.fragment.js";
import "@babylonjs/core/Shaders/shadowMap.fragment.js";
import "@babylonjs/core/Shaders/shadowMap.vertex.js";
import "@babylonjs/core/Shaders/sharpen.fragment.js";
import "@babylonjs/core/Shaders/ssao2.fragment.js";
import "@babylonjs/core/Shaders/ssaoCombine.fragment.js";
// CoastalOcean uses the current mirror clip plane, independently of the near-land cutaway.
import "@babylonjs/core/Shaders/ShadersInclude/clipPlaneVertexDeclaration.js";
import "@babylonjs/core/Shaders/ShadersInclude/clipPlaneVertex.js";
import "@babylonjs/core/Shaders/ShadersInclude/clipPlaneFragmentDeclaration.js";
import "@babylonjs/core/Shaders/ShadersInclude/clipPlaneFragment.js";
