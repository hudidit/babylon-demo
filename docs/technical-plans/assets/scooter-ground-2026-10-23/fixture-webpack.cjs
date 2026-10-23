// Separate verification build: output never enters dist or the production whitelist.
const path=require('node:path'),HtmlWebpackPlugin=require('../../../../node_modules/html-webpack-plugin');
const root=path.resolve(__dirname,'../../../..');
module.exports={mode:'development',entry:path.join(__dirname,'drive-fixture.cjs'),
  output:{path:'/private/tmp/scooter-ground-fixture',filename:'js/[name].js',chunkFilename:'js/[id].js',clean:true},
  resolve:{extensions:['.ts','.js','.cjs']},module:{rules:[{test:/\.ts$/,use:{loader:path.join(root,'node_modules/ts-loader'),options:{transpileOnly:true}},exclude:/node_modules/}]},
  plugins:[new HtmlWebpackPlugin({template:path.join(root,'public/index.html')})],optimization:{splitChunks:{chunks:'all'}}};
