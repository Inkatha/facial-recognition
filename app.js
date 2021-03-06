var express   = require('express')
    , http    = require('http')
    , async   = require('async')
    , multer  = require('multer')
    , upload  = multer({ dest: 'uploads/' })
    , exphbs  = require('express-handlebars')
    , easyimg = require('easyimage')
    , busboy  = require('connect-busboy')
    , _       = require('lodash')
    , cv      = require('opencv');
    
// MIME types for image uploads
var exts = {
  'image/jpeg': '.jpg',
  'image/png' : '.png',
  'image/gif' : '.gif'
};

var app = express();
app.use(express.static(__dirname + '/public'));

// Configure handlebars
app.engine('.hbs', exphbs({ extname: '.hbs', defaultLayout: 'default' }));
app.set('view engine', '.hbs');

app.get("/", function(req, res) {
   res.render("index"); 
});

// POST callback for the file upload form.
app.post('/upload', upload.single('file'), function(req, res, next){

  // Use filename generated for us, plus the appropriate extension
  var filename = req.file.filename + exts[req.file.mimetype]
  // and source and destination filepaths
  , src = __dirname + '/' + req.file.path
  , dst = __dirname + '/public/images/' + filename;
  
  async.waterfall(
    [
      function(callback) {
        // Check the mimetype to ensure the uploaded file is an image
        if (!_.contains(['image/jpeg','image/png','image/gif'], req.file.mimetype)){
          return callback(new Error(
            'Invalid file - please upload an image (.jpg, .png, .gif).')
          )
        }
        return callback();
      },
      function(callback){
        // Get some information about the uploaded file
        easyimg.info(src).then(
          function(file){
            // Check that the image is suitably large
            if ((file.width < 960) || (file.height < 300)){
              return callback(new Error('Image must be at least 640 x 300 pixels'));
            }
            return callback();
          }
        );
      },
      function(callback) {
        //Resize the image to a sensible size
        easyimg.resize({
          width: 960,
          src: src,
          dst: dst
        }).then(
          function(image){
            return callback();
          }
        );
      },
      function(callback){
        // Use OpenCV to read the resized image;
        cv.readImage(dst, callback);
      },
      function(im, callback){
        im.detectObject(cv.FACE_CASCADE, {}, callback);
      }
    ],
    function(err, faces) {
    // If an error occurred somewhere along the way, render the error page.
      if (err){
        return res.render('error', {message : err.message});
      }
      // Otherwise render the result page.
      return res.render('result', {filename: filename, faces: faces});
    }
  );
});

http.createServer(app)
    .listen(process.env.PORT, process.env.IP, function() {
    console.log("Server started... port %d", process.env.PORT);
});