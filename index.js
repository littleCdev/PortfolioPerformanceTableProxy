var express     = require('express');
var fs          = require('fs');
let path        = require('path')
var app         = express();

app.get('/', function (req, res) {
    var sList = "use: /&lt;provider&gt;/isin/&lt;your isin&gt;<br>";

    fs.readdirSync("./providers/").forEach(function(file) {
        let stat;
        stat = fs.statSync("" + "./providers/" + "/" + file);
        if (!stat.isDirectory() && file.split('.').pop() === 'js')
        {
            sList += file.replace(".js","")+"<br>";
        }
    });

    sList += "converters: <br>";
    fs.readdirSync("./converters/").forEach(function(file) {
        let stat;
        stat = fs.statSync("" + "./converters/" + "/" + file);
        if (!stat.isDirectory() && file.split('.').pop() === 'js')
        {
            sList += "<a href='./converters/"+file.replace(".js","")+"'>"+file.replace(".js","")+"</a><br>";
        }
    });

    res.send(sList);
});

app.get('/:SOURCE/isin/:ISIN', function (req, res) {
    try{
        var o = require("./providers/"+req.params.SOURCE+".js");
        o.getCreateTable(res,req.params.ISIN);
    }catch (er){
        console.log(er);
        res.send("ERROR");
    }
});

app.get('/converters/:PROVIDER/', function (req, res) {
    try{
        var o = require("./converters/"+req.params.PROVIDER+".js");
        o.handleRequestGet(req,res);
    }catch (er){
        console.log(er);
        res.send("ERROR");
    }
});

app.get('/files/:FILE/', function (req, res) {
    res.sendFile(req.params.FILE, { root: path.join(__dirname, './static-files') });
});

app.post('/converters/:PROVIDER/*', function (req, res) {
    try{
        var o = require("./converters/"+req.params.PROVIDER+".js");
        o.handleRequestPost(req,res);
    }catch (er){
        console.log(er);
        res.send("ERROR");
    }
});

app.listen(3000, function () {
    console.log('Example app listening on port 3000!');
});

