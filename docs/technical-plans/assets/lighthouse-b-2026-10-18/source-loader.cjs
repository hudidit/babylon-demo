const fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),cache=new Map();
module.exports=function load(name){if(cache.has(name))return cache.get(name);const m={exports:{}};cache.set(name,m.exports);
 const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../../../../src/examples',name+'.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 new Function('require','module','exports',code)(id=>id.startsWith('./')?load(id.slice(2)):require(id),m,m.exports);cache.set(name,m.exports);return m.exports;
};
