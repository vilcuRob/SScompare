var express = require('express');
var path = require("path");
var bodyParser = require('body-parser');
var Pageres = require('pageres');
var fs = require('fs');
var resemble = require('node-resemble-js');
var emptyDir = require('empty-dir');

var app = express();
app.use(bodyParser.json());    
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('differences'))

// Empty differences folder
var rmDir = function(dirPath, removeSelf) {
  if (removeSelf === undefined)
    removeSelf = true;
  try { var files = fs.readdirSync(dirPath); }
  catch(e) { return; }
  if (files.length > 0)
    for (var i = 0; i < files.length; i++) {
      var filePath = dirPath + '/' + files[i];
      if (fs.statSync(filePath).isFile())
        fs.unlinkSync(filePath);
      else
        rmDir(filePath);
    }
  if (removeSelf)
    fs.rmdirSync(dirPath);
};

// Get all file names from folder
var getFiles = function(dir, files_){
    files_ = files_ || [];
    var files = fs.readdirSync(dir);
    for (var i in files){
        var name = dir + '/' + files[i];
        if (fs.statSync(name).isDirectory()){
            getFiles(name, files_);
        } else {
            files_.push(files[i]);
        }
    }
    return files_;
}

app.get('/',function(req,res){
  res.sendFile(path.join(__dirname+'/index.html'));
});

app.post('/newIndex',function(req,res){
    
    var pageres = new Pageres({delay: 1});
    
    if(req.body.index){
        
        req.body.index.forEach(function(index){
            var name = index.name;
            var url = index.url;

            pageres.src(url, ['1920x1080'], {filename: name});
        });

        pageres.dest(__dirname+'/indexed/')
        .run()
        .then(function(){
            console.log('Done');
            res.send('Success');
        });
        
    }else{
         
        res.send('Error');
        
    }
    
});

app.post('/freshcopy',function(req,res){
    
    rmDir(__dirname+'/freshcopy/', false);
    
    var pageres = new Pageres({delay: 2});
    
    if(req.body.index){
        
        req.body.index.forEach(function(index){
            var name = index.name;
            var url = index.url;

            pageres.src(url, ['1920x1080'], {filename: name});
        });

        pageres.dest(__dirname+'/freshcopy/')
        .run()
        .then(function(){
            console.log('Done');
            res.send('Success');
        });
        
    }else{ 
        res.send('Error');
    }
    
});

app.get('/compare', function(req,res){
    
    // Compare the freshcopy vs old ones
    var files = getFiles(__dirname+'/freshcopy/');
    var promises = [];
    
    rmDir(__dirname+'/differences/', false);
    
    var getDiff = function(fileName, resolve){
        
        var diff = resemble(__dirname+'/indexed/'+fileName).compareTo(__dirname+'/freshcopy/'+fileName).ignoreColors().onComplete(function(data){

            var response = {
                fileName : fileName,
                missMatch : data.misMatchPercentage
            };
            
            if (data.misMatchPercentage >= 0.01) {
                data.getDiffImage().pack().pipe(fs.createWriteStream(__dirname+'/differences/'+fileName));
                response.diff = 'different';
            }else{
                response.diff = 'same';
            }
   
            resolve(response);
            
            /*
            {
              misMatchPercentage : 100, // %
              isSameDimensions: true, // or false
              dimensionDifference: { width: 0, height: -1 }, // defined if dimensions are not the same
              getImageDataUrl: function(){}
            }
            */
        });  
        
    };
    
    files.forEach(function(fileName){ 
        promises.push( new Promise(resolve => getDiff(fileName, resolve)) );
    });

    Promise.all(promises)
    .then(data => {
        console.log(data);
        res.send(data);
    });

});


app.listen(3000);