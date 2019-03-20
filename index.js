let express     = require('express');
let fs          = require('fs');
let path        = require('path');
let app         = express();


// load table/data providers
fs.readdirSync("./providers/").forEach(function(file) {
    let stat;
    stat = fs.statSync("./providers/" + "/" + file);
    if (!stat.isDirectory() && !file.endsWith("html.js") && file.endsWith(".js"))
    {
        let oModule = require("./providers/"+file);
        app.use("/tables/"+file.replace(".js",""),oModule);
        console.log("adding provider: "+file.replace(".js",""));
    }
});

// load converters
fs.readdirSync("./converters/").forEach(function(file) {
    let stat;
    stat = fs.statSync("./converters/" + "/" + file);
    if (!stat.isDirectory() && !file.endsWith("html.js") && file.endsWith(".js"))
    {
        let oModule = require("./converters/"+file);
        app.use("/converters/"+file.replace(".js",""),oModule);
        console.log("adding converters: "+file.replace(".js",""));
    }
});


// list all converters/providers
app.get('/', function (req, res) {
    let sList = "Data providers: <br>";

    fs.readdirSync("./providers/").forEach(function(file) {
        let stat;
        stat = fs.statSync("" + "./providers/" + "/" + file);
        if (!stat.isDirectory() && !file.endsWith("html.js") && file.endsWith(".js"))
        {
            sList += "<a href='/tables/"+file.replace(".js","")+"'>"+file.replace(".js","")+"</a><br>";
        }
    });

    sList += "converters: <br>";
    fs.readdirSync("./converters/").forEach(function(file) {
        let stat;
        stat = fs.statSync("" + "./converters/" + "/" + file);
        if (!stat.isDirectory() && !file.endsWith("html.js") && file.endsWith(".js"))
        {
            sList += "<a href='./converters/"+file.replace(".js","")+"/'>"+file.replace(".js","")+"</a><br>";
        }
    });

    res.send(sList);
});


app.get('/files/:FILE/', function (req, res) {
    res.sendFile(req.params.FILE, { root: path.join(__dirname, './static-files') });
});


app.listen(3000, function () {
    console.log('Example app listening on port 3000!');
});

